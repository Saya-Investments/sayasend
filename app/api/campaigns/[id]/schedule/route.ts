import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

function parseScheduledAt(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = (await request.json()) as { scheduledAt?: unknown }
    const scheduledAt = parseScheduledAt(body.scheduledAt)

    if (!scheduledAt) {
      return NextResponse.json(
        { success: false, error: 'scheduledAt debe ser una fecha valida.' },
        { status: 400 },
      )
    }

    if (scheduledAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { success: false, error: 'La fecha programada debe ser futura.' },
        { status: 400 },
      )
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaña no encontrada.' }, { status: 404 })
    }

    if (campaign.status === 'sending' || campaign.status === 'completed') {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden programar campañas en borrador o ya programadas.' },
        { status: 409 },
      )
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        status: 'scheduled',
        scheduledAt,
        startedAt: null,
        finishedAt: null,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    const updated = await prisma.campaign.updateMany({
      where: { id, status: 'scheduled' },
      data: {
        status: 'draft',
        scheduledAt: null,
      },
    })

    if (updated.count === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay una programación activa para cancelar.' },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
