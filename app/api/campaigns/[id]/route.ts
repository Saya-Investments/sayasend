import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { id: true, status: true, startedAt: true },
    })

    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaña no encontrada.' }, { status: 404 })
    }

    if (campaign.status === 'sending') {
      return NextResponse.json(
        { success: false, error: 'No se puede borrar una campaña que se está enviando.' },
        { status: 409 },
      )
    }

    // Programada y ya reclamada por el scheduler: el envío está en camino, así
    // que borrarla dejaría mensajes saliendo sin campaña a la cual reportar.
    if (campaign.status === 'scheduled' && campaign.startedAt !== null) {
      return NextResponse.json(
        { success: false, error: 'El envío de esta campaña ya inició y no se puede borrar.' },
        { status: 409 },
      )
    }

    // campaign_contacts y mensaje_out cuelgan de la campaña con onDelete: Cascade
    // (y mensaje_status_event de mensaje_out), así que se van con ella. Los
    // `clientes` no: son compartidos entre campañas y se conservan.
    await prisma.campaign.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
