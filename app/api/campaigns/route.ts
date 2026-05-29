import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import type { CampaignContact, CreateCampaignPayload } from '@/lib/types'

export const runtime = 'nodejs'

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function toNullableDate(value: string | Date | null | undefined) {
  if (!value) {
    return null
  }

  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
    if (match) {
      const [, y, m, d] = match
      return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
    }
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toDecimal(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return new Prisma.Decimal(0)
  }

  return new Prisma.Decimal(value)
}

function normalizeTemplateId(templateId?: string | null) {
  if (!templateId) {
    return null
  }

  return isValidUuid(templateId) ? templateId : null
}

// Castea cualquier valor a string limpio. Para enteros evita la notación
// científica (que aparece al leer Excel/BigQuery con números grandes).
function toStringField(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') {
    if (Number.isFinite(value) && Number.isInteger(value)) {
      return value.toFixed(0)
    }
    return String(value).trim()
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value instanceof Date) return value.toISOString()
  return String(value).trim()
}

// Campos del cliente existente que miramos para el "fill-only" de Excel.
type ExistingClienteFields = {
  id: string
  dni: string
  codigoAsociado: string
  nombre: string | null
  telefono: string | null
  segmento: string | null
  estrategia: string | null
  frente: string | null
  mes: string | null
  mesPasado: string | null
  monto: Prisma.Decimal | null
  monto1: Prisma.Decimal | null
  monto2: Prisma.Decimal | null
  monto3: Prisma.Decimal | null
  probabilidad: Prisma.Decimal | null
  fechaAsamblea: Date | null
  fechaVencimiento: Date | null
  fecUltPagCcap: Date | null
  fechaVencimientoPasado: Date | null
}

const isBlankStr = (v: unknown) =>
  v === null || v === undefined || String(v).trim() === ''

