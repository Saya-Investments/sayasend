import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import * as XLSX from 'xlsx'

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
// Exporta un Excel con una fila por cliente y sus mensajes concatenados.
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const campaignIdRaw = url.searchParams.get('campaignId')
    const campaignId =
      campaignIdRaw && campaignIdRaw !== 'all' ? campaignIdRaw : null
    const onlyReplied = url.searchParams.get('onlyReplied') === 'true'

    const campaignFilter = campaignId
      ? Prisma.sql`AND cm.phone IN (
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
          WHERE inb.phone = cm.phone AND inb.direction = 'inbound'
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

    // La clave del fix: JOIN clientes por teléfono normalizado (no por cliente_id
    // del mensaje) para que todos los mensajes inbound/outbound queden en una sola fila.
    const rows = await prisma.$queryRaw<ClientRow[]>(Prisma.sql`
      SELECT
        phones.phone               AS phone,
        cli.id                     AS cliente_id,
        cli.nombre                 AS nombre,
        cli.telefono               AS telefono_raw,
        cli.segmento               AS segmento,
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
        SELECT DISTINCT cm.phone
        FROM sayasend.chat_messages cm
        WHERE 1=1
          ${campaignFilter}
          ${repliedFilter}
      ) phones
      JOIN sayasend.chat_messages m ON m.phone = phones.phone
      LEFT JOIN sayasend.clientes cli ON (
        CASE
          WHEN length(regexp_replace(cli.telefono, '[^0-9]', '', 'g')) = 10
          THEN '+57' || regexp_replace(cli.telefono, '[^0-9]', '', 'g')
          ELSE '+' || regexp_replace(cli.telefono, '[^0-9]', '', 'g')
        END = phones.phone
      )
      GROUP BY phones.phone, cli.id, cli.nombre, cli.telefono, cli.segmento
      ORDER BY cli.nombre ASC NULLS LAST
    `)

    const sheetData: Record<string, unknown>[] = rows.map((row) => {
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
        .join('\n')

      return {
        Nombre: row.nombre ?? row.phone,
        Teléfono: row.telefono_raw ?? row.phone,
        Segmento: row.segmento ?? '',
        Campaña: campaignNombre,
        'Total mensajes': msgs.length,
        Mensajes: mensajesStr,
      }
    })

    const ws = XLSX.utils.json_to_sheet(sheetData)

    // Anchos de columna
    ws['!cols'] = [
      { wch: 30 }, // Nombre
      { wch: 18 }, // Teléfono
      { wch: 14 }, // Segmento
      { wch: 28 }, // Campaña
      { wch: 16 }, // Total mensajes
      { wch: 80 }, // Mensajes
    ]

    // Ajuste de texto en la columna Mensajes (columna F)
    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
    for (let r = 1; r <= range.e.r; r++) {
      const cellRef = XLSX.utils.encode_cell({ r, c: 5 })
      if (ws[cellRef]) {
        ws[cellRef].s = { alignment: { wrapText: true, vertical: 'top' } }
      }
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Chat')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const safeName = campaignNombre.replace(/[^a-z0-9]/gi, '-')
    const filename = `chat-${safeName}-${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
