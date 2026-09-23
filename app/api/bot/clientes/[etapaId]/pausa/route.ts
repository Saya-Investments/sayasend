import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { requireSesion, respuestaError } from '@/lib/auth/server'
import { pausarBot } from '@/lib/bot/bot-api'
import { puedeVerEtapa } from '@/lib/bot/queries'

export const runtime = 'nodejs'

// POST /api/bot/clientes/[etapaId]/pausa  { horas }
// "Tomar la conversación": el bot se calla mientras el asesor atiende.
export async function POST(request: NextRequest, { params }: { params: Promise<{ etapaId: string }> }) {
  try {
    const sesion = await requireSesion('admin', 'asesor')
    const { etapaId } = await params
    if (!/^[0-9a-f-]{36}$/i.test(etapaId) || !(await puedeVerEtapa(sesion, etapaId))) {
      return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
    }

    const { horas } = (await request.json()) as { horas?: number }
    const h = Number(horas)
    if (!Number.isFinite(h) || h <= 0 || h > 168) {
      return NextResponse.json({ success: false, error: 'Las horas deben estar entre 1 y 168' }, { status: 400 })
    }

    const etapa = await prisma.edu_etapa_cliente.findUnique({
      where: { etapa_uuid: etapaId },
      select: { etapa_cliente_id: true },
    })
    if (!etapa) {
      return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
    }

    const data = await pausarBot(etapa.etapa_cliente_id.toString(), Math.round(h))
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return respuestaError(error)
  }
}
