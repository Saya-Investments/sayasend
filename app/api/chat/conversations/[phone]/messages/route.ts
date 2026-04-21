import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { sendTextMessage } from '@/lib/meta-message-service'

export const runtime = 'nodejs'

function normalizePhoneWithPlus(raw: string): string {
  const digits = String(raw || '').replace(/[^0-9]/g, '')
  return digits ? `+${digits}` : ''
}

// GET /api/chat/conversations/[phone]/messages?limit=100&offset=0
// Thread de mensajes de ese teléfono, ordenado asc por tiempo.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ phone: string }> },
) {
  try {
    const { phone: rawPhone } = await params
    const phone = normalizePhoneWithPlus(rawPhone)
    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'phone inválido' },
        { status: 400 },
      )
    }

    const url = new URL(request.url)
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 200), 500)
    const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0)

    const messages = await prisma.chatMessage.findMany({
      where: { phone },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip: offset,
    })

    // BigInt ids no serializan directo a JSON
    const serialized = messages.map((m) => ({ ...m, id: m.id.toString() }))

    return NextResponse.json({ success: true, data: serialized })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// POST /api/chat/conversations/[phone]/messages
// Body: { text: string }
// Envía free-text a Meta. Solo funciona si la ventana de 24h está abierta.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ phone: string }> },
) {
  try {
    const { phone: rawPhone } = await params
    const phone = normalizePhoneWithPlus(rawPhone)
    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'phone inválido' },
        { status: 400 },
      )
    }

    const body = (await request.json()) as { text?: string }
    const text = (body.text ?? '').trim()
    if (!text) {
      return NextResponse.json(
        { success: false, error: 'text es requerido' },
        { status: 400 },
      )
    }

    // Validar ventana 24h: debe haber inbound en las últimas 24h
    const lastInbound = await prisma.chatMessage.findFirst({
      where: { phone, direction: 'inbound' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })

    const now = Date.now()
    const windowOpen =
      !!lastInbound &&
      now - lastInbound.createdAt.getTime() < 24 * 60 * 60 * 1000

    if (!windowOpen) {
      return NextResponse.json(
        {
          success: false,
          error:
            'La ventana de 24 horas está cerrada — usa un template en vez de free-text',
          code: 'WINDOW_CLOSED',
        },
        { status: 409 },
      )
    }

    const { wamid } = await sendTextMessage(phone, text)

    // Si Meta no devolvió wamid por alguna razón, fallamos para no meter basura en DB
    if (!wamid) {
      return NextResponse.json(
        { success: false, error: 'Meta no devolvió wamid' },
        { status: 502 },
      )
    }

    // Match cliente por teléfono (opcional)
    const cliente = await prisma.cliente.findFirst({
      where: {
        telefono: {
          contains: phone.replace(/[^0-9]/g, ''),
        },
      },
      select: { id: true },
    })

    const created = await prisma.chatMessage.create({
      data: {
        wamid,
        direction: 'outbound',
        phone,
        clienteId: cliente?.id ?? null,
        messageType: 'text',
        textBody: text,
        status: 'sent',
      },
    })

    return NextResponse.json({
      success: true,
      data: { ...created, id: created.id.toString() },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const httpStatus = (error as { httpStatus?: number }).httpStatus ?? 500
    return NextResponse.json(
      { success: false, error: message },
      { status: httpStatus },
    )
  }
}
