import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type ConversationRow = {
  phone: string
  last_message_at: Date
  last_direction: string
  last_text: string | null
  last_type: string | null
  cliente_id: string | null
  cliente_nombre: string | null
  last_inbound_at: Date | null
  window_open: boolean
}

// GET /api/chat/conversations?campaignId=<uuid>&onlyReplied=true
// - campaignId: filtra a conversaciones cuyos clientes están en esa campaña.
// - onlyReplied: si 'true', descarta conversaciones sin inbound.
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const campaignIdRaw = url.searchParams.get('campaignId')
    const campaignId =
      campaignIdRaw && campaignIdRaw !== 'all' ? campaignIdRaw : null
    const onlyReplied = url.searchParams.get('onlyReplied') === 'true'

    const campaignFilter = campaignId
      ? Prisma.sql`AND l.phone IN (
          SELECT DISTINCT '+' || regexp_replace(cli.telefono, '[^0-9]', '', 'g')
          FROM sayasend.campaign_contacts cc
          JOIN sayasend.clientes cli ON cli.id = cc.cliente_id
          WHERE cc.campaign_id = ${campaignId}::uuid
        )`
      : Prisma.empty

    const repliedFilter = onlyReplied
      ? Prisma.sql`AND li.last_inbound_at IS NOT NULL`
      : Prisma.empty

    const rows = await prisma.$queryRaw<ConversationRow[]>(Prisma.sql`
      WITH latest_per_phone AS (
        SELECT DISTINCT ON (phone)
          phone, created_at, direction, text_body, message_type, cliente_id
        FROM sayasend.chat_messages
        ORDER BY phone, created_at DESC
      ),
      last_inbound AS (
        SELECT phone, MAX(created_at) AS last_inbound_at
        FROM sayasend.chat_messages
        WHERE direction = 'inbound'
        GROUP BY phone
      )
      SELECT
        l.phone                          AS phone,
        l.created_at                     AS last_message_at,
        l.direction                      AS last_direction,
        l.text_body                      AS last_text,
        l.message_type                   AS last_type,
        c.id                             AS cliente_id,
        c.nombre                         AS cliente_nombre,
        li.last_inbound_at               AS last_inbound_at,
        (li.last_inbound_at IS NOT NULL
         AND li.last_inbound_at > NOW() - INTERVAL '24 hours') AS window_open
      FROM latest_per_phone l
      LEFT JOIN sayasend.clientes c ON c.id = l.cliente_id
      LEFT JOIN last_inbound li     ON li.phone = l.phone
      WHERE 1=1
        ${campaignFilter}
        ${repliedFilter}
      ORDER BY l.created_at DESC
      LIMIT 500;
    `)

    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
