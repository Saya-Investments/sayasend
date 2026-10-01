import { NextRequest, NextResponse } from 'next/server'

import { excludeRetiros } from '@/lib/retiros'
import type { CampaignContact } from '@/lib/types'

export const runtime = 'nodejs'

// Vista previa para el formulario: qué contactos se quitarán por estar
// marcados como retiro si la campaña va al Bot Educador.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { contacts?: Array<Pick<CampaignContact, 'numDoc' | 'codigoAsociado'>> }

    if (!Array.isArray(body.contacts)) {
      return NextResponse.json({ success: false, error: 'contacts must be an array' }, { status: 400 })
    }

    const { excluded } = await excludeRetiros(body.contacts as CampaignContact[])

    return NextResponse.json({
      success: true,
      data: excluded.map((c) => ({ numDoc: c.numDoc, codigoAsociado: c.codigoAsociado })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      { success: false, error: `Failed to check retiros: ${message}` },
      { status: 500 },
    )
  }
}
