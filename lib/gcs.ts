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

  const objectPath = buildObjectPath(originalName, folder)

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
 * Construye el objectPath que se usaría para un archivo, sin subir nada.
 * Se usa en el flujo de signed URL, donde el path se decide antes del upload.
 */
export function buildObjectPath(originalName: string, folder = 'templates'): string {
  const sanitized = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  return `${folder}/${Date.now()}-${sanitized}`
}

/** URL pública de un objeto del bucket (el bucket es público a nivel IAM). */
export function publicUrlFor(objectPath: string): string {
  return `https://storage.googleapis.com/${getBucketName()}/${objectPath}`
}

/**
 * Genera una signed URL v4 de escritura para que el navegador suba el archivo
 * DIRECTO a GCS con un PUT, sin pasar por el backend.
 *
 * Esto existe por el límite de 4.5MB que Vercel impone al body de un route
 * handler: un video de header (hasta 16MB según Meta) nunca podría viajar como
 * multipart hacia /api/templates. El navegador sube a GCS, el backend después
 * baja los bytes con downloadObject() y recién ahí se los pasa a Meta.
 *
 * Requiere que el bucket tenga CORS habilitado para PUT desde el origen de la app.
 */
export async function createSignedUploadUrl(
  objectPath: string,
  contentType: string,
  expiresInMinutes = 15,
): Promise<{ uploadUrl: string; objectPath: string; publicUrl: string }> {
  const storage = getStorage()
  const file = storage.bucket(getBucketName()).file(objectPath)

  const [uploadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + expiresInMinutes * 60 * 1000,
    contentType,
  })

  return { uploadUrl, objectPath, publicUrl: publicUrlFor(objectPath) }
}

/**
 * Baja un objeto del bucket a memoria. Se usa para reenviar a Meta un archivo
 * que el navegador ya subió con signed URL.
 */
export async function downloadObject(
  objectPath: string,
): Promise<{ buffer: Buffer; contentType: string; size: number }> {
  const storage = getStorage()
  const file = storage.bucket(getBucketName()).file(objectPath)

  const [exists] = await file.exists()
  if (!exists) throw new Error(`El objeto "${objectPath}" no existe en el bucket`)

  const [metadata] = await file.getMetadata()
  const [buffer] = await file.download()

  return {
    buffer,
    contentType: metadata.contentType ?? 'application/octet-stream',
    size: Number(metadata.size ?? buffer.length),
  }
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
