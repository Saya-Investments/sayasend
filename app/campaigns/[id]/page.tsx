import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { AppLayout } from '@/components/layout/app-layout'
import { CampaignDetailView } from '@/components/campaigns/campaign-detail-view'
import { Button } from '@/components/ui/button'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type CampaignDetailPageProps = {
  params: Promise<{ id: string }>
}

type MetricsRow = {
  campaign_id: string
  campaign_name: string
  total: bigint
  sent: bigint
  delivered: bigint
  read: bigint
  failed: bigint
  delivery_rate: number | null
  read_rate: number | null
  failure_rate: number | null
}

export default async function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const { id } = await params

  const rawCampaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      template: true,
      campaignContacts: {
        include: { cliente: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  const campaign = rawCampaign
    ? {
        ...rawCampaign,
        campaignContacts: rawCampaign.campaignContacts.map((cc) => ({
          ...cc,
          cliente: {
            ...cc.cliente,
            monto: Number(cc.cliente.monto),
            probabilidad:
              cc.cliente.probabilidad === null ? null : Number(cc.cliente.probabilidad),
          },
        })),
      }
    : null

  if (!campaign) {
    return (
      <AppLayout>
        <div className="p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Campaña no encontrada</h1>
          <Link href="/campaigns">
            <Button>Volver a Campañas</Button>
          </Link>
        </div>
      </AppLayout>
    )
  }

  let metrics: {
    total: number
    sent: number
    delivered: number
    read: number
    failed: number
    deliveryRate: number
    readRate: number
    failureRate: number
  } | null = null

  try {
    const rows = await prisma.$queryRaw<MetricsRow[]>`
      SELECT * FROM sayasend.vw_campaign_metrics WHERE campaign_id = ${id}::uuid
    `
    const row = rows[0]
    if (row) {
      metrics = {
        total: Number(row.total),
        sent: Number(row.sent),
        delivered: Number(row.delivered),
        read: Number(row.read),
        failed: Number(row.failed),
        deliveryRate: Number(row.delivery_rate ?? 0),
        readRate: Number(row.read_rate ?? 0),
        failureRate: Number(row.failure_rate ?? 0),
      }
    }
  } catch (error) {
    console.warn('[CampaignDetail] no se pudo leer métricas:', (error as Error).message)
  }

  return (
    <AppLayout>
      <div className="p-8 space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/campaigns">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Volver
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">{campaign.nombre}</h1>
            <p className="text-muted-foreground mt-1">
              Creada el {new Date(campaign.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <CampaignDetailView campaign={campaign} metrics={metrics} />
      </div>
    </AppLayout>
  )
}
