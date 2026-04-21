const META_API_VERSION = 'v23.0'
const DEFAULT_LANGUAGE = 'es_CO'

type MetaButton = {
  type?: string
  text: string
}

type HeaderFormat = 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO'

type CreateTemplateInput = {
  nombre: string
  mensaje: string
  categoria?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  idioma?: string
  header?: string | null
  headerFormat?: HeaderFormat
  headerHandle?: string | null  // handle de Resumable Upload cuando headerFormat es IMAGE/VIDEO/DOCUMENT
  footer?: string | null
  botones?: MetaButton[] | null
  ejemplos_mensaje?: string[]
  ejemplos_header?: string[]
}

type MetaTemplate = {
  id: string
  nombre: string
  estadoMeta: string
  idioma: string
  categoria: string
  contenido: string
  header: string | null
  footer: string | null
  botones: MetaButton[] | null
  headerFormat: HeaderFormat | null  // TEXT | IMAGE | DOCUMENT | VIDEO | null si no tiene header
}

function getEnv() {
  const token = process.env.META_ACCESS_TOKEN
  const businessId = process.env.META_BUSINESS_ACCOUNT_ID
  if (!token || !businessId) {
    throw new Error('Faltan META_ACCESS_TOKEN o META_BUSINESS_ACCOUNT_ID en el entorno')
  }
  return { token, businessId }
}

function getAppId() {
  const appId = process.env.META_APP_ID
  if (!appId) {
    throw new Error(
      'Falta META_APP_ID en el entorno. Requerido para subir media al Resumable Upload API de Meta. ' +
        'Obtenerlo desde Meta Developers → tu app → Settings → Basic → App ID.',
    )
  }
  return appId
}

function normalizeName(nombre: string) {
  return nombre.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

/**
 * Sube un archivo de media (imagen/video/documento) a Meta via Resumable Upload API.
 * Proceso de 3 pasos:
 *   1. POST /{app-id}/uploads con file metadata → devuelve session id
 *   2. POST /{session-id} con bytes → devuelve handle
 *   3. El handle se usa en example.header_handle al crear template
 *
 * Solo se usa cuando creás una template con header IMAGE/VIDEO/DOCUMENT.
 * El handle es efímero (válido por ~30 días) pero alcanza para que Meta apruebe.
 */
export async function uploadHeaderMedia(
  fileBuffer: Buffer,
  fileName: string,
  fileType: string,
): Promise<string> {
  const { token } = getEnv()
  const appId = getAppId()

  // Step 1: iniciar sesión de upload
  const initUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/${appId}/uploads`)
  initUrl.searchParams.set('file_name', fileName)
  initUrl.searchParams.set('file_length', String(fileBuffer.length))
  initUrl.searchParams.set('file_type', fileType)
  initUrl.searchParams.set('access_token', token)

  const initResponse = await fetch(initUrl, { method: 'POST' })
  const initData = (await initResponse.json()) as { id?: string; error?: { message?: string } }
  if (!initResponse.ok || !initData.id) {
    throw new Error(
      `Meta Resumable Upload init falló: ${initData.error?.message ?? initResponse.status}`,
    )
  }

  // Step 2: subir los bytes
  const sessionId = initData.id // formato: "upload:XXXX"
  const uploadResponse = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${sessionId}`, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${token}`,
      file_offset: '0',
      'Content-Type': fileType,
    },
    // Buffer de Node se serializa como binario al pasarlo a fetch
    body: fileBuffer as unknown as BodyInit,
  })

  const uploadData = (await uploadResponse.json()) as { h?: string; error?: { message?: string } }
  if (!uploadResponse.ok || !uploadData.h) {
    throw new Error(
      `Meta Resumable Upload subida falló: ${uploadData.error?.message ?? uploadResponse.status}`,
    )
  }

  return uploadData.h // header_handle
}

export async function createMetaTemplate(input: CreateTemplateInput) {
  const { token, businessId } = getEnv()

  const bodyComponent: Record<string, unknown> = { type: 'BODY', text: input.mensaje }
  if (input.ejemplos_mensaje?.length) {
    bodyComponent.example = { body_text: [input.ejemplos_mensaje] }
  }

  const components: Array<Record<string, unknown>> = [bodyComponent]

  // Header: TEXT, IMAGE, DOCUMENT o VIDEO
  if (input.headerFormat && input.headerFormat !== 'TEXT' && input.headerHandle) {
    // Media header (IMAGE/VIDEO/DOCUMENT) — se pasa el handle devuelto por
    // uploadHeaderMedia(). El header.text no va (media no tiene texto).
    components.unshift({
      type: 'HEADER',
      format: input.headerFormat,
      example: { header_handle: [input.headerHandle] },
    })
  } else if (input.header) {
    // Text header
    const headerComponent: Record<string, unknown> = {
      type: 'HEADER',
      format: 'TEXT',
      text: input.header,
    }
    if (input.ejemplos_header?.length) {
      headerComponent.example = { header_text: input.ejemplos_header }
    }
    components.unshift(headerComponent)
  }

  if (input.footer) components.push({ type: 'FOOTER', text: input.footer })

  if (input.botones?.length) {
    components.push({
      type: 'BUTTONS',
      buttons: input.botones.map((b) => ({ type: b.type ?? 'QUICK_REPLY', text: b.text })),
    })
  }

  const normalizedName = normalizeName(input.nombre)
  const payload = {
    name: normalizedName,
    language: input.idioma ?? DEFAULT_LANGUAGE,
    category: input.categoria ?? 'MARKETING',
    components,
  }

  const response = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${businessId}/message_templates`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  )

  const data = (await response.json()) as {
    id?: string
    status?: string
    error?: { message?: string; code?: number; error_user_msg?: string }
  }

  if (!response.ok) {
    const err = new Error(
      data.error?.error_user_msg ?? data.error?.message ?? 'Error creando template en Meta',
    ) as Error & { metaCode?: number; httpStatus?: number }
    err.metaCode = data.error?.code
    err.httpStatus = response.status
    throw err
  }

  return {
    metaId: data.id!,
    estadoMeta: data.status ?? 'PENDING',
    nombreMeta: normalizedName,
  }
}

