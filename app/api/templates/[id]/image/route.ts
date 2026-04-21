import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { uploadImage, deleteImage, extractObjectPathFromUrl } from '@/lib/gcs'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

// ============================================================================
// POST /api/templates/[id]/image
// Sube (o reemplaza) la imagen del header de una template ya existente.
// Se usa típicamente para:
//   - Templates sincronizadas desde Meta Business Manager (no creadas desde
//     el CRM), que llegan con headerType=IMAGE pero sin headerMediaUrl.
//   - Reemplazar la imagen actual de una template (ej. cambio de promo).
//
// No requiere re-subir a Meta Resumable Upload porque la template ya está
// aprobada en Meta. La Resumable Upload solo se necesita al CREAR templates.
// El componente header del payload de Meta al enviar usa directamente la URL
// pública de GCS.
// ============================================================================
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    const template = await prisma.template.findUnique({ where: { id } })
    if (!template) {
      return NextResponse.json({ success: false, error: 'Template no encontrada' }, { status: 404 })
    }

    if (template.headerType !== 'IMAGE') {
      return NextResponse.json(
        {
          success: false,
          error: `Esta template tiene headerType='${template.headerType ?? 'null'}', no IMAGE. No se puede asignar imagen.`,
        },
        { status: 400 },
      )
    }

    const contentType = request.headers.get('content-type') ?? ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { success: false, error: 'Content-Type debe ser multipart/form-data' },
        { status: 400 },
      )
    }

    const form = await request.formData()
    const file = form.get('image')
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Falta el campo 'image' con el archivo" },
        { status: 400 },
      )
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: 'El archivo debe ser una imagen (JPEG, PNG, WebP)' },
        { status: 400 },
      )
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'La imagen no puede pesar más de 5MB (límite de WhatsApp)' },
        { status: 400 },
      )
    }

    // 1. Subir nueva imagen a GCS
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileName = file.name || `template-${id}-${Date.now()}.jpg`
    const { publicUrl } = await uploadImage(buffer, fileName, file.type)

    // 2. Intentar borrar la imagen anterior del bucket (si había una)
    let previousDeleted = false
    if (template.headerMediaUrl) {
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

    // 3. Actualizar la BD con la nueva URL
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
