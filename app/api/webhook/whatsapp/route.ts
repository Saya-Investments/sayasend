import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// ============================================================================
// GET — handshake de verificación de Meta
// ============================================================================
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN

  if (!verifyToken) {
    console.error('[WEBHOOK] WHATSAPP_VERIFY_TOKEN no está configurado')
    return new NextResponse('Server misconfigured', { status: 500 })
  }

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    console.log('[WEBHOOK] Verificado')
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse('Forbidden', { status: 403 })
}

// ============================================================================
// POST — recibe eventos de Meta (statuses, messages, errors)
// ============================================================================
type MetaStatus = {
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed' | string
  timestamp: string
  recipient_id?: string
  pricing?: unknown
  conversation?: unknown
  errors?: Array<{ code?: number; title?: string; message?: string }>
}

type MetaMessage = {
  from: string
  id: string
  timestamp: string
  text?: { body?: string }
  interactive?: { button_reply?: { title?: string } }
  type?: string
}

type MetaError = {
  code?: number
  title?: string
  message?: string
}

type MetaWebhookValue = {
  messages?: MetaMessage[]
  statuses?: MetaStatus[]
  errors?: MetaError[]
}

type MetaWebhookBody = {
  entry?: Array<{
    id?: string
    changes?: Array<{
      field?: string
      value?: MetaWebhookValue
    }>
  }>
}

export async function POST(request: NextRequest) {
  // Respondemos 200 inmediatamente para que Meta no reintente.
  // El procesamiento se hace best-effort tras la respuesta.
  let body: MetaWebhookBody
  try {
    body = (await request.json()) as MetaWebhookBody
  } catch {
    return NextResponse.json({ received: false, error: 'Invalid JSON' }, { status: 400 })
  }

  // Log crudo del webhook
  try {
    await prisma.webhookLog.create({
      data: {
        eventType: body.entry?.[0]?.changes?.[0]?.field ?? 'unknown',
        payload: body as object,
      },
    })
  } catch (error) {
    console.warn('[WEBHOOK] No se pudo guardar webhook_log:', (error as Error).message)
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {}
      if (value.statuses?.length) await handleStatuses(value.statuses)
      if (value.messages?.length) await handleIncomingMessages(value.messages)
      if (value.errors?.length) handleErrors(value.errors)
    }
  }

  return NextResponse.json({ received: true, timestamp: new Date().toISOString() })
}

// ============================================================================
// Handlers
// ============================================================================

async function handleStatuses(statuses: MetaStatus[]) {
  for (const status of statuses) {
    const messageId = status.id
    const statusType = status.status
    const tsUnix = Number(status.timestamp)
    const ts = Number.isFinite(tsUnix) ? new Date(tsUnix * 1000) : new Date()

    // 1. Historial granular en mensaje_status_event (append-only)
    try {
      await prisma.mensajeStatusEvent.create({
        data: {
          idMsg: messageId,
          estado: statusType,
          tsUnix: Number.isFinite(tsUnix) ? BigInt(tsUnix) : null,
          recipientId: status.recipient_id ?? null,
          pricingJson: (status.pricing as object) ?? undefined,
          conversationJson: (status.conversation as object) ?? undefined,
          errorsJson: (status.errors as object) ?? undefined,
        },
      })
    } catch (error) {
      console.warn(
        `[WEBHOOK] Error insertando status_event para ${messageId}:`,
        (error as Error).message,
      )
    }

    // 2. Actualizar estado actual en campaign_contacts
    const data: Record<string, unknown> = {}
    if (statusType === 'sent') data.sentAt = ts
    else if (statusType === 'delivered') {
      data.deliveredAt = ts
      data.sendStatus = 'delivered'
    } else if (statusType === 'read') {
      data.readAt = ts
      data.sendStatus = 'read'
    } else if (statusType === 'failed') {
      data.failedAt = ts
      data.sendStatus = 'failed'
      const firstError = status.errors?.[0]
      if (firstError) {
        data.failureCode = String(firstError.code ?? '').substring(0, 50) || null
        data.failureReason = firstError.message?.substring(0, 500) ?? null
      }
    }

    if (Object.keys(data).length === 0) continue

    try {
      const updated = await prisma.campaignContact.updateMany({
        where: { whatsappMessageId: messageId },
        data,
      })
      if (updated.count > 0) {
        console.log(`[WEBHOOK] ${messageId} → ${statusType}`)
      } else {
        console.log(`[WEBHOOK] message_id no encontrado en campaign_contacts: ${messageId}`)
      }
    } catch (error) {
      console.warn(
        `[WEBHOOK] Error actualizando campaign_contact para ${messageId}:`,
        (error as Error).message,
      )
    }
  }
}

async function handleIncomingMessages(messages: MetaMessage[]) {
  for (const message of messages) {
    const from = message.from
    const text = message.text?.body ?? message.interactive?.button_reply?.title ?? '[non-text]'
    console.log(`[WEBHOOK] Incoming de ${from}: "${text}"`)

    try {
      const cleanPhone = from.replace(/[^0-9]/g, '')
      const last10 = cleanPhone.slice(-10)

      const cliente = await prisma.cliente.findFirst({
        where: { telefono: { endsWith: last10 } },
      })
      if (!cliente) {
        console.log(`[WEBHOOK] Cliente no encontrado para ${from}`)
        continue
      }

      const latestContact = await prisma.campaignContact.findFirst({
        where: { clienteId: cliente.id },
        orderBy: { sentAt: 'desc' },
      })
      if (latestContact) {
        await prisma.campaignContact.update({
          where: { id: latestContact.id },
          data: { repliedAt: new Date() },
        })
        console.log(`[WEBHOOK] ${cliente.nombre} respondió`)
      }
    } catch (error) {
      console.warn('[WEBHOOK] Error procesando incoming message:', (error as Error).message)
    }
  }
}

function handleErrors(errors: MetaError[]) {
  for (const err of errors) {
    console.error(`[WEBHOOK] Error ${err.code}: ${err.title} — ${err.message}`)
  }
}
