// Formato de fechas del CRM del bot: los clientes son de Colombia.
const TZ = 'America/Bogota'

export function fechaHora(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: TZ,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Para columnas DATE ("YYYY-MM-DD"): sin conversión de zona horaria.
export function fechaCorta(ymd: string | null | undefined) {
  if (!ymd) return '—'
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-CO', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function textoDiasRestantes(dias: number | null) {
  if (dias === null) return '—'
  if (dias < 0) return 'ventana vencida'
  if (dias === 0) return 'último día'
  if (dias === 1) return 'queda 1 día'
  return `quedan ${dias} días`
}

// Hace cuánto llegó al asesor. El SLA de la incidencia viene en horas.
export function textoEspera(desde: string | null | undefined, slaHoras?: number | null) {
  if (!desde) return { texto: '—', vencido: false }
  const horas = (Date.now() - new Date(desde).getTime()) / 3_600_000
  const cuanto = horas < 1 ? 'menos de 1 h' : horas < 48 ? `${Math.round(horas)} h` : `${Math.round(horas / 24)} días`
  const limite = slaHoras ?? 24
  return { texto: `Esperando ${cuanto}`, vencido: horas > limite }
}

// Si el bot está conversando o está callado.
export function textoEstadoBot(pausadoHasta: string | null, optOut = false) {
  if (optOut) return { texto: 'Cliente en opt-out', alerta: true }
  if (pausadoHasta && new Date(pausadoHasta).getTime() > Date.now()) {
    return { texto: `Bot pausado hasta ${fechaHora(pausadoHasta)}`, alerta: true }
  }
  return { texto: 'Bot activo', alerta: false }
}

export function telefonoLegible(tel: string) {
  const d = tel.replace(/[^0-9]/g, '')
  return d ? `+${d}` : tel
}
