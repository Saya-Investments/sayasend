import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { createMetaTemplate, uploadHeaderMedia } from '@/lib/meta-template-service'
import { downloadObject, publicUrlFor, uploadImage } from '@/lib/gcs'
import { isMediaHeaderType, validateMediaFile } from '@/lib/template-media'

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
// en BD. Tres modos, según cómo llega el media del header:
//   - JSON body sin media: templates TEXT / sin header, como siempre.
//   - JSON body con headerObjectPath: el navegador ya subió el archivo a GCS
//     con una signed URL (ver /api/templates/media/upload-url). Es el único
//     camino viable para VIDEO, porque Vercel corta el body de un route
//     handler en 4.5MB y un video de header puede pesar hasta 16MB.
//   - multipart/form-data con campo "image" (o "media"): camino legacy para
//     imágenes chicas, se mantiene para no romper clientes existentes.
//
// En todos los casos con media, los bytes terminan yendo a dos lugares:
//   - GCS, para poder previsualizar el header en el CRM y reusarlo después.
//   - Meta Resumable Upload, que devuelve el handle del sample de aprobación.
// ============================================================================

type TemplateBody = {
  nombre: string
  mensaje: string
  descripcion?: string
  categoria?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  idioma?: string
  header?: string | null
  headerType?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'NONE'
  /** Path del objeto ya subido a GCS con signed URL (ej. "templates/1712-promo.mp4"). */
  headerObjectPath?: string | null
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
    let mediaFile: File | null = null

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
      // "image" es el nombre histórico del campo; "media" es el genérico.
      const file = form.get('media') ?? form.get('image')
      if (file instanceof File) mediaFile = file
    } else {
      body = (await request.json()) as TemplateBody
    }

    if (!body.nombre?.trim()) {
      return NextResponse.json({ success: false, error: 'nombre es requerido' }, { status: 400 })
    }
    if (!body.mensaje?.trim()) {
      return NextResponse.json({ success: false, error: 'mensaje es requerido' }, { status: 400 })
    }

    const mediaHeaderType = isMediaHeaderType(body.headerType) ? body.headerType : null
    if (mediaHeaderType && !mediaFile && !body.headerObjectPath) {
      return NextResponse.json(
        {
          success: false,
          error: `headerType=${mediaHeaderType} requiere headerObjectPath (archivo ya subido a GCS) o el archivo "media" en un request multipart/form-data`,
        },
        { status: 400 },
      )
    }

    // 1. Si hay media: dejarlo en GCS + mandarlo a Meta Resumable Upload
    let headerMediaUrl: string | null = null
    let headerHandle: string | null = null

    if (mediaHeaderType) {
      let buffer: Buffer
      let fileName: string
      let fileType: string

      if (body.headerObjectPath) {
        // Ya está en GCS (el navegador lo subió con signed URL): solo bajarlo
        // para poder reenviárselo a Meta.
        const object = await downloadObject(body.headerObjectPath)
        buffer = object.buffer
        fileName = body.headerObjectPath.split('/').pop() || `header-${Date.now()}`
        fileType = object.contentType
        headerMediaUrl = publicUrlFor(body.headerObjectPath)
      } else {
        const arrayBuffer = await mediaFile!.arrayBuffer()
        buffer = Buffer.from(arrayBuffer)
        fileName = mediaFile!.name || `header-${Date.now()}`
        fileType = mediaFile!.type
      }

      const invalid = validateMediaFile(mediaHeaderType, fileType, buffer.length)
      if (invalid) {
        return NextResponse.json({ success: false, error: invalid }, { status: 400 })
      }

      if (!headerMediaUrl) {
        // Camino multipart: recién acá sube a GCS (para previsualizar después).
        const gcs = await uploadImage(buffer, fileName, fileType)
        headerMediaUrl = gcs.publicUrl
      }

      // Upload a Meta (para el sample al aprobar)
      headerHandle = await uploadHeaderMedia(buffer, fileName, fileType)
    }

    // 2. Crear la template en Meta
    const metaResult = await createMetaTemplate({
      nombre: body.nombre,
      mensaje: body.mensaje,
      categoria: body.categoria ?? 'MARKETING',
      idioma: body.idioma ?? 'es_CO',
      header: mediaHeaderType ? null : (body.header ?? null),
      headerFormat: mediaHeaderType ?? 'TEXT',
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
          header: mediaHeaderType ? null : (body.header ?? null),
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