export async function getAllMetaTemplates(): Promise<MetaTemplate[]> {
  const { token, businessId } = getEnv()

  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${businessId}/message_templates`)
  url.searchParams.set('limit', '1000')
  url.searchParams.set('fields', 'name,status,language,category,id,components')

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  const data = (await response.json()) as {
    data?: Array<{
      id: string
      name: string
      status: string
      language: string
      category: string
      components?: Array<{ type: string; format?: string; text?: string; buttons?: MetaButton[] }>
    }>
    error?: { message?: string }
  }

  if (!response.ok) {
    throw new Error(data.error?.message ?? `Meta API error ${response.status}`)
  }

  const templates = data.data ?? []
  return templates.map((t) => {
    const body = t.components?.find((c) => c.type === 'BODY')?.text ?? ''
    const headerComp = t.components?.find((c) => c.type === 'HEADER')
    const header = headerComp?.format === 'TEXT' ? (headerComp.text ?? null) : null
    const headerFormat = (headerComp?.format as HeaderFormat | undefined) ?? null
    const footer = t.components?.find((c) => c.type === 'FOOTER')?.text ?? null
    const buttonsBlock = t.components?.find((c) => c.type === 'BUTTONS')
    return {
      id: t.id,
      nombre: t.name,
      estadoMeta: t.status,
      idioma: t.language,
      categoria: t.category,
      contenido: body,
      header,
      footer,
      botones: buttonsBlock?.buttons ?? null,
      headerFormat,
    }
  })
}

export async function deleteMetaTemplate(templateName: string) {
  const { token, businessId } = getEnv()

  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${businessId}/message_templates`)
  url.searchParams.set('name', templateName)

  const response = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })

  const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } }

  if (!response.ok) {
    throw new Error(data.error?.message ?? `Meta delete error ${response.status}`)
  }
}

export async function getMetaTemplateStatus(templateName: string) {
  const { token, businessId } = getEnv()

  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${businessId}/message_templates`)
  url.searchParams.set('name', templateName)

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = (await response.json()) as {
    data?: Array<{ id: string; name: string; status: string; language: string; category: string }>
  }
  const t = data.data?.[0]
  if (!t) return null
  return {
    metaId: t.id,
    nombre: t.name,
    estadoMeta: t.status,
    idioma: t.language,
    categoria: t.category,
  }
}
