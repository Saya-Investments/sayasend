import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { createMetaTemplate } from '@/lib/meta-template-service'

export const runtime = 'nodejs'

// ============================================================================
// GET /api/templates — lista templates desde la BD (usado por /campaigns/new)
// ============================================================================
export async function GET() {
  try {
    const templates = await prisma.template.findMany({ orderBy: { nombre: 'asc' } })
    return NextResponse.json({ success: true, data: templates })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// ============================================================================
// POST /api/templates — crea la template en Meta + opcionalmente la guarda en BD
// ============================================================================
type CreateTemplateBody = {
  nombre: string
  mensaje: string
  descripcion?: string
  categoria?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  idioma?: string
  header?: string | null
  footer?: string | null
  botones?: Array<{ type?: string; text: string }> | null
  ejemplos_mensaje?: string[]
  ejemplos_header?: string[]
  guardar_en_bd?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateTemplateBody

    if (!body.nombre?.trim()) {
      return NextResponse.json({ success: false, error: 'nombre es requerido' }, { status: 400 })
    }
    if (!body.mensaje?.trim()) {
      return NextResponse.json({ success: false, error: 'mensaje es requerido' }, { status: 400 })
    }

    // 1. Crear en Meta
    const metaResult = await createMetaTemplate({
      nombre: body.nombre,
      mensaje: body.mensaje,
      categoria: body.categoria ?? 'MARKETING',
      idioma: body.idioma ?? 'es_CO',
      header: body.header,
      footer: body.footer,
      botones: body.botones,
      ejemplos_mensaje: body.ejemplos_mensaje,
      ejemplos_header: body.ejemplos_header,
    })

    // 2. Guardar en BD (por defecto sí, a menos que se diga que no)
    let bdTemplate = null
    if (body.guardar_en_bd !== false) {
      bdTemplate = await prisma.template.create({
        data: {
          nombre: metaResult.nombreMeta,
          descripcion: body.descripcion ?? null,
          contenido: body.mensaje,
          metaId: metaResult.metaId,
          estadoMeta: metaResult.estadoMeta,
          categoria: body.categoria ?? 'MARKETING',
          idioma: body.idioma ?? 'es_CO',
          header: body.header ?? null,
          footer: body.footer ?? null,
          botones: body.botones ? (body.botones as object) : undefined,
        },
      })
    }

    return NextResponse.json({
      success: true,
      meta: metaResult,
      bd: bdTemplate,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const httpStatus = (error as { httpStatus?: number }).httpStatus ?? 500
    return NextResponse.json({ success: false, error: message }, { status: httpStatus })
  }
}
