const META_API_VERSION = 'v23.0'
const DEFAULT_LANGUAGE = 'es_CO'

type MetaButton = {
  type?: string
  text: string
}

type CreateTemplateInput = {
  nombre: string
  mensaje: string
  categoria?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  idioma?: string
  header?: string | null
  headerFormat?: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO'
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
}

function getEnv() {
  const token = process.env.META_ACCESS_TOKEN
  const businessId = process.env.META_BUSINESS_ACCOUNT_ID
  if (!token || !businessId) {
    throw new Error('Faltan META_ACCESS_TOKEN o META_BUSINESS_ACCOUNT_ID en el entorno')
  }
  return { token, businessId }
}

function normalizeName(nombre: string) {
  return nombre.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

export async function createMetaTemplate(input: CreateTemplateInput) {
  const { token, businessId } = getEnv()

  const bodyComponent: Record<string, unknown> = { type: 'BODY', text: input.mensaje }
  if (input.ejemplos_mensaje?.length) {
    bodyComponent.example = { body_text: [input.ejemplos_mensaje] }
  }

  const components: Array<Record<string, unknown>> = [bodyComponent]

  if (input.header) {
    const headerComponent: Record<string, unknown> = {
      type: 'HEADER',
      format: input.headerFormat ?? 'TEXT',
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
      components?: Array<{ type: string; text?: string; buttons?: MetaButton[] }>
    }>
    error?: { message?: string }
  }

  if (!response.ok) {
    throw new Error(data.error?.message ?? `Meta API error ${response.status}`)
  }

  const templates = data.data ?? []
  return templates.map((t) => {
    const body = t.components?.find((c) => c.type === 'BODY')?.text ?? ''
    const header = t.components?.find((c) => c.type === 'HEADER')?.text ?? null
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
