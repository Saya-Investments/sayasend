import type { MediaHeaderType } from './template-media'

/**
 * Sube un archivo de header directo a GCS usando una signed URL, sin pasar
 * por el backend (que en Vercel corta el body en 4.5MB).
 *
 * Flujo: pide la URL firmada → PUT del archivo a GCS → devuelve el objectPath
 * que después se le manda a /api/templates o /api/templates/[id]/image.
 */
export async function uploadTemplateMedia(
  file: File,
  headerType: MediaHeaderType,
): Promise<{ objectPath: string; publicUrl: string }> {
  const signedResponse = await fetch('/api/templates/media/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      headerType,
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    }),
  })
  const signed = await signedResponse.json()
  if (!signed.success) throw new Error(signed.error ?? 'No se pudo generar la URL de subida')

  const putResponse = await fetch(signed.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!putResponse.ok) {
    // El caso típico acá es CORS: el bucket tiene que permitir PUT desde el
    // origen de la app (ver docs/gcs-cors.md).
    throw new Error(
      `Falló la subida a Cloud Storage (${putResponse.status}). Revisá la config de CORS del bucket.`,
    )
  }

  return { objectPath: signed.objectPath, publicUrl: signed.publicUrl }
}
