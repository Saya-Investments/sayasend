import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { AppLayout } from '@/components/layout/app-layout'
import { CampaignDetailView } from '@/components/campaigns/campaign-detail-view'
import { Button } from '@/components/ui/button'
import { getCampaignContactability } from '@/lib/campaign-contactability'
import type { CampaignContactability } from '@/lib/campaign-contactability'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type CampaignDetailPageProps = {
  params: Promise<{ id: string }>
}

function toVariableMappings(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.fromEntries(
    Object.entries(value).map(([key, mappedValue]) => [key, String(mappedValue ?? '')]),
  )
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
        variableMappings: toVariableMappings(rawCampaign.variableMappings),
        campaignContacts: rawCampaign.campaignContacts.map((cc) => ({
          ...cc,
          cliente: {
            ...cc.cliente,
            monto: Number(cc.cliente.monto),
            monto1: cc.cliente.monto1 === null ? null : Number(cc.cliente.monto1),
            monto2: cc.cliente.monto2 === null ? null : Number(cc.cliente.monto2),
            monto3: cc.cliente.monto3 === null ? null : Number(cc.cliente.monto3),
            probabilidad: cc.cliente.probabilidad === null ? null : Number(cc.cliente.probabilidad),
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

  let contactability: CampaignContactability | null = null
  try {
    contactability = await getCampaignContactability(id)
  } catch (error) {
    console.warn('[CampaignDetail] no se pudo calcular contactabilidad:', (error as Error).message)
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

        <CampaignDetailView
          campaign={campaign}
          contactability={contactability}
        />
      </div>
    </AppLayout>
  )
}
