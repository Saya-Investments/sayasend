import { NextRequest, NextResponse } from 'next/server'

import { requireSesion, respuestaError } from '@/lib/auth/server'
import { obtenerDetalle, puedeVerEtapa } from '@/lib/bot/queries'

export const runtime = 'nodejs'

// GET /api/bot/clientes/[etapaId] — datos, estados del bot, derivaciones y
// acciones del cliente, para el panel lateral de la lista.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ etapaId: string }> }) {
  try {
    const sesion = await requireSesion('admin', 'asesor')
    const { etapaId } = await params
    if (!/^[0-9a-f-]{36}$/i.test(etapaId) || !(await puedeVerEtapa(sesion, etapaId))) {
      return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
    }
    const detalle = await obtenerDetalle(etapaId)
    if (!detalle) {
      return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: detalle })
  } catch (error) {
    return respuestaError(error)
  }
}
