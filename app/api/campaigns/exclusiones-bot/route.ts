import { NextRequest, NextResponse } from 'next/server'

import { excludeForBot } from '@/lib/exclusiones-bot'
import type { CampaignContact, EtapaBot } from '@/lib/types'

export const runtime = 'nodejs'

// Vista previa para el formulario: qué contactos se quitarán si la campaña va
// al Bot Educador (retiro, o contrato en Admisión si es Pre-admisión).
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      contacts?: Array<Pick<CampaignContact, 'numDoc' | 'codigoAsociado' | 'nombre'>>
      etapaBot?: unknown
    }

    if (!Array.isArray(body.contacts)) {
      return NextResponse.json({ success: false, error: 'contacts must be an array' }, { status: 400 })
    }
    if (body.etapaBot !== 'PRE_ADMISION' && body.etapaBot !== 'ADMISION') {
      return NextResponse.json({ success: false, error: 'etapaBot must be PRE_ADMISION or ADMISION' }, { status: 400 })
    }

    const { excluded } = await excludeForBot(body.contacts as CampaignContact[], body.etapaBot as EtapaBot)

    return NextResponse.json({ success: true, data: excluded })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      { success: false, error: `Failed to check exclusions: ${message}` },
      { status: 500 },
    )
  }
}
