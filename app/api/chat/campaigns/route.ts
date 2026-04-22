import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// GET /api/chat/campaigns
// Lista mínima para el dropdown del Chat: id, nombre, fecha, total y estado.
export async function GET() {
  try {
    const campaigns = await prisma.campaign.findMany({
      select: {
        id: true,
        nombre: true,
        createdAt: true,
        totalContacts: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ success: true, data: campaigns })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
