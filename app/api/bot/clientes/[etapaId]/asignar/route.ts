import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { requireSesion, respuestaError } from '@/lib/auth/server'

export const runtime = 'nodejs'

// POST /api/bot/clientes/[etapaId]/asignar  { idAsesor }
// Solo admin. Asigna la etapa del cliente a un asesor; a partir de ahí el
// asesor ve a ese cliente y sus tareas.
export async function POST(request: NextRequest, { params }: { params: Promise<{ etapaId: string }> }) {
  try {
    const sesion = await requireSesion('admin')
    const { etapaId } = await params
    const { idAsesor } = (await request.json()) as { idAsesor?: string }

    const [etapa, asesor] = await Promise.all([
      /^[0-9a-f-]{36}$/i.test(etapaId)
        ? prisma.edu_etapa_cliente.findUnique({ where: { etapa_uuid: etapaId }, select: { etapa_uuid: true } })
        : null,
      idAsesor
        ? prisma.crmUsuario.findUnique({ where: { id: idAsesor }, select: { id: true, rol: true, activo: true } })
        : null,
    ])
    if (!etapa) {
      return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
    }
    if (!asesor || asesor.rol !== 'asesor' || !asesor.activo) {
      return NextResponse.json({ success: false, error: 'Elige un asesor activo' }, { status: 400 })
    }

    await prisma.$transaction([
      prisma.crmAsignacion.upsert({
        where: { etapaId: etapa.etapa_uuid },
        create: { etapaId: etapa.etapa_uuid, idAsesor: asesor.id, asignadoPor: sesion.sub },
        update: { idAsesor: asesor.id, asignadoPor: sesion.sub, asignadoAt: new Date() },
      }),
      prisma.crmAsignacionHistorial.create({
        data: { etapaId: etapa.etapa_uuid, idAsesor: asesor.id, asignadoPor: sesion.sub },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    return respuestaError(error)
  }
}
