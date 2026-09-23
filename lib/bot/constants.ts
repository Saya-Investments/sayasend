// Valores y etiquetas del Bot Educador v2 (ver bot/CAMBIOS_CRM_v1_a_v2.md).
// La v2 no mide "acompañamiento por caso": mide un score 0–100 por etapa y
// abre una incidencia por cada tema que el cliente trae.

export const ETAPA_LABEL: Record<string, string> = {
  PRE: 'Pre-Admisión',
  ADM: 'Admisión',
  FID: 'Fidelización',
}

// Rangos de score (§4). Reemplazan a los colores de acompañamiento de la v1.
export const RANGOS_SCORE = [
  { min: 0, max: 29, label: 'En riesgo', className: 'bg-red-100 text-red-800 border-red-200' },
  { min: 30, max: 49, label: 'Inconforme', className: 'bg-amber-100 text-amber-900 border-amber-200' },
  { min: 50, max: 69, label: 'Neutro', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  { min: 70, max: 100, label: 'Conforme', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
] as const

// Regla que manda sobre el rango: un retiro va en rojo siempre.
export function rangoScore(score: number, motivoPrincipal?: string | null) {
  if (motivoPrincipal === 'retiro') {
    return { label: 'Retiro', className: 'bg-red-600 text-white border-red-700' }
  }
  const r = RANGOS_SCORE.find((x) => score >= x.min && score <= x.max)
  return r ?? RANGOS_SCORE[2]
}

export const ESTADO_CONV_LABEL: Record<string, { label: string; ayuda: string }> = {
  SIN_INTERACCION: { label: 'Sin interacción', ayuda: 'Nunca contestó' },
  CONFORME: { label: 'Conforme', ayuda: 'Contestó y solo acusó recibo' },
  CONFORME_INCIDENCIA_RESUELTA: { label: 'Conforme, temas resueltos', ayuda: 'Trajo temas y todos se cerraron' },
  INCONFORME_CON_DUDA: { label: 'Con duda abierta', ayuda: 'Le quedó una pregunta sin resolver' },
  INCONFORME_CON_RECLAMO: { label: 'Con reclamo abierto', ayuda: 'Le quedó un reclamo o un retiro sin resolver' },
  NO_CLASIFICABLE: { label: 'No clasificable', ayuda: 'Solo mandó saludos o audios' },
}

export const ESTADO_ETAPA_LABEL: Record<string, string> = {
  NO_INICIADA: 'No iniciada',
  EN_CURSO: 'En curso',
  CERRADA: 'Cerrada',
  SALIDA_REN1: 'Salida por renuncia en 1.ª asamblea',
  SALIDA_RETIRO: 'Salida por retiro',
}

export const ESTADO_INCIDENCIA_LABEL: Record<string, string> = {
  ABIERTA: 'Abierta',
  EN_INTENTO: 'En intento',
  RESUELTA_BOT: 'Resuelta por el bot',
  DERIVADA: 'Derivada',
  RESUELTA_HUMANO: 'Resuelta por el asesor',
  ABANDONADA: 'Abandonada',
  NO_RESUELTA_CIERRE: 'Sin resolver al cierre',
}

// Por qué llegó al asesor. RETIRO va primero siempre.
export const MOTIVO_DERIVACION_LABEL: Record<string, { label: string; ayuda: string }> = {
  RETIRO: { label: 'Retiro', ayuda: 'Pidió retirarse' },
  CAJA_NEGRA: { label: 'Caja negra', ayuda: 'Seguros, legal, traspaso o pidió un asesor' },
  TRES_INTENTOS: { label: 'Tres intentos', ayuda: 'El bot lo intentó tres veces y no lo resolvió' },
}

// Las cajas del centro de tareas del asesor. `edu_incidencia.tipo` lo calcula
// Postgres desde `categoria`: funcionamiento y pagos -> PREGUNTA, caja_negra ->
// CAJA_NEGRA, contradictoria/incompleta/reclamo_frustracion -> RECLAMO,
// retiro -> RETIRO.
export const TIPOS_TAREA = [
  {
    tipo: 'RETIRO',
    label: 'Retiro',
    ayuda: 'Pidió retirarse — atención inmediata',
    icono: 'retiro',
    className: 'border-t-red-500',
    acento: 'bg-red-50 text-red-700',
  },
  {
    tipo: 'RECLAMO',
    label: 'Reclamo',
    ayuda: 'Molestias y reclamos sin resolver',
    icono: 'reclamo',
    className: 'border-t-amber-500',
    acento: 'bg-amber-50 text-amber-800',
  },
  {
    tipo: 'CAJA_NEGRA',
    label: 'Caja negra',
    ayuda: 'Seguros, legal, traspaso o pidió un asesor',
    icono: 'caja',
    className: 'border-t-violet-500',
    acento: 'bg-violet-50 text-violet-700',
  },
  {
    tipo: 'PREGUNTA',
    label: 'Pregunta',
    ayuda: 'Dudas de funcionamiento y de pagos',
    icono: 'pregunta',
    className: 'border-t-sky-500',
    acento: 'bg-sky-50 text-sky-700',
  },
] as const

export const OTRO_TIPO = {
  tipo: 'OTROS',
  label: 'Otros',
  ayuda: 'Temas sin tipo asignado',
  icono: 'otros',
  className: 'border-t-slate-400',
  acento: 'bg-slate-100 text-slate-700',
} as const

// Resultados que exigen confirmación porque no se pueden deshacer desde el CRM:
// RETIRO cierra la etapa y NUMERO_ERRADO saca al cliente del bot.
export const RESULTADOS_PELIGROSOS = new Set(['RETIRO', 'NUMERO_ERRADO'])
// Resultados que dejan la incidencia en la bandeja.
export const RESULTADOS_NO_CIERRAN = new Set(['SEGUIMIENTO', 'NO_CONTESTO'])
// Al cuarto "no contestó" la incidencia se cierra sola como ABANDONADA.
export const MAX_NO_CONTESTO = 4

// Gestiones que el asesor registra en el CRM (crm_acciones): el registro de lo
// que hizo. Usan las mismas seis claves que la v2 del bot para no manejar dos
// vocabularios, pero registrar una gestión NO le avisa al bot: cerrar el tema
// es una acción aparte (CerrarGestionDialog).
export const TIPOS_ACCION = [
  { value: 'LLAMADA', label: 'Llamada' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'NOTA', label: 'Nota' },
] as const

export const RESULTADOS_ACCION = [
  { value: 'RESUELTA', label: 'Resuelta', ayuda: 'Hablé con el cliente y su necesidad quedó atendida' },
  { value: 'NO_RESUELTA', label: 'No resuelta', ayuda: 'Se cerró sin resolver lo que traía' },
  { value: 'SEGUIMIENTO', label: 'Seguimiento', ayuda: 'Queda pendiente de retomar en una fecha' },
  { value: 'NO_CONTESTO', label: 'No contestó', ayuda: 'No se pudo contactar en este intento' },
  { value: 'RETIRO', label: 'Retiro', ayuda: 'Confirmó que se retira' },
  { value: 'NUMERO_ERRADO', label: 'Número equivocado', ayuda: 'El número no corresponde al cliente' },
] as const

// Cliente de prueba en producción: se marca en las listas y se excluye de las
// métricas del piloto.
export const PREFIJO_PRUEBA = 'PRUEBA'

export function label(value: string | null | undefined) {
  if (!value) return '—'
  const limpio = value.replace(/_/g, ' ').toLowerCase()
  return limpio.charAt(0).toUpperCase() + limpio.slice(1)
}
