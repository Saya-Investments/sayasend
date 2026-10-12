import Link from 'next/link'
import { List } from 'lucide-react'

import { AppLayout } from '@/components/layout/app-layout'
import { CampaignsCalendar } from '@/components/campaigns/campaigns-calendar'
import { Button } from '@/components/ui/button'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function CampaignsCalendarPage() {
  const campaigns = await prisma.campaign.findMany({
    // scheduledAt conserva la fecha original incluso después de completar o
    // fallar el envío; así el calendario funciona también como historial.
    where: { scheduledAt: { not: null } },
    select: {
      id: true,
      nombre: true,
      status: true,
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
    status: c.status,
    scheduledAt: c.scheduledAt!.toISOString(),
    totalContacts: c.totalContacts,
    refreshOnSend: c.refreshOnSend,
    template: c.template,
  }))

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Calendario</h1>
            <p className="mt-2 text-muted-foreground">
              Historial y próximas campañas programadas
            </p>
          </div>
          <Link href="/campaigns" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full gap-2 sm:w-auto">
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
