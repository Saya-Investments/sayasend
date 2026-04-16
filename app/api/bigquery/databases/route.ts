import { NextResponse } from 'next/server'

import { listBigQueryTables } from '@/lib/bigquery'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const tables = await listBigQueryTables()

    return NextResponse.json({
      success: true,
      data: tables,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        success: false,
        error: `Failed to load BigQuery tables: ${message}`,
      },
      { status: 500 },
    )
  }
}
