import { NextRequest, NextResponse } from 'next/server'

import { listBigQueryEstrategias } from '@/lib/bigquery'

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
    const estrategias = await listBigQueryEstrategias(tableName)

    return NextResponse.json({
      success: true,
      data: estrategias,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        success: false,
        error: `Failed to load BigQuery estrategias: ${message}`,
      },
      { status: 500 },
    )
  }
}
