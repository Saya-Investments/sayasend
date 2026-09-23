// ============================================================================
// Reglas de media para headers de plantilla.
// Se comparten entre el cliente (validación antes de subir) y las rutas de API
// (validación real), para que el mensaje de error sea el mismo en los dos lados.
//
// Los límites salen de la doc de Meta para el sample de media de una template:
//   - IMAGE: JPEG / PNG, hasta 5MB
//   - VIDEO: MP4 / 3GPP, hasta 16MB (y el codec de video tiene que ser H.264
//     con audio AAC; WhatsApp rechaza otros codecs al reproducir)
// ============================================================================

export type MediaHeaderType = 'IMAGE' | 'VIDEO'

export const MEDIA_HEADER_RULES: Record<
  MediaHeaderType,
  { mimeTypes: string[]; maxBytes: number; label: string; hint: string }
> = {
  IMAGE: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxBytes: 5 * 1024 * 1024,
    label: 'imagen',
    hint: 'JPEG, PNG o WebP. Máximo 5MB.',
  },
  VIDEO: {
    mimeTypes: ['video/mp4', 'video/3gpp'],
    maxBytes: 16 * 1024 * 1024,
    label: 'video',
    hint: 'MP4 o 3GPP (video H.264 + audio AAC). Máximo 16MB.',
  },
}

export function isMediaHeaderType(value: unknown): value is MediaHeaderType {
  return value === 'IMAGE' || value === 'VIDEO'
}

/** Deduce el tipo de header a partir del MIME del archivo. */
export function mediaTypeFromMime(mime: string): MediaHeaderType | null {
  if (MEDIA_HEADER_RULES.IMAGE.mimeTypes.includes(mime)) return 'IMAGE'
  if (MEDIA_HEADER_RULES.VIDEO.mimeTypes.includes(mime)) return 'VIDEO'
  return null
}

/**
 * Valida MIME + tamaño contra las reglas del tipo pedido.
 * Devuelve el mensaje de error, o null si está todo bien.
 */
export function validateMediaFile(
  type: MediaHeaderType,
  mime: string,
  sizeBytes: number,
): string | null {
  const rules = MEDIA_HEADER_RULES[type]

  if (!rules.mimeTypes.includes(mime)) {
    return `Para un header ${type} el archivo debe ser ${rules.mimeTypes.join(' o ')} (recibido: ${mime || 'desconocido'})`
  }
  if (sizeBytes > rules.maxBytes) {
    const maxMb = Math.round(rules.maxBytes / 1024 / 1024)
    const gotMb = (sizeBytes / 1024 / 1024).toFixed(1)
    return `El ${rules.label} no puede pesar más de ${maxMb}MB (límite de WhatsApp). Este pesa ${gotMb}MB.`
  }
  return null
}
