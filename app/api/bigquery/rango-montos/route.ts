import { NextRequest, NextResponse } from 'next/server'

import { listBigQueryRangoMontos } from '@/lib/bigquery'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const tableName = request.nextUrl.searchParams.get('databaseName')?.trim()

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
    const rangoMontos = await listBigQueryRangoMontos(tableName)

    return NextResponse.json({
      success: true,
      data: rangoMontos,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        success: false,
        error: `Failed to load BigQuery rango montos: ${message}`,
      },
      { status: 500 },
    )
  }
}
