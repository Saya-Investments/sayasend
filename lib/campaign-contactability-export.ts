import { prisma } from '@/lib/prisma'
import type { ContactabilityScope } from '@/lib/campaign-contactability'

type AttemptStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'

type StatusEventLite = {
  estado: string
  errorsJson: unknown
  createdAt: Date
}

type MessageLite = {
  phoneTo: string
  sentAt: Date
  statusEvents: StatusEventLite[]
}

type AttemptResult = {
  status: AttemptStatus
  sentAt: Date | null
  deliveredAt: Date | null
  readAt: Date | null
  failedAt: Date | null
  failureCode: string
  failureReason: string
}

export type ContactabilityExportRow = {
  codigoAsociado: string
  dni: string
  nombre: string
  telefonoPrincipal: string
  telefonoSecundario: string
  telefonoEvaluado: string
  origenResultado: 'principal' | 'alterno'
  tieneTelefonoSecundario: boolean
  reintentado: boolean
  estado: AttemptStatus
  segmento: string
  estrategia: string
  frente: string
  monto: string
  sentAt: Date | null
  deliveredAt: Date | null
  readAt: Date | null
  failedAt: Date | null
  failureCode: string
  failureReason: string
}

const STATUS_RANK: Record<AttemptStatus, number> = {
  pending: 0,
  failed: 1,
  sent: 2,
  delivered: 3,
  read: 4,
}

function normalizedPhone(value: string | null | undefined) {
  const digits = value?.replace(/[^0-9]/g, '') ?? ''
  return digits ? digits.slice(-10) : ''
}

function eventHasErrors(errorsJson: unknown) {
  return Array.isArray(errorsJson) && errorsJson.length > 0
}

function messageStatus(message: MessageLite): AttemptStatus {
  if (
    message.statusEvents.some(
      (event) => event.estado === 'failed' || eventHasErrors(event.errorsJson),
    )
  ) {
    return 'failed'
  }
  if (message.statusEvents.some((event) => event.estado === 'read')) return 'read'
  if (message.statusEvents.some((event) => event.estado === 'delivered')) return 'delivered'
  return 'sent'
}

function minDate(values: Array<Date | null | undefined>) {
  const dates = values.filter((value): value is Date => value instanceof Date)
  return dates.length > 0
    ? new Date(Math.min(...dates.map((value) => value.getTime())))
    : null
}

function maxDate(values: Array<Date | null | undefined>) {
  const dates = values.filter((value): value is Date => value instanceof Date)
  return dates.length > 0
    ? new Date(Math.max(...dates.map((value) => value.getTime())))
    : null
}

function eventErrorValues(events: StatusEventLite[]) {
  const codes = new Set<string>()
  const reasons = new Set<string>()

  for (const event of events) {
    if (!Array.isArray(event.errorsJson)) continue
    for (const rawError of event.errorsJson) {
      if (!rawError || typeof rawError !== 'object' || Array.isArray(rawError)) continue
      const error = rawError as Record<string, unknown>
      if (error.code !== null && error.code !== undefined) codes.add(String(error.code))

      const errorData =
        error.error_data && typeof error.error_data === 'object' && !Array.isArray(error.error_data)
          ? (error.error_data as Record<string, unknown>)
          : null
      const reason = errorData?.details ?? error.message ?? error.title
      if (reason !== null && reason !== undefined) reasons.add(String(reason))
    }
  }

  return {
    code: Array.from(codes).join(' | '),
    reason: Array.from(reasons).join(' | '),
  }
}

function attemptResult(
  messages: MessageLite[],
  storedFailureCode: string | null,
  storedFailureReason: string | null,
  fallbackFailedAt: Date | null,
): AttemptResult | null {
  const events = messages.flatMap((message) => message.statusEvents)
  const eventErrors = eventErrorValues(events)

  if (storedFailureCode?.trim()) {
    return {
      status: 'failed',
      sentAt: minDate(messages.map((message) => message.sentAt)),
      deliveredAt: null,
      readAt: null,
      failedAt:
        maxDate(
          events
            .filter((event) => event.estado === 'failed' || eventHasErrors(event.errorsJson))
            .map((event) => event.createdAt),
        ) ?? fallbackFailedAt,
      failureCode: storedFailureCode.trim(),
      failureReason: storedFailureReason?.trim() ?? eventErrors.reason,
    }
  }

  if (messages.length === 0) return null

  const status = messages
    .map(messageStatus)
    .sort((a, b) => STATUS_RANK[b] - STATUS_RANK[a])[0]

  return {
    status,
    sentAt: minDate(messages.map((message) => message.sentAt)),
    deliveredAt: maxDate(
      events
        .filter((event) => event.estado === 'delivered' || event.estado === 'read')
        .map((event) => event.createdAt),
    ),
    readAt: maxDate(
      events.filter((event) => event.estado === 'read').map((event) => event.createdAt),
    ),
    failedAt: maxDate(
      events
        .filter((event) => event.estado === 'failed' || eventHasErrors(event.errorsJson))
        .map((event) => event.createdAt),
    ),
    failureCode: status === 'failed' ? eventErrors.code : '',
    failureReason: status === 'failed' ? eventErrors.reason : '',
  }
}

