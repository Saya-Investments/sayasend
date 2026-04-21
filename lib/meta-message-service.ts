const META_API_VERSION = 'v23.0'

type SendResult = {
  wamid: string
  raw: unknown
}

type TemplateParam = { type: 'text'; text: string }

type MetaError = Error & { httpStatus?: number; metaError?: unknown }

function getEnv() {
  const token = process.env.META_ACCESS_TOKEN
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) {
    throw new Error('Faltan META_ACCESS_TOKEN o META_PHONE_NUMBER_ID en el entorno')
  }
  return { token, phoneNumberId }
}

export function normalizePhoneDigits(phone: string): string {
  return String(phone || '').replace(/[^0-9]/g, '')
}

async function callMeta(body: unknown): Promise<Record<string, unknown>> {
  const { token, phoneNumberId } = getEnv()
  const url = `https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    const metaErr = (data?.error ?? {}) as { message?: string; code?: number }
    const err = new Error(metaErr.message || `Meta API error ${res.status}`) as MetaError
    err.httpStatus = res.status
    err.metaError = data?.error
    throw err
  }
  return data
}

function extractWamid(data: Record<string, unknown>): string {
  const messages = (data?.messages ?? []) as Array<{ id?: string }>
  return messages[0]?.id ?? ''
}

export async function sendTextMessage(to: string, text: string): Promise<SendResult> {
  const toDigits = normalizePhoneDigits(to)
  const data = await callMeta({
    messaging_product: 'whatsapp',
    to: toDigits,
    type: 'text',
    text: { body: text },
  })
  return { wamid: extractWamid(data), raw: data }
}

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  templateLang: string,
  bodyParams: string[] = [],
): Promise<SendResult> {
  const toDigits = normalizePhoneDigits(to)
  const components: Array<{ type: string; parameters: TemplateParam[] }> = []
  if (bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParams.map((text) => ({ type: 'text', text })),
    })
  }
  const data = await callMeta({
    messaging_product: 'whatsapp',
    to: toDigits,
    type: 'template',
    template: {
      name: templateName,
      language: { code: templateLang || 'es' },
      ...(components.length > 0 ? { components } : {}),
    },
  })
  return { wamid: extractWamid(data), raw: data }
}
