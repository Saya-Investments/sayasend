import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { createMetaTemplate, uploadHeaderMedia } from '@/lib/meta-template-service'
import { uploadImage } from '@/lib/gcs'

export const runtime = 'nodejs'

// ============================================================================
// GET /api/templates — lista templates desde la BD (usado por /campaigns/new).
// Por default excluye las marcadas como 'DELETED_IN_META' (ya no existen en
// Meta y no se deberían poder seleccionar para nuevas campañas). Para traer
// todas (para la página /templates que las muestra grayed out), pasa
// ?includeDeleted=true.
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    const includeDeleted =
      new URL(request.url).searchParams.get('includeDeleted') === 'true'

    const where = includeDeleted
      ? {}
      : { NOT: { estadoMeta: 'DELETED_IN_META' } }

    const templates = await prisma.template.findMany({
      where,
      orderBy: { nombre: 'asc' },
    })
    return NextResponse.json({ success: true, data: templates })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// ============================================================================
// POST /api/templates — crea la template en Meta + opcionalmente la guarda
// en BD. Dos modos:
//   - JSON body (text-only): para templates sin imagen, como antes.
//   - multipart/form-data: si hay header IMAGE, con un campo "image" que es
//     el archivo. Se sube a GCS (para envíos futuros) y a Meta Resumable
//     Upload (para el sample de aprobación).
// ============================================================================

type TemplateBody = {
  nombre: string
  mensaje: string
  descripcion?: string
  categoria?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  idioma?: string
  header?: string | null
  headerType?: 'TEXT' | 'IMAGE' | 'NONE'
  footer?: string | null
  botones?: Array<{ type?: string; text: string }> | null
  ejemplos_mensaje?: string[]
  ejemplos_header?: string[]
  guardar_en_bd?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? ''

    let body: TemplateBody
    let imageFile: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const dataField = form.get('data')
      if (typeof dataField !== 'string') {
        return NextResponse.json(
          { success: false, error: "multipart: falta el campo 'data' con el JSON de la template" },
          { status: 400 },
        )
      }
      body = JSON.parse(dataField) as TemplateBody
      const file = form.get('image')
      if (file instanceof File) imageFile = file
    } else {
      body = (await request.json()) as TemplateBody
    }

    if (!body.nombre?.trim()) {
      return NextResponse.json({ success: false, error: 'nombre es requerido' }, { status: 400 })
    }
    if (!body.mensaje?.trim()) {
      return NextResponse.json({ success: false, error: 'mensaje es requerido' }, { status: 400 })
    }

    const wantsImageHeader = body.headerType === 'IMAGE'
    if (wantsImageHeader && !imageFile) {
      return NextResponse.json(
        {
          success: false,
          error: 'headerType=IMAGE requiere enviar el archivo "image" en un request multipart/form-data',
        },
        { status: 400 },
      )
    }

    // 1. Si hay imagen: subir a GCS + a Meta Resumable Upload
    let headerMediaUrl: string | null = null
    let headerHandle: string | null = null

    if (wantsImageHeader && imageFile) {
      const arrayBuffer = await imageFile.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const fileName = imageFile.name || `image-${Date.now()}.jpg`
      const contentType = imageFile.type || 'image/jpeg'

      // Upload a GCS (para futuros envíos)
      const gcs = await uploadImage(buffer, fileName, contentType)
      headerMediaUrl = gcs.publicUrl

      // Upload a Meta (para el sample al aprobar)
      headerHandle = await uploadHeaderMedia(buffer, fileName, contentType)
    }

    // 2. Crear la template en Meta
    const metaResult = await createMetaTemplate({
      nombre: body.nombre,
      mensaje: body.mensaje,
      categoria: body.categoria ?? 'MARKETING',
      idioma: body.idioma ?? 'es_CO',
      header: wantsImageHeader ? null : (body.header ?? null),
      headerFormat: body.headerType === 'IMAGE' ? 'IMAGE' : 'TEXT',
      headerHandle,
      footer: body.footer,
      botones: body.botones,
      ejemplos_mensaje: body.ejemplos_mensaje,
      ejemplos_header: body.ejemplos_header,
    })

    // 3. Guardar en BD (por default sí)
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
          header: wantsImageHeader ? null : (body.header ?? null),
          footer: body.footer ?? null,
          botones: body.botones ? (body.botones as object) : undefined,
          headerType: body.headerType === 'NONE' || !body.headerType ? null : body.headerType,
          headerMediaUrl,
        },
      })
    }

    return NextResponse.json({
      success: true,
      meta: metaResult,
      bd: bdTemplate,
      gcs: headerMediaUrl ? { url: headerMediaUrl } : undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const httpStatus = (error as { httpStatus?: number }).httpStatus ?? 500
    return NextResponse.json({ success: false, error: message }, { status: httpStatus })
  }
}
