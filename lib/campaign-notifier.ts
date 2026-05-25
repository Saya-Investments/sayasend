import { prisma } from '@/lib/prisma'
import { sendCampaignCompletionEmail } from '@/lib/email'

type MetricsRow = {
  campaign_id: string
  total: bigint
  sent: bigint
  delivered: bigint
  read: bigint
  failed: bigint
  delivery_rate: number | null
  read_rate: number | null
  failure_rate: number | null
}

export async function notifyCompletedCampaigns() {
  const completed = await prisma.campaign.findMany({
    where: {
      status: 'completed',
      finishedAt: { not: null },
      notificationSentAt: null,
    },
    select: { id: true, nombre: true, totalContacts: true, finishedAt: true },
  })

  if (completed.length === 0) {
    return { notified: 0 }
  }

  const ids = completed.map((c) => c.id)
  const placeholders = ids.map((_, i) => `$${i + 1}::uuid`).join(', ')

  const rows = await prisma.$queryRawUnsafe<MetricsRow[]>(
    `SELECT * FROM sayasend.vw_campaign_metrics WHERE campaign_id IN (${placeholders})`,
    ...ids,
  )

  const metricsByid = new Map(rows.map((r) => [r.campaign_id, r]))

  let notified = 0

  for (const campaign of completed) {
    const m = metricsByid.get(campaign.id)

    try {
      await sendCampaignCompletionEmail({
        campaignId: campaign.id,
        campaignName: campaign.nombre,
        totalContacts: campaign.totalContacts,
        sent: m ? Number(m.sent) : 0,
        delivered: m ? Number(m.delivered) : 0,
        read: m ? Number(m.read) : 0,
        failed: m ? Number(m.failed) : 0,
        deliveryRate: m ? Number(m.delivery_rate ?? 0) : 0,
        readRate: m ? Number(m.read_rate ?? 0) : 0,
        failureRate: m ? Number(m.failure_rate ?? 0) : 0,
        finishedAt: campaign.finishedAt!,
      })

      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { notificationSentAt: new Date() },
      })

      notified++
    } catch (error) {
      console.error(`[CampaignNotifier] Error notificando campaña ${campaign.id}:`, error)
    }
  }

  return { notified }
}
