import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { requireSesion, respuestaError } from '@/lib/auth/server'
import { sendTextMessage } from '@/lib/meta-message-service'
import { mensajesDeCliente, puedeVerEtapa, type MensajeBot } from '@/lib/bot/queries'

export const runtime = 'nodejs'

const VENTANA_MS = 24 * 60 * 60 * 1000

// La conversación completa está en chat_messages: se busca por cliente.
async function etapaVisible(etapaId: string) {
  const sesion = await requireSesion('admin', 'asesor')
  if (!/^[0-9a-f-]{36}$/i.test(etapaId) || !(await puedeVerEtapa(sesion, etapaId))) return null
  return prisma.edu_etapa_cliente.findUnique({
    where: { etapa_uuid: etapaId },
    select: { etapa_cliente_id: true, cliente_id: true, clientes: { select: { telefono: true } } },
  })
}

function ventanaAbierta(mensajes: MensajeBot[]) {
  const ultimoEntrante = [...mensajes].reverse().find((m) => m.direction === 'inbound')
  return !!ultimoEntrante && Date.now() - new Date(ultimoEntrante.createdAt).getTime() < VENTANA_MS
}

// GET /api/bot/clientes/[etapaId]/mensajes — conversación con lo que el bot
// entendió de cada mensaje del cliente.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ etapaId: string }> }) {
  try {
    const { etapaId } = await params
    const etapa = await etapaVisible(etapaId)
    if (!etapa) {
      return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
    }
    const mensajes = await mensajesDeCliente(etapa.cliente_id, etapa.clientes.telefono)
    return NextResponse.json({ success: true, data: { mensajes, ventanaAbierta: ventanaAbierta(mensajes) } })
  } catch (error) {
    return respuestaError(error)
  }
}

// POST /api/bot/clientes/[etapaId]/mensajes  { text }
// Texto libre del asesor. Se guarda con origen 'CRM'.
export async function POST(request: NextRequest, { params }: { params: Promise<{ etapaId: string }> }) {
  try {
    const { etapaId } = await params
    const etapa = await etapaVisible(etapaId)
    if (!etapa) {
      return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
    }

    const { text } = (await request.json()) as { text?: string }
    const texto = (text ?? '').trim()
    if (!texto) {
      return NextResponse.json({ success: false, error: 'Escribe un mensaje' }, { status: 400 })
    }

    const mensajes = await mensajesDeCliente(etapa.cliente_id, etapa.clientes.telefono, 50)
    if (!ventanaAbierta(mensajes)) {
      return NextResponse.json(
        {
          success: false,
          error: 'La ventana de 24 horas está cerrada: el cliente tiene que escribir primero',
          code: 'WINDOW_CLOSED',
        },
        { status: 409 },
      )
    }

    const phone = `+${etapa.clientes.telefono.replace(/[^0-9]/g, '')}`
    const { wamid } = await sendTextMessage(phone, texto)
    if (!wamid) {
      return NextResponse.json({ success: false, error: 'Meta no devolvió wamid' }, { status: 502 })
    }

    await prisma.chatMessage.create({
      data: {
        wamid,
        direction: 'outbound',
        phone,
        clienteId: etapa.cliente_id,
        messageType: 'text',
        textBody: texto,
        status: 'sent',
        origen: 'CRM',
        edu_etapa_id: etapa.etapa_cliente_id,
      },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    const httpStatus = (error as { httpStatus?: number }).httpStatus
    if (httpStatus) {
      const message = error instanceof Error ? error.message : 'Error de Meta'
      return NextResponse.json({ success: false, error: message }, { status: httpStatus })
    }
    return respuestaError(error)
  }
}
