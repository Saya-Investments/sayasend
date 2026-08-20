import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { AppLayout } from '@/components/layout/app-layout'
import { CampaignDetailView } from '@/components/campaigns/campaign-detail-view'
import type { ErrorItem } from '@/components/contactability/errors-chart'
import { Button } from '@/components/ui/button'
import { prisma } from '@/lib/prisma'
import type { ContactabilityMetrics } from '@/lib/types'

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
  sent_only: bigint
  delivered_only: bigint
  pending: bigint
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

  let metrics: ContactabilityMetrics | null = null

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
        sentOnly: Number(row.sent_only),
        deliveredOnly: Number(row.delivered_only),
        pending: Number(row.pending),
        deliveryRate: Number(row.delivery_rate ?? 0),
        readRate: Number(row.read_rate ?? 0),
        failureRate: Number(row.failure_rate ?? 0),
      }
    }
  } catch (error) {
    console.warn('[CampaignDetail] no se pudo leer métricas:', (error as Error).message)
  }

  let principalErrors: ErrorItem[] = []
  let alternateErrors: ErrorItem[] = []
  try {
    // Los campos failure_code_1/2 son la fuente principal porque el motor los
    // guarda por intento. Los eventos de WhatsApp solo completan campañas
    // antiguas (o intentos sin esos campos), sin duplicar contactos ya cubiertos.
    const errorRows = await prisma.$queryRaw<
      Array<{ code: string; phone_kind: 'principal' | 'alterno'; count: bigint }>
    >`
      WITH intentos_guardados AS (
        SELECT
          trim(cc.failure_code_1) AS code,
          cc.id::text AS contacto,
          'principal'::text AS phone_kind
        FROM sayasend.campaign_contacts cc
        WHERE cc.campaign_id = ${id}::uuid
          AND NULLIF(trim(cc.failure_code_1), '') IS NOT NULL

        UNION ALL

        SELECT
          trim(cc.failure_code_2) AS code,
          cc.id::text AS contacto,
          'alterno'::text AS phone_kind
        FROM sayasend.campaign_contacts cc
        WHERE cc.campaign_id = ${id}::uuid
          AND NULLIF(trim(cc.failure_code_2), '') IS NOT NULL
      ),
      eventos_clasificados AS (
        SELECT
          (err->>'code')::text AS code,
          COALESCE(mo.campaign_contact_id::text, mo.phone_to) AS contacto,
          CASE
            WHEN NULLIF(
                   regexp_replace(COALESCE(NULLIF(cc.phone_2, ''), cl.telefono_3), '[^0-9]', '', 'g'),
                   ''
                 ) IS NOT NULL
             AND right(regexp_replace(mo.phone_to, '[^0-9]', '', 'g'), 10)
                 = right(
                     regexp_replace(COALESCE(NULLIF(cc.phone_2, ''), cl.telefono_3), '[^0-9]', '', 'g'),
                     10
                   )
             AND right(regexp_replace(mo.phone_to, '[^0-9]', '', 'g'), 10)
                 IS DISTINCT FROM right(
                   regexp_replace(COALESCE(NULLIF(cc.phone_1, ''), cl.telefono), '[^0-9]', '', 'g'),
                   10
                 )
            THEN 'alterno'
            ELSE 'principal'
          END AS phone_kind,
          cc.failure_code_1,
          cc.failure_code_2
        FROM sayasend.mensaje_status_event mse
        JOIN sayasend.mensaje_out mo ON mse.id_msg = mo.id_msg
        LEFT JOIN sayasend.campaign_contacts cc ON cc.id = mo.campaign_contact_id
        LEFT JOIN sayasend.clientes cl ON cl.id = cc.cliente_id
        CROSS JOIN LATERAL jsonb_array_elements(mse.errors_json) AS err
        WHERE mo.campaign_id = ${id}::uuid
          AND mse.errors_json IS NOT NULL
          AND jsonb_typeof(mse.errors_json) = 'array'
          AND err ? 'code'
      ),
      eventos_legacy AS (
        SELECT code, contacto, phone_kind
        FROM eventos_clasificados
        WHERE (phone_kind = 'principal' AND NULLIF(trim(failure_code_1), '') IS NULL)
           OR (phone_kind = 'alterno' AND NULLIF(trim(failure_code_2), '') IS NULL)
      ),
      intentos AS (
        SELECT code, contacto, phone_kind FROM intentos_guardados
        UNION ALL
        SELECT code, contacto, phone_kind FROM eventos_legacy
      )
      SELECT
        code,
        phone_kind,
        COUNT(DISTINCT contacto)::bigint AS count
      FROM intentos
      GROUP BY phone_kind, code
      ORDER BY phone_kind, count DESC, code
    `

    principalErrors = errorRows
      .filter((row) => row.phone_kind === 'principal')
      .map((row) => ({ code: row.code, count: Number(row.count) }))
      .slice(0, 10)
    alternateErrors = errorRows
      .filter((row) => row.phone_kind === 'alterno')
      .map((row) => ({ code: row.code, count: Number(row.count) }))
      .slice(0, 10)
  } catch (error) {
    console.warn('[CampaignDetail] no se pudieron leer errores:', (error as Error).message)
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
          metrics={metrics}
          principalErrors={principalErrors}
          alternateErrors={alternateErrors}
        />
      </div>
    </AppLayout>
  )
}
