import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { deleteMetaTemplate } from '@/lib/meta-template-service'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const template = await prisma.template.findUnique({ where: { id } })
    if (!template) {
      return NextResponse.json({ success: false, error: 'Template no encontrada' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: template })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const template = await prisma.template.findUnique({ where: { id } })
    if (!template) {
      return NextResponse.json({ success: false, error: 'Template no encontrada' }, { status: 404 })
    }

    // Intentar borrar en Meta si existe allá (best-effort)
    let metaDeleted = false
    try {
      await deleteMetaTemplate(template.nombre)
      metaDeleted = true
    } catch (error) {
      console.warn(
        `[templates/delete] No se pudo borrar '${template.nombre}' de Meta:`,
        (error as Error).message,
      )
    }

    await prisma.template.delete({ where: { id } })

    return NextResponse.json({ success: true, metaDeleted })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
