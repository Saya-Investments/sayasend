import Link from 'next/link'
import { Plus } from 'lucide-react'

import { AppLayout } from '@/components/layout/app-layout'
import { CampaignsList } from '@/components/campaigns/campaigns-list'
import { Button } from '@/components/ui/button'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  // Solo las columnas que pinta la tabla. El conteo de contactos sale de
  // total_contacts (ya guardado en la fila) en vez de un _count por campaña.
  // Las métricas de envío las pide la lista por página vía /api/campaigns/stats:
  // calcularlas acá para todas las campañas hacía que la página tardara
  // segundos y se cayera por timeout.
  const campaigns = await prisma.campaign.findMany({
    select: {
      id: true,
      nombre: true,
      status: true,
      totalContacts: true,
      createdAt: true,
      template: { select: { nombre: true } },
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
