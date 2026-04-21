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
        { success: false, error: 'templateId is required and must be a valid UUID' },
        { status: 400 },
      )
    }

    const buildClienteData = (contact: CampaignContact) => ({
      codigoAsociado: contact.codigoAsociado,
      dni: contact.numDoc,
      telefono: contact.telefono || '',
      nombre: contact.nombre || '',
      monto: toDecimal(contact.monto),
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
    })

    const dnis = body.contacts.map((c) => c.numDoc).filter(Boolean)
    const codigos = body.contacts.map((c) => c.codigoAsociado).filter(Boolean)

    const result = await prisma.$transaction(
      async (tx) => {
        const campaign = await tx.campaign.create({
          data: {
            nombre: body.name.trim(),
            templateId,
            databaseName: body.databaseName.trim(),
            sendMode: 'M0',
            segmentoFilter: body.segmentFilters.segmento || null,
            estrategiaFilter: body.segmentFilters.estrategia || null,
            frenteFilter: body.segmentFilters.frente || null,
            variableMappings: body.variableMappings ?? {},
            totalContacts: body.contacts.length,
            status: 'draft',
          },
        })

        const existingClientes = await tx.cliente.findMany({
          where: {
            OR: [{ dni: { in: dnis } }, { codigoAsociado: { in: codigos } }],
          },
          select: { id: true, dni: true, codigoAsociado: true },
        })

        const byDni = new Map(existingClientes.map((c) => [c.dni, c.id]))
        const byCodigo = new Map(existingClientes.map((c) => [c.codigoAsociado, c.id]))

        const toCreate: ReturnType<typeof buildClienteData>[] = []
        const toUpdate: Array<{ id: string; data: ReturnType<typeof buildClienteData> }> = []
        const existingClienteIds: string[] = []

        for (const contact of body.contacts) {
          const data = buildClienteData(contact)
          const existingId = byDni.get(contact.numDoc) ?? byCodigo.get(contact.codigoAsociado)
          if (existingId) {
            toUpdate.push({ id: existingId, data })
            existingClienteIds.push(existingId)
          } else {
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
      { timeout: 60000, maxWait: 15000 },
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
