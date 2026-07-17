import Link from 'next/link'
import { Plus } from 'lucide-react'

import { AppLayout } from '@/components/layout/app-layout'
import { CampaignsList } from '@/components/campaigns/campaigns-list'
import { Button } from '@/components/ui/button'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    include: {
      template: { select: { nombre: true } },
      _count: { select: { campaignContacts: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Desglose de envíos por campaña (enviados vs fallidos) para el indicador
  // rápido de la lista: así se ve de un vistazo si una campaña falló en masa.
  const statusRows = await prisma.campaignContact.groupBy({
    by: ['campaignId', 'sendStatus'],
    _count: { _all: true },
  })
  const sendStats = new Map<string, { enviados: number; fallidos: number }>()
  for (const row of statusRows) {
    const entry = sendStats.get(row.campaignId) ?? { enviados: 0, fallidos: 0 }
    if (['sent', 'delivered', 'read'].includes(row.sendStatus)) {
      entry.enviados += row._count._all
    } else if (row.sendStatus === 'failed') {
      entry.fallidos += row._count._all
    }
    sendStats.set(row.campaignId, entry)
  }
  const campaignsWithStats = campaigns.map((c) => ({
    ...c,
    enviados: sendStats.get(c.id)?.enviados ?? 0,
    fallidos: sendStats.get(c.id)?.fallidos ?? 0,
  }))

  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Campañas</h1>
            <p className="text-muted-foreground mt-2">
              Crea y gestiona tus campañas de mensajería
            </p>
          </div>
          <Link href="/campaigns/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nueva Campaña
            </Button>
          </Link>
        </div>

        <CampaignsList campaigns={campaignsWithStats} />
      </div>
    </AppLayout>
  )
}
