// Sorteo reproducible del grupo retador. Con la misma lista y la misma semilla
// sale siempre el mismo resultado, para poder repetirlo si alguien lo pide.
//
// Este archivo no importa nada a propósito: lo usan tanto la app como los
// scripts que corren con `node --experimental-strip-types`.

export const PORCENTAJE_RETADOR = 0.4
// Con menos acumulados no se sortea: se espera a que entren más inscritos.
export const MINIMO_PARA_SORTEAR = 4
const SEMILLA_BASE = 2026

// FNV-1a de 32 bits: convierte la fecha de la corrida en un número estable.
export function semillaDeCorrida(fechaCorrida: string) {
  let hash = 0x811c9dc5
  for (const char of `${SEMILLA_BASE}:${fechaCorrida}`) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

// mulberry32: generador pseudoaleatorio chico y determinista.
function generador(semilla: number) {
  let state = semilla >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function cantidadRetadores(total: number) {
  return total < MINIMO_PARA_SORTEAR ? 0 : Math.floor(total * PORCENTAJE_RETADOR)
}

// Se ordena por la clave antes de barajar para que el orden en que llegan las
// filas (BigQuery no garantiza ninguno) no cambie el resultado.
export function sortear<T>(items: T[], clave: (item: T) => string, semilla: number) {
  const ordenados = [...items].sort((a, b) => (clave(a) < clave(b) ? -1 : clave(a) > clave(b) ? 1 : 0))
  const random = generador(semilla)

  for (let i = ordenados.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[ordenados[i], ordenados[j]] = [ordenados[j], ordenados[i]]
  }

  const corte = cantidadRetadores(ordenados.length)
  return { retadores: ordenados.slice(0, corte), convencional: ordenados.slice(corte) }
}
