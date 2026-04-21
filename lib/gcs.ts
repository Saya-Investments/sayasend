import { Storage } from '@google-cloud/storage'

// Cliente singleton de GCS, inicializado con el service account key de Vercel env.
let storageClient: Storage | null = null
let cachedBucketName: string | null = null

function getStorage() {
  if (storageClient) return storageClient

  const rawKey = process.env.GCS_SERVICE_ACCOUNT_KEY
  if (!rawKey) {
    throw new Error('GCS_SERVICE_ACCOUNT_KEY no está configurada en las env vars')
  }

  let credentials: { project_id?: string; private_key?: string; client_email?: string }
  try {
    let normalized = rawKey.trim()
    if (
      (normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'"))
    ) {
      normalized = normalized.slice(1, -1)
    }
    credentials = JSON.parse(normalized) as typeof credentials
  } catch (e) {
    throw new Error('GCS_SERVICE_ACCOUNT_KEY no es un JSON válido: ' + (e as Error).message)
  }

  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n')
  }

  storageClient = new Storage({
    credentials,
    projectId: credentials.project_id,
  })
  return storageClient
}

function getBucketName() {
  if (cachedBucketName) return cachedBucketName
  const name = process.env.GCS_BUCKET_NAME
  if (!name) throw new Error('GCS_BUCKET_NAME no está configurada en las env vars')
  cachedBucketName = name
  return name
}

/**
 * Sube un buffer al bucket GCS y devuelve la URL pública.
 * El bucket tiene que estar configurado como público (allUsers: objectViewer).
 *
 * @param buffer       - bytes del archivo
 * @param originalName - nombre original (usado para derivar extensión y timestamp)
 * @param contentType  - MIME type (ej. 'image/jpeg')
 * @param folder       - subcarpeta dentro del bucket (default 'templates')
 * @returns URL pública https://storage.googleapis.com/<bucket>/<path>
 */
export async function uploadImage(
  buffer: Buffer,
  originalName: string,
  contentType: string,
  folder = 'templates',
): Promise<{ publicUrl: string; objectPath: string }> {
  const storage = getStorage()
  const bucketName = getBucketName()
  const bucket = storage.bucket(bucketName)

  const sanitized = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  const timestamp = Date.now()
  const objectPath = `${folder}/${timestamp}-${sanitized}`

  const file = bucket.file(objectPath)
  await file.save(buffer, {
    contentType,
    // No usamos .makePublic() porque el bucket ya es público a nivel IAM.
    resumable: false, // uploads chicos (imágenes), no hace falta resumable
  })

  const publicUrl = `https://storage.googleapis.com/${bucketName}/${objectPath}`
  return { publicUrl, objectPath }
}

/**
 * Borra un objeto del bucket dado su path (ej. "templates/1234-foo.jpg").
 * Útil cuando se borra una template para evitar huérfanos en el bucket.
 */
export async function deleteImage(objectPath: string): Promise<void> {
  const storage = getStorage()
  const bucketName = getBucketName()
  await storage.bucket(bucketName).file(objectPath).delete({ ignoreNotFound: true })
}

/**
 * Extrae el objectPath desde una URL pública.
 * https://storage.googleapis.com/<bucket>/<path> → <path>
 * Retorna null si la URL no pertenece al bucket configurado.
 */
export function extractObjectPathFromUrl(url: string): string | null {
  const bucketName = getBucketName()
  const prefix = `https://storage.googleapis.com/${bucketName}/`
  if (!url.startsWith(prefix)) return null
  return url.slice(prefix.length)
}
