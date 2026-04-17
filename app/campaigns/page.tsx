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

        <CampaignsList campaigns={campaigns} />
      </div>
    </AppLayout>
  )
}
