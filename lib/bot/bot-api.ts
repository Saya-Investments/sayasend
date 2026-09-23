// Cliente de los endpoints HTTP del Bot Educador v2 (Cloud Run `sayasend-bot`).
// SOLO se usa desde rutas de API del servidor: el secreto no puede llegar al
// navegador. Todo cambio de estado pasa por acá — nunca UPDATE directo a las
// tablas edu_* o bot_* (el bot recalcula el score y escribe el ledger).

const BOT_API_URL_DEFECTO = 'https://sayasent-763512810578.us-west4.run.app'

export class ErrorBot extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

async function llamarBot<T = unknown>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const secret = process.env.BOT_SECRET
  if (!secret) throw new ErrorBot('Falta BOT_SECRET en el entorno', 500)

  const base = (process.env.BOT_API_URL || BOT_API_URL_DEFECTO).replace(/\/+$/, '')
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': secret },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })

  const texto = await res.text()
  let data: unknown = texto
  try {
    data = texto ? JSON.parse(texto) : null
  } catch {
    // respuesta no JSON: se devuelve como texto
  }

  if (!res.ok) {
    const d = data as { error?: string; message?: string; detail?: string } | string | null
    const msg =
      (typeof d === 'object' && d && (d.error || d.message || d.detail)) ||
      (typeof d === 'string' && d) ||
      `El bot respondió ${res.status}`
    // 4xx del bot = datos inválidos (se muestran al usuario); 5xx = fallo del bot.
    throw new ErrorBot(String(msg), res.status >= 500 ? 502 : res.status)
  }
  return data as T
}

export type ResultadoBot = {
  clave: string
  etiqueta?: string
  label?: string
  ayuda?: string
  descripcion?: string
  efecto?: string
  requiere_fecha?: boolean
  cierra?: boolean
}

// Los resultados NO se hardcodean: el bot manda la lista con su etiqueta, su
// ayuda y su efecto (§6 del documento v2).
export function resultadosDeGestion() {
  return llamarBot<{ resultados?: ResultadoBot[] } | ResultadoBot[]>('GET', '/bot/resultados')
}

// Cerrar (o registrar) la gestión de una incidencia derivada. El identificador
// es el bigint `incidencia_id`, no el uuid que usa el CRM para las foráneas.
export function cerrarGestion(
  incidenciaId: string | number,
  body: { resultado: string; asesor: string; observaciones?: string; agendada_para?: string },
) {
  return llamarBot('POST', `/bot/derivacion/${encodeURIComponent(String(incidenciaId))}`, body)
}

// Tomar la conversación: el bot se calla las horas indicadas.
export function pausarBot(etapaClienteId: string | number, horas: number) {
  return llamarBot('POST', `/bot/pausa/${encodeURIComponent(String(etapaClienteId))}`, { horas })
}

// Dar de alta a un cliente en el bot: abre la etapa, calcula la ventana de días
// hábiles y deja el arrastre de score en el ledger.
export function abrirEtapa(clienteId: string, etapa?: 'PRE' | 'ADM' | 'FID') {
  return llamarBot('POST', '/bot/etapa', { cliente_id: clienteId, ...(etapa ? { etapa } : {}) })
}

export function healthBot() {
  return llamarBot('GET', '/bot/health')
}
