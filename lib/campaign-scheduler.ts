import { queryBigQueryContacts, queryBigQueryContactsCobranza } from '@/lib/bigquery'
import { freezeCampaignContacts } from '@/lib/campaign-contacts'
import { sendCampaignFailedEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'

type SendScheduledCampaignResult = {
  campaignId: string
  status: 'sent' | 'skipped' | 'failed'
  error?: string
}

function getCampaignSenderBaseUrl() {
  const value = process.env.CLOUD_RUN_API_URL || process.env.NEXT_PUBLIC_API_URL
  if (!value || value.includes('your-cloud-run-url.run.app')) {
    throw new Error('Configura CLOUD_RUN_API_URL o NEXT_PUBLIC_API_URL para disparar envios.')
  }
  return value.replace(/\/$/, '')
}

async function triggerCampaignSend(campaignId: string) {
  const baseUrl = getCampaignSenderBaseUrl()
  const response = await fetch(`${baseUrl}/api/campaigns/${campaignId}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Send API respondio ${response.status}: ${text || response.statusText}`)
  }
}

type DueCampaign = {
  id: string
  nombre: string
  refreshOnSend: boolean
  gestionType: string | null
  databaseName: string
  segmentoFilter: string | null
  estrategiaFilter: string | null
  frenteFilter: string | null
}

// Para campañas con "base actualizada del día de envío": re-consulta BigQuery
// con los filtros guardados y reemplaza los contactos congelados por la base
// fresca de hoy. Devuelve cuántos contactos quedaron. Si devuelve 0, el caller
// debe marcar la campaña como fallida.
async function refreshCampaignContacts(campaign: DueCampaign): Promise<number> {
  const filters = {
    segmento: campaign.segmentoFilter || undefined,
    estrategia: campaign.estrategiaFilter || undefined,
    frente: campaign.frenteFilter || undefined,
  }

  const payload =
    campaign.gestionType === 'gestion_cobranza'
      ? await queryBigQueryContactsCobranza(campaign.databaseName, filters)
      : await queryBigQueryContacts(campaign.databaseName, filters)

  const contacts = payload.contacts

  const linked = await prisma.$transaction(
    async (tx) => {
      const count = await freezeCampaignContacts(tx, campaign.id, contacts, {
        isExcelSource: false,
        replace: true,
      })
      await tx.campaign.update({
        where: { id: campaign.id },
        data: { totalContacts: count },
      })
      return count
    },
    { timeout: 180000, maxWait: 15000 },
  )

  return linked
}

export async function sendDueScheduledCampaigns(limit = 5) {
  const now = new Date()

  const dueCampaigns = await prisma.campaign.findMany({
    where: {
      status: 'scheduled',
      scheduledAt: { lte: now },
      startedAt: null,
    },
    orderBy: { scheduledAt: 'asc' },
    take: limit,
    select: {
      id: true,
      nombre: true,
      refreshOnSend: true,
      gestionType: true,
      databaseName: true,
      segmentoFilter: true,
      estrategiaFilter: true,
      frenteFilter: true,
    },
  })

  const results: SendScheduledCampaignResult[] = []

  for (const campaign of dueCampaigns) {
    const claimed = await prisma.campaign.updateMany({
      where: {
        id: campaign.id,
        status: 'scheduled',
        scheduledAt: { lte: now },
        startedAt: null,
      },
      data: {
        startedAt: new Date(),
      },
    })

    if (claimed.count === 0) {
      results.push({ campaignId: campaign.id, status: 'skipped' })
      continue
    }

    try {
      // Base actualizada del día de envío: re-consultar BigQuery y reemplazar
      // los contactos congelados por la base fresca de hoy.
      if (campaign.refreshOnSend) {
        const count = await refreshCampaignContacts(campaign)

        if (count === 0) {
          // La base del día no arrojó contactos: marcar como fallida y avisar.
          await prisma.campaign.update({
            where: { id: campaign.id },
            data: { status: 'failed', finishedAt: new Date() },
          })

          await sendCampaignFailedEmail({
            campaignId: campaign.id,
            campaignName: campaign.nombre,
            reason: 'La base actualizada del día de envío no arrojó contactos (0 destinatarios).',
            failedAt: new Date(),
          }).catch((err) => {
            console.error(`[CampaignScheduler] Error notificando fallo ${campaign.id}:`, err)
          })

          results.push({
            campaignId: campaign.id,
            status: 'failed',
            error: '0 contactos en la base del día de envío',
          })
          continue
        }
      }

      await triggerCampaignSend(campaign.id)
      results.push({ campaignId: campaign.id, status: 'sent' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido'
      // Error recuperable (BigQuery caído, Cloud Run no responde): liberar el
      // claim para reintentar en el siguiente tick.
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          startedAt: null,
        },
      })
      results.push({ campaignId: campaign.id, status: 'failed', error: message })
    }
  }

  return {
    checkedAt: now.toISOString(),
    dueCount: dueCampaigns.length,
    results,
  }
}