const isZeroOrNullDecimal = (v: Prisma.Decimal | null | undefined) =>
  v === null || v === undefined || v.equals(0)

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateCampaignPayload

    if (!body.name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Campaign name is required' },
        { status: 400 },
      )
    }

    if (!body.databaseName?.trim()) {
      return NextResponse.json(
        { success: false, error: 'databaseName is required' },
        { status: 400 },
      )
    }

    if (!body.contacts?.length) {
      return NextResponse.json(
        { success: false, error: 'At least one contact is required' },
        { status: 400 },
      )
    }

    const templateId = normalizeTemplateId(body.templateId)
    if (!templateId) {
      return NextResponse.json(
        { success: false, error: 'templateId is required (must be a valid UUID)' },
        { status: 400 },
      )
    }

    const buildClienteData = (contact: CampaignContact) => ({
      codigoAsociado: toStringField(contact.codigoAsociado),
      dni: toStringField(contact.numDoc),
      telefono: toStringField(contact.telefono),
      nombre: contact.nombre || '',
      monto: toDecimal(contact.monto),
      monto1: contact.monto1 != null ? toDecimal(contact.monto1 as number) : null,
      monto2: contact.monto2 != null ? toDecimal(contact.monto2 as number) : null,
      monto3: contact.monto3 != null ? toDecimal(contact.monto3 as number) : null,
      probabilidad:
        contact.probabilidadPago === null || contact.probabilidadPago === undefined
          ? null
          : toDecimal(contact.probabilidadPago),
      segmento: contact.segmento || null,
      estrategia: contact.gestion || null,
      frente: contact.frente || null,
      fechaAsamblea: toNullableDate(contact.fechaAsamblea),
      fechaVencimiento: toNullableDate(contact.fechaVencimiento),
      fecUltPagCcap: toNullableDate(contact.fecUltPagCcap),
      mes: contact.mes || null,
      mesPasado: (contact.mesPasado as string | null | undefined) || null,
      fechaVencimientoPasado: toNullableDate(contact.fechaVencimientoPasado as string | null | undefined),
    })

    type ClienteData = ReturnType<typeof buildClienteData>

    // Fill-only para origen Excel. Un Excel suele traer menos columnas que la
    // data ya cargada desde BigQuery, así que cuando el cliente YA existe no lo
    // pisamos entero (eso borraría montos/fechas buenos con vacíos del Excel).
    // En cambio rellenamos solo los campos que están vacíos en la BD con lo que
    // el Excel sí trae — así se completan huecos (p. ej. el `nombre` faltante)
    // sin destruir nada. Devuelve {} si no hay nada que rellenar.
    const buildFillOnlyData = (
      existing: ExistingClienteFields,
      fresh: ClienteData,
    ): Prisma.ClienteUncheckedUpdateInput => {
      const fill: Prisma.ClienteUncheckedUpdateInput = {}

      // Strings: rellenar si la BD está vacía y el Excel trae algo.
      if (isBlankStr(existing.nombre) && !isBlankStr(fresh.nombre)) fill.nombre = String(fresh.nombre).trim()
      if (isBlankStr(existing.telefono) && !isBlankStr(fresh.telefono)) fill.telefono = String(fresh.telefono).trim()
      if (isBlankStr(existing.segmento) && !isBlankStr(fresh.segmento)) fill.segmento = String(fresh.segmento).trim()
      if (isBlankStr(existing.estrategia) && !isBlankStr(fresh.estrategia)) fill.estrategia = String(fresh.estrategia).trim()
      if (isBlankStr(existing.frente) && !isBlankStr(fresh.frente)) fill.frente = String(fresh.frente).trim()
      if (isBlankStr(existing.mes) && !isBlankStr(fresh.mes)) fill.mes = String(fresh.mes).trim()
      if (isBlankStr(existing.mesPasado) && !isBlankStr(fresh.mesPasado)) fill.mesPasado = String(fresh.mesPasado).trim()

      // Fechas: rellenar si la BD está en null y el Excel trae fecha.
      if (existing.fechaAsamblea === null && fresh.fechaAsamblea) fill.fechaAsamblea = fresh.fechaAsamblea
      if (existing.fechaVencimiento === null && fresh.fechaVencimiento) fill.fechaVencimiento = fresh.fechaVencimiento
      if (existing.fecUltPagCcap === null && fresh.fecUltPagCcap) fill.fecUltPagCcap = fresh.fecUltPagCcap
      if (existing.fechaVencimientoPasado === null && fresh.fechaVencimientoPasado) fill.fechaVencimientoPasado = fresh.fechaVencimientoPasado

      // Montos: el principal se rellena si la BD es 0/null y el Excel trae > 0;
      // monto1/2/3 y probabilidad si la BD está null y el Excel no.
      if (isZeroOrNullDecimal(existing.monto) && !isZeroOrNullDecimal(fresh.monto)) fill.monto = fresh.monto
      if (existing.monto1 === null && fresh.monto1 !== null) fill.monto1 = fresh.monto1
      if (existing.monto2 === null && fresh.monto2 !== null) fill.monto2 = fresh.monto2
      if (existing.monto3 === null && fresh.monto3 !== null) fill.monto3 = fresh.monto3
      if (existing.probabilidad === null && fresh.probabilidad !== null) fill.probabilidad = fresh.probabilidad

      return fill
    }

    const dnis = body.contacts.map((c) => toStringField(c.numDoc)).filter(Boolean)
    const codigos = body.contacts.map((c) => toStringField(c.codigoAsociado)).filter(Boolean)
    const isExcelSource = body.databaseName.trim().startsWith('EXCEL:')

    const result = await prisma.$transaction(
      async (tx) => {
        const campaignData: Prisma.CampaignUncheckedCreateInput = {
          nombre: body.name.trim(),
          templateId,
          databaseName: body.databaseName.trim(),
          sendMode: (body as { sendMode?: string }).sendMode ?? 'M0',
          segmentoFilter: body.segmentFilters.segmento || null,
          estrategiaFilter: body.segmentFilters.estrategia || null,
          frenteFilter: body.segmentFilters.frente || null,
          variableMappings: body.variableMappings ?? {},
          totalContacts: body.contacts.length,
          status: 'draft',
        }

        const campaign = await tx.campaign.create({ data: campaignData })

        const existingClientes = await tx.cliente.findMany({
          where: {
            OR: [{ dni: { in: dnis } }, { codigoAsociado: { in: codigos } }],
          },
          select: {
            id: true,
            dni: true,
            codigoAsociado: true,
            nombre: true,
            telefono: true,
            segmento: true,
            estrategia: true,
            frente: true,
            mes: true,
            mesPasado: true,
            monto: true,
            monto1: true,
            monto2: true,
            monto3: true,
            probabilidad: true,
            fechaAsamblea: true,
            fechaVencimiento: true,
            fecUltPagCcap: true,
            fechaVencimientoPasado: true,
          },
        })

        const byDni = new Map(existingClientes.map((c) => [c.dni, c.id]))
        const byCodigo = new Map(existingClientes.map((c) => [c.codigoAsociado, c.id]))
        const existingById = new Map(
          existingClientes.map((c) => [c.id, c] as [string, ExistingClienteFields]),
        )

        const toCreate: ReturnType<typeof buildClienteData>[] = []
        const toUpdate: Array<{ id: string; data: Prisma.ClienteUncheckedUpdateInput }> = []
        const existingClienteIds: string[] = []
        const seenDnis = new Set<string>()
        const seenCodigos = new Set<string>()

        for (const contact of body.contacts) {
          const data = buildClienteData(contact)
          const dni = toStringField(contact.numDoc)
          const codigo = toStringField(contact.codigoAsociado)
          const existingId = byDni.get(dni) ?? byCodigo.get(codigo)
          if (existingId) {
            if (isExcelSource) {
              // Excel: completar solo los campos vacíos del cliente existente,
              // sin pisar la data buena ya cargada (p. ej. desde BigQuery).
              const existing = existingById.get(existingId)
              const fill = existing ? buildFillOnlyData(existing, data) : {}
              if (Object.keys(fill).length > 0) {
                toUpdate.push({ id: existingId, data: fill })
              }
            } else {
              toUpdate.push({ id: existingId, data })
            }
            existingClienteIds.push(existingId)
          } else {
            if ((dni && seenDnis.has(dni)) || (codigo && seenCodigos.has(codigo))) {
              continue
            }
            if (dni) seenDnis.add(dni)
            if (codigo) seenCodigos.add(codigo)
            toCreate.push(data)
          }
        }

        await Promise.all(
          toUpdate.map(({ id, data }) => tx.cliente.update({ where: { id }, data })),
        )

        let createdClienteIds: string[] = []
        if (toCreate.length > 0) {
          const created = await tx.cliente.createManyAndReturn({
            data: toCreate,
            select: { id: true },
          })
          createdClienteIds = created.map((c) => c.id)
        }

        const allClienteIds = [...existingClienteIds, ...createdClienteIds]
        if (allClienteIds.length > 0) {
          await tx.campaignContact.createMany({
            data: allClienteIds.map((clienteId) => ({
              campaignId: campaign.id,
              clienteId,
              sendStatus: 'pending',
            })),
            skipDuplicates: true,
          })
        }

        return campaign
      },
      { timeout: 180000, maxWait: 15000 },
    )

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        success: false,
        error: `Failed to create campaign: ${message}`,
      },
      { status: 500 },
    )
  }
}
