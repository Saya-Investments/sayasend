import { NextRequest, NextResponse } from 'next/server'

import type { ContactabilityScope } from '@/lib/campaign-contactability'
import { getCampaignContactabilityExportRows } from '@/lib/campaign-contactability-export'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const ALLOWED_STATUSES = new Set(['pending', 'sent', 'delivered', 'read', 'failed'])
const ALLOWED_SCOPES = new Set<ContactabilityScope>(['global', 'principal', 'alterno'])

const CSV_HEADERS = [
  'codigoAsociado',
  'dni',
  'nombre',
  'telefonoPrincipal',
  'telefonoSecundario',
  'telefonoEvaluado',
  'origenResultado',
  'tieneTelefonoSecundario',
  'reintentado',
  'estado',
  'segmento',
  'estrategia',
  'frente',
  'monto',
  'sentAt',
  'deliveredAt',
  'readAt',
  'failedAt',
  'failureCode',
  'failureReason',
]

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = value instanceof Date ? value.toISOString() : String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function formatDate(value: Date | null | undefined): string {
  return value ? value.toISOString() : ''
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const rawStatus = request.nextUrl.searchParams.get('status')?.trim() ?? ''
  const status = rawStatus && ALLOWED_STATUSES.has(rawStatus) ? rawStatus : null
  const rawScope = request.nextUrl.searchParams.get('scope')?.trim() ?? 'global'
  const scope = ALLOWED_SCOPES.has(rawScope as ContactabilityScope)
    ? (rawScope as ContactabilityScope)
    : 'global'

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, nombre: true },
  })

  if (!campaign) {
    return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
  }

  const contactabilityRows = await getCampaignContactabilityExportRows(id, scope)
  const filteredRows = status
    ? contactabilityRows.filter((row) => row.estado === status)
    : contactabilityRows

  const rows = filteredRows.map((row) => [
    row.codigoAsociado,
    row.dni,
    row.nombre,
    row.telefonoPrincipal,
    row.telefonoSecundario,
    row.telefonoEvaluado,
    row.origenResultado,
    row.tieneTelefonoSecundario ? 'Sí' : 'No',
    row.reintentado ? 'Sí' : 'No',
    row.estado,
    row.segmento,
    row.estrategia,
    row.frente,
    row.monto,
    formatDate(row.sentAt),
    formatDate(row.deliveredAt),
    formatDate(row.readAt),
    formatDate(row.failedAt),
    row.failureCode,
    row.failureReason,
  ])

  const csv = [CSV_HEADERS.join(','), ...rows.map((row) => row.map(escapeCsv).join(','))].join(
    '\r\n',
  )

  const safeName = campaign.nombre.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) || 'campaign'
  const suffix = status ? `_${scope}_${status}` : `_${scope}_all`
  const filename = `${safeName}${suffix}.csv`

  return new NextResponse('\uFEFF' + csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