function pendingResult(reason: string): AttemptResult {
  return {
    status: 'pending',
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    failedAt: null,
    failureCode: '',
    failureReason: reason,
  }
}

export async function getCampaignContactabilityExportRows(
  campaignId: string,
  scope: ContactabilityScope,
): Promise<ContactabilityExportRow[]> {
  const contacts = await prisma.campaignContact.findMany({
    where: { campaignId },
    include: {
      cliente: true,
      mensajeOuts: {
        include: { statusEvents: true },
        orderBy: { sentAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const rows: ContactabilityExportRow[] = []

  for (const contact of contacts) {
    const principalPhone = contact.phone1?.trim() || contact.cliente.telefono
    const alternatePhone = contact.phone2?.trim() || contact.cliente.telefono3?.trim() || ''
    const hasAlternate =
      normalizedPhone(alternatePhone) !== '' &&
      normalizedPhone(alternatePhone) !== normalizedPhone(principalPhone)

    const principalMessages: MessageLite[] = []
    const alternateMessages: MessageLite[] = []
    for (const message of contact.mensajeOuts) {
      const isAlternate =
        hasAlternate &&
        normalizedPhone(message.phoneTo) === normalizedPhone(alternatePhone) &&
        normalizedPhone(message.phoneTo) !== normalizedPhone(principalPhone)
      ;(isAlternate ? alternateMessages : principalMessages).push(message)
    }

    let principal = attemptResult(
      principalMessages,
      contact.failureCode1,
      contact.failureReason1,
      contact.failedAt,
    )
    if (
      !principal &&
      !contact.phone2 &&
      contact.retryCount === 0 &&
      ['sent', 'delivered', 'read', 'failed'].includes(contact.sendStatus)
    ) {
      principal = {
        status: contact.sendStatus as AttemptStatus,
        sentAt: contact.sentAt,
        deliveredAt: contact.deliveredAt,
        readAt: contact.readAt,
        failedAt: contact.failedAt,
        failureCode: contact.failureCode ?? '',
        failureReason: contact.failureReason ?? '',
      }
    }
    principal ??= pendingResult('Primer intento pendiente')

    const alternate = attemptResult(
      alternateMessages,
      contact.failureCode2,
      contact.failureReason2,
      contact.failedAt,
    )
    const retried =
      contact.retryCount > 0 ||
      Boolean(contact.phone2?.trim()) ||
      Boolean(contact.failureCode2?.trim()) ||
      alternateMessages.length > 0

    let selected: AttemptResult
    let resultOrigin: 'principal' | 'alterno'
    let evaluatedPhone: string

    if (scope === 'principal') {
      selected = principal
      resultOrigin = 'principal'
      evaluatedPhone = principalPhone
    } else if (scope === 'alterno') {
      if (principal.status !== 'failed') continue
      selected =
        alternate ??
        pendingResult(
          !hasAlternate
            ? 'Sin teléfono secundario disponible'
            : retried
              ? 'Reintento pendiente'
              : 'Reintento no registrado',
        )
      resultOrigin = 'alterno'
      evaluatedPhone = hasAlternate ? alternatePhone : ''
    } else if (
      principal.status === 'failed' &&
      alternate &&
      ['sent', 'delivered', 'read'].includes(alternate.status)
    ) {
      selected = alternate
      resultOrigin = 'alterno'
      evaluatedPhone = alternatePhone
    } else if (principal.status === 'failed' && alternate?.status === 'failed') {
      selected = alternate
      resultOrigin = 'alterno'
      evaluatedPhone = alternatePhone
    } else {
      selected = principal
      resultOrigin = 'principal'
      evaluatedPhone = principalPhone
    }

    rows.push({
      codigoAsociado: contact.cliente.codigoAsociado.replace(/,\s*/g, ' | '),
      dni: contact.cliente.dni,
      nombre: contact.cliente.nombre,
      telefonoPrincipal: principalPhone,
      telefonoSecundario: alternatePhone,
      telefonoEvaluado: evaluatedPhone,
      origenResultado: resultOrigin,
      tieneTelefonoSecundario: hasAlternate,
      reintentado: retried,
      estado: selected.status,
      segmento: contact.cliente.segmento ?? '',
      estrategia: contact.cliente.estrategia ?? '',
      frente: contact.cliente.frente ?? '',
      monto: contact.cliente.monto.toString(),
      sentAt: selected.sentAt,
      deliveredAt: selected.deliveredAt,
      readAt: selected.readAt,
      failedAt: selected.failedAt,
      failureCode: selected.failureCode,
      failureReason: selected.failureReason,
    })
  }

  return rows
}
