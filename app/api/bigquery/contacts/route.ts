import { NextRequest, NextResponse } from 'next/server'

import { queryBigQueryContacts, queryBigQueryContactsCobranza } from '@/lib/bigquery'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const tableName = params.get('databaseName')?.trim()
  // Cada filtro admite múltiples valores (parámetros repetidos en la URL).
  const cleanList = (values: string[]) =>
    values.map((v) => v.trim()).filter((v) => v.length > 0)
  const segmento = cleanList(params.getAll('segmento'))
  const estrategia = cleanList(params.getAll('estrategia'))
  const frente = cleanList(params.getAll('frente'))
  const gestionType = params.get('gestionType')?.trim() ?? 'gestion_m0'

  if (!tableName) {
    return NextResponse.json(
      {
        success: false,
        error: 'databaseName is required',
      },
      { status: 400 },
    )
  }

  try {
    const filters = {
      segmento: segmento.length > 0 ? segmento : undefined,
      estrategia: estrategia.length > 0 ? estrategia : undefined,
      frente: frente.length > 0 ? frente : undefined,
    }

    const result = gestionType === 'gestion_cobranza'
      ? await queryBigQueryContactsCobranza(tableName, filters)
      : await queryBigQueryContacts(tableName, filters)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        success: false,
        error: `Failed to load BigQuery contacts: ${message}`,
      },
      { status: 500 },
    )
  }
}
