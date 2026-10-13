// Días hábiles de Colombia: lunes a viernes que no son festivo. Las fechas van
// como "YYYY-MM-DD" y se calculan en UTC para que la zona horaria del servidor
// no corra el día.
//
// Este archivo no importa nada a propósito: lo usan tanto la app como los
// scripts que corren con `node --experimental-strip-types`.

const DIA_MS = 24 * 60 * 60 * 1000

function fecha(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day))
}

export function aTexto(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function desdeTexto(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return fecha(year, month, day)
}

function sumarDias(date: Date, dias: number) {
  return new Date(date.getTime() + dias * DIA_MS)
}

// Ley Emiliani: el festivo que no cae en lunes se pasa al lunes siguiente.
function alLunes(date: Date) {
  const dow = date.getUTCDay()
  return dow === 1 ? date : sumarDias(date, (8 - dow) % 7)
}

// Domingo de Pascua (algoritmo de Meeus/Jones/Butcher, calendario gregoriano).
function pascua(year: number) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return fecha(year, month, day)
}

const festivosCache = new Map<number, Set<string>>()

export function festivosColombia(year: number) {
  const cached = festivosCache.get(year)
  if (cached) return cached

  const domingoPascua = pascua(year)
  const festivos = [
    // Fijos
    fecha(year, 1, 1),
    fecha(year, 5, 1),
    fecha(year, 7, 20),
    fecha(year, 8, 7),
    fecha(year, 12, 8),
    fecha(year, 12, 25),
    // Se trasladan al lunes
    alLunes(fecha(year, 1, 6)),
    alLunes(fecha(year, 3, 19)),
    alLunes(fecha(year, 6, 29)),
    alLunes(fecha(year, 8, 15)),
    alLunes(fecha(year, 10, 12)),
    alLunes(fecha(year, 11, 1)),
    alLunes(fecha(year, 11, 11)),
    // Dependen de la Pascua
    sumarDias(domingoPascua, -3), // Jueves Santo
    sumarDias(domingoPascua, -2), // Viernes Santo
    sumarDias(domingoPascua, 43), // Ascensión (lunes)
    sumarDias(domingoPascua, 64), // Corpus Christi (lunes)
    sumarDias(domingoPascua, 71), // Sagrado Corazón (lunes)
  ]

  const set = new Set(festivos.map(aTexto))
  festivosCache.set(year, set)
  return set
}

export function esDiaHabil(date: Date) {
  const dow = date.getUTCDay()
  return dow !== 0 && dow !== 6 && !festivosColombia(date.getUTCFullYear()).has(aTexto(date))
}

export function nesimoDiaHabil(year: number, month: number, n: number) {
  let date = fecha(year, month, 1)
  let contados = 0
  for (;;) {
    if (esDiaHabil(date) && ++contados === n) return date
    date = sumarDias(date, 1)
  }
}

// La 1ra asamblea principal de cada mes cae el 6to día hábil (verificado
// contra todo el histórico de Fec_1raAsamb de 2025 y 2026). Las asambleas
// sueltas de mitad o fin de mes no cuentan.
export const DIA_HABIL_ASAMBLEA = 6

export function asambleaPrincipal(year: number, month: number) {
  return nesimoDiaHabil(year, month, DIA_HABIL_ASAMBLEA)
}

// La próxima asamblea principal estrictamente posterior a `hoy`: si la de este
// mes ya pasó (o es hoy), la del mes siguiente.
export function proximaAsamblea(hoy: string) {
  const ref = desdeTexto(hoy)
  const year = ref.getUTCFullYear()
  const month = ref.getUTCMonth() + 1

  const deEsteMes = asambleaPrincipal(year, month)
  if (aTexto(deEsteMes) > hoy) return aTexto(deEsteMes)

  return month === 12 ? aTexto(asambleaPrincipal(year + 1, 1)) : aTexto(asambleaPrincipal(year, month + 1))
}

// "YYYY-MM-DD" de hoy en Colombia, sin importar la zona del servidor.
export function hoyEnColombia(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(now)
}
