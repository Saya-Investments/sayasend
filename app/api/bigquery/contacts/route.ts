import { NextRequest, NextResponse } from 'next/server'

import { queryBigQueryContacts, queryBigQueryContactsCobranza } from '@/lib/bigquery'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const tableName = request.nextUrl.searchParams.get('databaseName')?.trim()
  const segmento = request.nextUrl.searchParams.get('segmento')?.trim() ?? ''
  const estrategia = request.nextUrl.searchParams.get('estrategia')?.trim() ?? ''
  const frente = request.nextUrl.searchParams.get('frente')?.trim() ?? ''
  const gestionType = request.nextUrl.searchParams.get('gestionType')?.trim() ?? 'gestion_m0'

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
      segmento: segmento || undefined,
      estrategia: estrategia || undefined,
      frente: frente || undefined,
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
