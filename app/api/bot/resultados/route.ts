import { NextResponse } from 'next/server'

import { requireSesion, respuestaError } from '@/lib/auth/server'
import { resultadosDeGestion, type ResultadoBot } from '@/lib/bot/bot-api'

export const runtime = 'nodejs'

// GET /api/bot/resultados — los resultados que puede marcar el asesor al cerrar
// una gestión. Los define el bot: el CRM no los hardcodea.
export async function GET() {
  try {
    await requireSesion('admin', 'asesor')
    const data = await resultadosDeGestion()
    const lista: ResultadoBot[] = Array.isArray(data) ? data : (data?.resultados ?? [])
    return NextResponse.json({ success: true, data: lista })
  } catch (error) {
    return respuestaError(error)
  }
}
