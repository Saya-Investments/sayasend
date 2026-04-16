import { NextRequest, NextResponse } from 'next/server'

import { queryBigQueryContacts } from '@/lib/bigquery'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const tableName = request.nextUrl.searchParams.get('databaseName')?.trim()
  const segmento = request.nextUrl.searchParams.get('segmento')?.trim() ?? ''
  const estrategia = request.nextUrl.searchParams.get('estrategia')?.trim() ?? ''

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
    const result = await queryBigQueryContacts(tableName, {
      segmento: segmento || undefined,
      estrategia: estrategia || undefined,
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
        error: `Failed to load BigQuery contacts: ${message}`,
      },
      { status: 500 },
    )
  }
}
