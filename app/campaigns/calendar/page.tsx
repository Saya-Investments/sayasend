import Link from 'next/link'
import { List } from 'lucide-react'

import { AppLayout } from '@/components/layout/app-layout'
import { CampaignsCalendar } from '@/components/campaigns/campaigns-calendar'
import { Button } from '@/components/ui/button'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function CampaignsCalendarPage() {
  const campaigns = await prisma.campaign.findMany({
    where: { status: 'scheduled', scheduledAt: { not: null } },
    select: {
      id: true,
      nombre: true,
      scheduledAt: true,
      totalContacts: true,
      refreshOnSend: true,
      template: { select: { nombre: true } },
    },
    orderBy: { scheduledAt: 'asc' },
  })

  const data = campaigns.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    scheduledAt: c.scheduledAt!.toISOString(),
    totalContacts: c.totalContacts,
    refreshOnSend: c.refreshOnSend,
    template: c.template,
  }))

  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Calendario</h1>
            <p className="mt-2 text-muted-foreground">
              Campañas programadas pendientes de envío
            </p>
          </div>
          <Link href="/campaigns">
            <Button variant="outline" className="gap-2">
              <List className="h-4 w-4" />
              Ver lista
            </Button>
          </Link>
        </div>

        <CampaignsCalendar campaigns={data} />
      </div>
    </AppLayout>
  )
}
