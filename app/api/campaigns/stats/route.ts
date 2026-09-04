import { NextRequest, NextResponse } from 'next/server'

import { getCampaignGlobalSendStats } from '@/lib/campaign-contactability'

export const runtime = 'nodejs'

// La consulta de contactabilidad recorre contactos, mensajes y eventos de
// estado, así que solo se pide para las campañas que la tabla está mostrando.
const MAX_IDS = 50

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { ids?: unknown }

    if (!Array.isArray(body.ids)) {
      return NextResponse.json({ success: false, error: 'ids must be an array' }, { status: 400 })
    }

    const ids = body.ids.filter((id): id is string => typeof id === 'string' && UUID_RE.test(id))

    if (ids.length > MAX_IDS) {
      return NextResponse.json(
        { success: false, error: `At most ${MAX_IDS} ids per request` },
        { status: 400 },
      )
    }

    const stats = await getCampaignGlobalSendStats(ids)

    return NextResponse.json({
      success: true,
      data: Object.fromEntries(stats),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      { success: false, error: `Failed to load campaign stats: ${message}` },
      { status: 500 },
    )
  }
}
