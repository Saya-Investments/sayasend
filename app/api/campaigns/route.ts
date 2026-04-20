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

    const result = await prisma.$transaction(async (tx) => {
      const campaignData: Prisma.CampaignUncheckedCreateInput = {
        nombre: body.name.trim(),
        templateId: normalizeTemplateId(body.templateId) ?? undefined,
        databaseName: body.databaseName.trim(),
        segmentoFilter: body.segmentFilters.segmento || null,
        estrategiaFilter: body.segmentFilters.estrategia || null,
        frenteFilter: body.segmentFilters.frente || null,
        variableMappings: body.variableMappings ?? {},
        totalContacts: body.contacts.length,
        status: 'draft',
      }

      const campaign = await tx.campaign.create({
        data: campaignData,
      })

      for (const contact of body.contacts) {
        const existingCliente = await tx.cliente.findFirst({
          where: {
            OR: [
              { codigoAsociado: contact.codigoAsociado },
              { dni: contact.numDoc },
            ],
          },
        })

        const clienteData = {
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
        }

        const cliente = existingCliente
          ? await tx.cliente.update({
              where: { id: existingCliente.id },
              data: clienteData,
            })
          : await tx.cliente.create({
              data: clienteData,
            })

        await tx.campaignContact.upsert({
          where: {
            campaignId_clienteId: {
              campaignId: campaign.id,
              clienteId: cliente.id,
            },
          },
          update: {},
          create: {
            campaignId: campaign.id,
            clienteId: cliente.id,
            sendStatus: 'pending',
          },
        })
      }

      return campaign
    })

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
