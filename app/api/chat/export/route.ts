import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type MsgJson = {
  created_at: string
  direction: string
  text_body: string | null
  message_type: string | null
  template_name: string | null
}

type ClientRow = {
  cliente_id: string | null
  nombre: string | null
  telefono_raw: string | null
  phone: string
  segmento: string | null
  mensajes: MsgJson[] | null
}

function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return ''
  const s = String(val)
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// GET /api/chat/export?campaignId=<uuid>&onlyReplied=true
// Exporta un CSV con una fila por cliente y sus mensajes concatenados.
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const campaignIdRaw = url.searchParams.get('campaignId')
    const campaignId =
      campaignIdRaw && campaignIdRaw !== 'all' ? campaignIdRaw : null
    const onlyReplied = url.searchParams.get('onlyReplied') === 'true'

    const campaignFilter = campaignId
      ? Prisma.sql`AND phones.phone IN (
          SELECT DISTINCT
            CASE
              WHEN length(regexp_replace(cli.telefono, '[^0-9]', '', 'g')) = 10
              THEN '+57' || regexp_replace(cli.telefono, '[^0-9]', '', 'g')
              ELSE '+' || regexp_replace(cli.telefono, '[^0-9]', '', 'g')
            END
          FROM sayasend.campaign_contacts cc
          JOIN sayasend.clientes cli ON cli.id = cc.cliente_id
          WHERE cc.campaign_id = ${campaignId}::uuid
        )`
      : Prisma.empty

    const repliedFilter = onlyReplied
      ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM sayasend.chat_messages inb
          WHERE inb.phone = phones.phone AND inb.direction = 'inbound'
        )`
      : Prisma.empty

    let campaignNombre = 'Todas'
    if (campaignId) {
      const camp = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { nombre: true },
      })
      campaignNombre = camp?.nombre ?? campaignId
    }

    const rows = await prisma.$queryRaw<ClientRow[]>(Prisma.sql`
      SELECT
        c.id                       AS cliente_id,
        c.nombre                   AS nombre,
        c.telefono                 AS telefono_raw,
        phones.phone               AS phone,
        c.segmento                 AS segmento,
        json_agg(
          json_build_object(
            'created_at',    m.created_at,
            'direction',     m.direction,
            'text_body',     m.text_body,
            'message_type',  m.message_type,
            'template_name', m.template_name
          ) ORDER BY m.created_at ASC
        ) AS mensajes
      FROM (
        SELECT DISTINCT phone
        FROM sayasend.chat_messages
      ) phones
      JOIN sayasend.chat_messages m ON m.phone = phones.phone
      LEFT JOIN sayasend.clientes c ON c.id = m.cliente_id
      WHERE 1=1
        ${campaignFilter}
        ${repliedFilter}
      GROUP BY c.id, c.nombre, c.telefono, phones.phone, c.segmento
      ORDER BY c.nombre ASC NULLS LAST
    `)

    const headers = [
      'nombre',
      'telefono',
      'segmento',
      'campaña',
      'total_mensajes',
      'mensajes',
    ]
    const csvLines: string[] = [headers.join(',')]

    for (const row of rows) {
      const msgs: MsgJson[] = Array.isArray(row.mensajes) ? row.mensajes : []
      const mensajesStr = msgs
        .map((msg) => {
          const dir = msg.direction === 'inbound' ? 'IN' : 'OUT'
          const fecha = formatDate(msg.created_at)
          const texto =
            msg.text_body ??
            (msg.template_name ? `[template: ${msg.template_name}]` : '')
          return `[${fecha} ${dir}] ${texto}`
        })
        .join(' | ')

      const line = [
        escapeCSV(row.nombre ?? row.phone),
        escapeCSV(row.telefono_raw ?? row.phone),
        escapeCSV(row.segmento),
        escapeCSV(campaignNombre),
        escapeCSV(msgs.length),
        escapeCSV(mensajesStr),
      ].join(',')
      csvLines.push(line)
    }

    const bom = '﻿'
    const csv = bom + csvLines.join('\r\n')
    const filename = `chat-${campaignNombre.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
