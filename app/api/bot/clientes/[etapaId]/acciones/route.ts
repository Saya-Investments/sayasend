import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { requireSesion, respuestaError } from '@/lib/auth/server'
import { RESULTADOS_ACCION, TIPOS_ACCION } from '@/lib/bot/constants'
import { puedeVerEtapa } from '@/lib/bot/queries'

export const runtime = 'nodejs'

// POST /api/bot/clientes/[etapaId]/acciones
// { tipo, resultado, observaciones?, duracionSeg?, incidenciaUuid? }
// Registra en el CRM lo que hizo el asesor. NO cambia nada en el bot: el
// resultado de la incidencia se marca aparte, contra el endpoint del bot.
export async function POST(request: NextRequest, { params }: { params: Promise<{ etapaId: string }> }) {
  try {
    const sesion = await requireSesion('admin', 'asesor')
    const { etapaId } = await params
    if (!/^[0-9a-f-]{36}$/i.test(etapaId) || !(await puedeVerEtapa(sesion, etapaId))) {
      return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
    }

    const body = (await request.json()) as {
      tipo?: string
      resultado?: string
      observaciones?: string
      duracionSeg?: number | string | null
      incidenciaUuid?: string | null
    }
    const tipo = TIPOS_ACCION.find((t) => t.value === body.tipo)
    const resultado = RESULTADOS_ACCION.find((r) => r.value === body.resultado)
    if (!tipo) {
      return NextResponse.json({ success: false, error: 'Tipo de acción inválido' }, { status: 400 })
    }
    if (!resultado) {
      return NextResponse.json({ success: false, error: 'Resultado inválido' }, { status: 400 })
    }

    // La incidencia, si viene, tiene que ser de esta misma etapa.
    let incidenciaId: string | null = null
    if (body.incidenciaUuid) {
      const i = await prisma.edu_incidencia.findFirst({
        where: { incidencia_uuid: body.incidenciaUuid, edu_etapa_cliente: { etapa_uuid: etapaId } },
        select: { incidencia_uuid: true },
      })
      incidenciaId = i?.incidencia_uuid ?? null
    }

    const duracion = Number(body.duracionSeg)
    const accion = await prisma.crmAccion.create({
      data: {
        etapaId,
        incidenciaId,
        idUsuario: sesion.sub,
        tipo: tipo.value,
        resultado: resultado.value,
        observaciones: body.observaciones?.trim() || null,
        duracionSeg: Number.isFinite(duracion) && duracion > 0 ? Math.round(duracion) : null,
      },
    })
    return NextResponse.json({ success: true, data: { id: accion.id } })
  } catch (error) {
    return respuestaError(error)
  }
}
