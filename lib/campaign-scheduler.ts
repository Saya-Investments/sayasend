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
    select: { id: true, scheduledAt: true },
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
      await triggerCampaignSend(campaign.id)
      results.push({ campaignId: campaign.id, status: 'sent' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido'
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
