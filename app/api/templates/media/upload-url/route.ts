import { NextRequest, NextResponse } from 'next/server'

import { buildObjectPath, createSignedUploadUrl } from '@/lib/gcs'
import { isMediaHeaderType, validateMediaFile } from '@/lib/template-media'

export const runtime = 'nodejs'

// ============================================================================
// POST /api/templates/media/upload-url
// Devuelve una signed URL para que el navegador suba el archivo de header
// DIRECTO a GCS, sin pasar por el backend.
//
// Existe por el límite de 4.5MB que Vercel le impone al body de un route
// handler: un video de header (hasta 16MB) no entra como multipart. El flujo
// completo del cliente es:
//   1. POST acá → { uploadUrl, objectPath, publicUrl }
//   2. PUT uploadUrl con los bytes y el mismo Content-Type
//   3. POST /api/templates con headerObjectPath = objectPath
//
// Body: { headerType: 'IMAGE' | 'VIDEO', fileName: string, contentType: string,
//         size: number }
// ============================================================================

type Body = {
  headerType?: string
  fileName?: string
  contentType?: string
  size?: number
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body

    if (!isMediaHeaderType(body.headerType)) {
      return NextResponse.json(
        { success: false, error: "headerType debe ser 'IMAGE' o 'VIDEO'" },
        { status: 400 },
      )
    }
    if (!body.contentType || typeof body.size !== 'number') {
      return NextResponse.json(
        { success: false, error: 'contentType y size son requeridos' },
        { status: 400 },
      )
    }

    // Se valida acá y no solo al crear la template, para no emitir una URL
    // firmada por un archivo que después vamos a rechazar igual.
    const invalid = validateMediaFile(body.headerType, body.contentType, body.size)
    if (invalid) {
      return NextResponse.json({ success: false, error: invalid }, { status: 400 })
    }

    const objectPath = buildObjectPath(body.fileName || `header-${Date.now()}`)
    const signed = await createSignedUploadUrl(objectPath, body.contentType)

    return NextResponse.json({ success: true, ...signed })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
