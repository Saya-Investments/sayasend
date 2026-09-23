import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { requireSesion, respuestaError } from '@/lib/auth/server'
import { cerrarGestion } from '@/lib/bot/bot-api'
import { puedeVerIncidencia } from '@/lib/bot/queries'

export const runtime = 'nodejs'

// POST /api/bot/incidencias/[incidenciaUuid]/cerrar
// { resultado, observaciones?, agendadaPara? }
// Va por el endpoint del bot, NO por UPDATE directo: el bot aplica el efecto
// del resultado, cierra (o no) la incidencia y escribe el ledger del score.
// Los resultados válidos los define el bot (GET /bot/resultados): acá no se
// hardcodean, solo se exige que venga uno y que SEGUIMIENTO traiga fecha.
export async function POST(request: NextRequest, { params }: { params: Promise<{ incidenciaUuid: string }> }) {
  try {
    const sesion = await requireSesion('admin', 'asesor')
    const { incidenciaUuid } = await params
    const body = (await request.json()) as {
      resultado?: string
      observaciones?: string
      agendadaPara?: string
    }
    const resultado = (body.resultado ?? '').trim().toUpperCase()

    if (!resultado) {
      return NextResponse.json({ success: false, error: 'Elige un resultado' }, { status: 400 })
    }
    if (resultado === 'SEGUIMIENTO' && !body.agendadaPara) {
      return NextResponse.json(
        { success: false, error: 'Un seguimiento necesita la fecha en que lo vas a retomar' },
        { status: 400 },
      )
    }
    if (!/^[0-9a-f-]{36}$/i.test(incidenciaUuid) || !(await puedeVerIncidencia(sesion, incidenciaUuid))) {
      return NextResponse.json({ success: false, error: 'Incidencia no encontrada' }, { status: 404 })
    }

    const incidencia = await prisma.edu_incidencia.findUnique({
      where: { incidencia_uuid: incidenciaUuid },
      select: { incidencia_id: true, derivada_en: true, atendida_en: true },
    })
    if (!incidencia || !incidencia.derivada_en) {
      return NextResponse.json({ success: false, error: 'Esta incidencia no está derivada' }, { status: 404 })
    }
    if (incidencia.atendida_en) {
      return NextResponse.json({ success: false, error: 'La incidencia ya fue atendida' }, { status: 409 })
    }

    // El bot identifica la incidencia por su bigint, no por el uuid del CRM.
    const data = await cerrarGestion(incidencia.incidencia_id.toString(), {
      resultado,
      asesor: sesion.email,
      ...(body.observaciones?.trim() ? { observaciones: body.observaciones.trim() } : {}),
      ...(body.agendadaPara ? { agendada_para: body.agendadaPara } : {}),
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return respuestaError(error)
  }
}
