import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const ALLOWED_STATUSES = new Set(['pending', 'sent', 'delivered', 'read', 'failed'])

const CSV_HEADERS = [
  'codigoAsociado',
  'dni',
  'nombre',
  'telefono',
  'segmento',
  'estrategia',
  'frente',
  'monto',
  'estado',
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

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, nombre: true },
  })

  if (!campaign) {
    return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
  }

  const contacts = await prisma.campaignContact.findMany({
    where: {
      campaignId: id,
      ...(status ? { sendStatus: status } : {}),
    },
    include: { cliente: true },
    orderBy: { createdAt: 'asc' },
  })

  const rows = contacts.map((cc) => {
    const c = cc.cliente
    const codigoAsociadoForCsv = c.codigoAsociado.replace(/,\s*/g, ' | ')
    return [
      codigoAsociadoForCsv,
      c.dni,
      c.nombre,
      c.telefono,
      c.segmento ?? '',
      c.estrategia ?? '',
      c.frente ?? '',
      c.monto.toString(),
      cc.sendStatus,
      formatDate(cc.sentAt),
      formatDate(cc.deliveredAt),
      formatDate(cc.readAt),
      formatDate(cc.failedAt),
      cc.failureCode ?? '',
      cc.failureReason ?? '',
    ]
  })

  const csv = [
    CSV_HEADERS.join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\r\n')

  const safeName = campaign.nombre.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) || 'campaign'
  const suffix = status ? `_${status}` : '_all'
  const filename = `${safeName}${suffix}.csv`

  return new NextResponse('﻿' + csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
