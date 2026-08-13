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

  let errors: ErrorItem[] = []
  try {
    // Cada error se atribuye al número al que se envió ese mensaje: el principal
    // (clientes.telefono) o el alterno (clientes.telefono_3, el segundo intento).
    // `mensaje_out.phone_to` viene con código de país (57XXXXXXXXXX) y `clientes`
    // guarda 10 dígitos, así que se comparan los últimos 10.
    //
    // Se clasifica como 'alterno' solo si coincide con telefono_3 y NO con el
    // principal; todo lo demás cae en 'principal'. Mientras telefono_3 esté vacío
    // (hoy lo está en toda la base) el desglose da 100% principal y el gráfico
    // sigue mostrándose por contacto, igual que antes.
    //
    // GROUPING SETS devuelve además la fila total por código (phone_kind NULL):
    // no es la suma de los dos, porque un mismo contacto puede fallar con el
    // mismo código en ambos números y ahí cuenta una sola vez.
    const errorRows = await prisma.$queryRaw<
      Array<{ code: string; phone_kind: string | null; count: bigint }>
    >`
      WITH eventos AS (
        SELECT
          (err->>'code')::text AS code,
          COALESCE(mo.campaign_contact_id::text, mo.phone_to) AS contacto,
          CASE
            WHEN cl.telefono_3 IS NOT NULL
             AND right(regexp_replace(mo.phone_to, '[^0-9]', '', 'g'), 10)
                 = right(regexp_replace(cl.telefono_3, '[^0-9]', '', 'g'), 10)
             AND right(regexp_replace(mo.phone_to, '[^0-9]', '', 'g'), 10)
                 <> right(regexp_replace(cl.telefono, '[^0-9]', '', 'g'), 10)
            THEN 'alterno'
            ELSE 'principal'
          END AS phone_kind
        FROM sayasend.mensaje_status_event mse
        JOIN sayasend.mensaje_out mo ON mse.id_msg = mo.id_msg
        LEFT JOIN sayasend.campaign_contacts cc ON cc.id = mo.campaign_contact_id
        LEFT JOIN sayasend.clientes cl ON cl.id = cc.cliente_id
        CROSS JOIN LATERAL jsonb_array_elements(mse.errors_json) AS err
        WHERE mo.campaign_id = ${id}::uuid
          AND mse.errors_json IS NOT NULL
          AND jsonb_typeof(mse.errors_json) = 'array'
          AND err ? 'code'
      )
      SELECT
        code,
        phone_kind,
        COUNT(DISTINCT contacto)::bigint AS count
      FROM eventos
      GROUP BY GROUPING SETS ((code), (code, phone_kind))
    `

    const porCodigo = new Map<string, ErrorItem>()
    for (const row of errorRows) {
      const item =
        porCodigo.get(row.code) ??
        { code: row.code, count: 0, principal: 0, alterno: 0 }
      if (row.phone_kind === null) item.count = Number(row.count)
      else if (row.phone_kind === 'alterno') item.alterno = Number(row.count)
      else item.principal = Number(row.count)
      porCodigo.set(row.code, item)
    }

    errors = Array.from(porCodigo.values())
      .sort((a, b) => b.count - a.count)
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

        <CampaignDetailView campaign={campaign} metrics={metrics} errors={errors} />
      </div>
    </AppLayout>
  )
}
