import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import {
  uploadImage,
  deleteImage,
  extractObjectPathFromUrl,
  downloadObject,
  publicUrlFor,
} from '@/lib/gcs'
import { isMediaHeaderType, validateMediaFile } from '@/lib/template-media'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

// ============================================================================
// POST /api/templates/[id]/image
// Sube (o reemplaza) el media del header de una template ya existente —
// imagen o video, según el headerType que tenga la template.
// Se usa típicamente para:
//   - Templates sincronizadas desde Meta Business Manager (no creadas desde
//     el CRM), que llegan con headerType=IMAGE/VIDEO pero sin headerMediaUrl.
//   - Reemplazar el media actual de una template (ej. cambio de promo).
//
// Dos modos de entrada:
//   - multipart/form-data con campo "media" (o "image"): para archivos chicos.
//   - JSON { objectPath }: el navegador ya subió el archivo a GCS con signed
//     URL. Obligatorio para video, porque Vercel corta el body en 4.5MB.
//
// No requiere re-subir a Meta Resumable Upload porque la template ya está
// aprobada en Meta. La Resumable Upload solo se necesita al CREAR templates.
// ============================================================================
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    const template = await prisma.template.findUnique({ where: { id } })
    if (!template) {
      return NextResponse.json({ success: false, error: 'Template no encontrada' }, { status: 404 })
    }

    if (!isMediaHeaderType(template.headerType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Esta template tiene headerType='${template.headerType ?? 'null'}', no IMAGE ni VIDEO. No se le puede asignar media.`,
        },
        { status: 400 },
      )
    }
    const mediaType = template.headerType

    const contentType = request.headers.get('content-type') ?? ''
    let publicUrl: string

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('media') ?? form.get('image')
      if (!(file instanceof File)) {
        return NextResponse.json(
          { success: false, error: "Falta el campo 'media' con el archivo" },
          { status: 400 },
        )
      }

      const invalid = validateMediaFile(mediaType, file.type, file.size)
      if (invalid) {
        return NextResponse.json({ success: false, error: invalid }, { status: 400 })
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const fileName = file.name || `template-${id}-${Date.now()}`
      publicUrl = (await uploadImage(buffer, fileName, file.type)).publicUrl
    } else {
      const { objectPath } = (await request.json()) as { objectPath?: string }
      if (!objectPath) {
        return NextResponse.json(
          { success: false, error: 'Falta objectPath (archivo subido a GCS con signed URL)' },
          { status: 400 },
        )
      }

      // El archivo ya está en el bucket: solo se valida contra las reglas de
      // Meta antes de apuntarle la template.
      const object = await downloadObject(objectPath)
      const invalid = validateMediaFile(mediaType, object.contentType, object.size)
      if (invalid) {
        return NextResponse.json({ success: false, error: invalid }, { status: 400 })
      }

      publicUrl = publicUrlFor(objectPath)
    }

    // Intentar borrar el media anterior del bucket (si había uno)
    let previousDeleted = false
    if (template.headerMediaUrl && template.headerMediaUrl !== publicUrl) {
      const previousPath = extractObjectPathFromUrl(template.headerMediaUrl)
      if (previousPath) {
        try {
          await deleteImage(previousPath)
          previousDeleted = true
        } catch {
          // No bloquea el flujo — la nueva URL ya se va a guardar igual
        }
      }
    }

    const updated = await prisma.template.update({
      where: { id },
      data: { headerMediaUrl: publicUrl },
    })

    return NextResponse.json({
      success: true,
      data: updated,
      gcs: { url: publicUrl },
      previousDeleted,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
