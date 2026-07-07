// Serialización de los filtros de segmentación (segmento / estrategia / frente).
// Cada filtro puede tener uno o varios valores. En la BD se guardan en columnas
// de texto: un solo valor se guarda tal cual (compatibilidad con campañas
// antiguas) y varios valores se guardan como un arreglo JSON (["A","B"]).

// Normaliza cualquier entrada (string, arreglo o null/undefined) a una lista de
// valores no vacíos y sin espacios sobrantes.
export function normalizeFilterValues(value?: string | string[] | null): string[] {
  if (value == null) return []
  const arr = Array.isArray(value) ? value : [value]
  return arr.map((v) => String(v).trim()).filter((v) => v.length > 0)
}

// Convierte la selección del usuario en el valor que se guarda en la columna.
// - 0 valores  -> null
// - 1 valor    -> ese string (formato heredado, legible en la BD)
// - 2+ valores -> arreglo JSON
export function serializeFilterValue(value?: string | string[] | null): string | null {
  const list = normalizeFilterValues(value)
  if (list.length === 0) return null
  if (list.length === 1) return list[0]
  return JSON.stringify(list)
}

// Lee el valor guardado en la columna y lo devuelve como lista. Soporta tanto el
// formato antiguo (string simple) como el nuevo (arreglo JSON).
export function parseFilterValue(stored?: string | null): string[] {
  if (stored == null) return []
  const trimmed = stored.trim()
  if (trimmed.length === 0) return []
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return normalizeFilterValues(parsed as string[])
    } catch {
      // No era JSON válido: se trata como un único valor literal.
    }
  }
  return [trimmed]
}
