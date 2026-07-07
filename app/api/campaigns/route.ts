import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'

import { freezeCampaignContacts } from '@/lib/campaign-contacts'
import { prisma } from '@/lib/prisma'
import { serializeFilterValue } from '@/lib/segment-filters'
import type { CreateCampaignPayload, GestionType } from '@/lib/types'

export const runtime = 'nodejs'

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function normalizeTemplateId(templateId?: string | null) {
  if (!templateId) {
    return null
  }

  return isValidUuid(templateId) ? templateId : null
}

function normalizeGestionType(value: unknown): GestionType | null {
  return value === 'gestion_cobranza' || value === 'gestion_m0' ? value : null
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
        { success: false, error: 'templateId is required (must be a valid UUID)' },
        { status: 400 },
      )
    }

    const isExcelSource = body.databaseName.trim().startsWith('EXCEL:')
    const gestionType = normalizeGestionType(body.gestionType)
    // Solo BigQuery puede refrescarse el día del envío; un Excel no se puede
    // re-consultar, así que ahí siempre queda como foto fija.
    const refreshOnSend = !isExcelSource && body.refreshOnSend === true

    const result = await prisma.$transaction(
      async (tx) => {
        const campaignData: Prisma.CampaignUncheckedCreateInput = {
          nombre: body.name.trim(),
          templateId,
          databaseName: body.databaseName.trim(),
          sendMode: (body as { sendMode?: string }).sendMode ?? 'M0',
          segmentoFilter: serializeFilterValue(body.segmentFilters.segmento),
          estrategiaFilter: serializeFilterValue(body.segmentFilters.estrategia),
          frenteFilter: serializeFilterValue(body.segmentFilters.frente),
          variableMappings: body.variableMappings ?? {},
          totalContacts: body.contacts.length,
          status: 'draft',
          refreshOnSend,
          gestionType,
        }

        const campaign = await tx.campaign.create({ data: campaignData })

        // Siempre congelamos un snapshot inicial — así se muestra el total real
        // al programar. Si refreshOnSend es true, el scheduler reemplazará estos
        // contactos con la base del día de envío.
        await freezeCampaignContacts(tx, campaign.id, body.contacts, { isExcelSource })

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
