import { NextRequest, NextResponse } from 'next/server'

import { excelSorteo, nombreExcelSorteo, type GrupoSorteo } from '@/lib/preadmision-excel'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// Excel de retadores o de convencional de una campaña de bienvenida de
// Pre-admisión: ?grupo=retador | convencional.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const grupoParam = request.nextUrl.searchParams.get('grupo')?.trim().toUpperCase()
  if (grupoParam !== 'RETADOR' && grupoParam !== 'CONVENCIONAL') {
    return NextResponse.json({ success: false, error: 'grupo debe ser retador o convencional' }, { status: 400 })
  }
  const grupo: GrupoSorteo = grupoParam

  const campaign = await prisma.campaign.findUnique({ where: { id }, select: { nombre: true } })
  if (!campaign) {
    return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
  }

  const { buffer } = await excelSorteo(id, grupo)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreExcelSorteo(campaign.nombre, grupo)}"`,
      'Cache-Control': 'no-store',
    },
  })
}
