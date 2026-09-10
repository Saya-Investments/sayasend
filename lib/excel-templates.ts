import * as XLSX from 'xlsx'

// ============================================================================
// Parseo del Excel de carga masiva de plantillas. Una fila = una plantilla.
// Sigue el mismo patrón que excel-contacts.ts: resuelve encabezados por alias
// (para tolerar cómo cada quien nombra las columnas) y valida fila por fila
// devolviendo los errores con el número de fila del Excel, para que el usuario
// pueda corregir el archivo sin adivinar.
//
// Solo `nombre` y `mensaje` son obligatorias. `ejemplos_mensaje` es obligatoria
// únicamente cuando el mensaje trae variables, porque Meta rechaza la plantilla
// si faltan los ejemplos.
// ============================================================================

export type BulkTemplateRow = {
  /** Fila del Excel (1-based, contando el encabezado) — para reportar errores. */
  fila: number
  /** Nombre tal cual lo escribió el usuario. */
  nombreOriginal: string
  /** Nombre normalizado a lo que acepta Meta (a-z, 0-9, _). */
  nombre: string
  mensaje: string
  ejemplosMensaje: string[]
  categoria: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  idioma: string
  header: string | null
  ejemplosHeader: string[]
  footer: string | null
  descripcion: string | null
  /** Si tiene errores, la fila no se puede enviar a Meta. */
  errores: string[]
  /** Cosas que conviene revisar pero no bloquean el envío. */
  advertencias: string[]
}

export type TemplatesParseResult =
  | { success: true; rows: BulkTemplateRow[]; columnasOpcionales: string[] }
  | { success: false; error: string }

export const CATEGORIAS_VALIDAS = ['MARKETING', 'UTILITY', 'AUTHENTICATION'] as const

/**
 * Cuántas plantillas manda el cliente por request a /api/templates/bulk.
 * Crear una plantilla toma ~1-2s (Meta + BD + la pausa anti-rate-limit), así
 * que un archivo de 200 filas en un solo request se pasaría del timeout de la
 * función. Troceado, cada request queda en ~30s y además podemos mostrar el
 * avance. El versionado sigue siendo correcto entre tandas porque cada request
 * relee los nombres ya ocupados (BD + Meta) antes de arrancar.
 */
export const TAMANO_LOTE = 20

// Límites de Meta (Cloud API). Si los pasás, la creación falla o la plantilla
// se rechaza en revisión.
const MAX_NOMBRE = 512
const MAX_MENSAJE = 1024
const MAX_HEADER = 60
const MAX_FOOTER = 60

/** Separador de listas dentro de una celda. No usamos coma: los ejemplos
 *  reales traen comas (montos, fechas) y romperían el split. */
const SEPARADOR_LISTA = '|'

const NOMBRE_ALIASES = ['nombre', 'nombre plantilla', 'nombre de plantilla', 'template', 'name']

const MENSAJE_ALIASES = [
  'mensaje',
  'cuerpo',
  'body',
  'contenido',
  'texto',
  'mensaje plantilla',
]

const EJEMPLOS_MENSAJE_ALIASES = [
  'ejemplos_mensaje',
  'ejemplos mensaje',
  'ejemplos',
  'ejemplos de mensaje',
  'ejemplos variables',
  'ejemplos de variables',
  'variables',
  'ejemplos body',
]

const CATEGORIA_ALIASES = ['categoria', 'categoría', 'category', 'tipo']

const IDIOMA_ALIASES = ['idioma', 'lenguaje', 'language', 'lang']

const HEADER_ALIASES = ['header', 'header_texto', 'header texto', 'encabezado', 'titulo', 'título']

const EJEMPLOS_HEADER_ALIASES = [
  'ejemplos_header',
  'ejemplos header',
  'ejemplos encabezado',
  'ejemplo header',
]

const FOOTER_ALIASES = ['footer', 'pie', 'pie de pagina', 'pie de página']

const DESCRIPCION_ALIASES = ['descripcion', 'descripción', 'nota', 'notas', 'description']

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function findHeaderIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normalizeHeader)
  for (const alias of aliases) {
    const index = normalized.indexOf(alias)
    if (index !== -1) return index
  }
  return -1
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toFixed(0) : String(value)
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value instanceof Date) return value.toISOString().split('T')[0]
  return String(value).trim()
}

/**
 * Normaliza el nombre a lo único que acepta Meta: minúsculas, dígitos y
 * guion bajo. Mismo criterio que meta-template-service.normalizeName().
 */
export function normalizeTemplateName(nombre: string): string {
  return nombre
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, MAX_NOMBRE)
}

/**
 * Devuelve las variables {{n}} del texto, ordenadas y sin repetir.
 * `Hola {{1}}, {{2}} y otra vez {{1}}` → [1, 2]
 */
export function extraerVariables(texto: string): number[] {
  const encontradas = new Set<number>()
  for (const match of texto.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) {
    encontradas.add(Number(match[1]))
  }
  return [...encontradas].sort((a, b) => a - b)
}

/**
 * Si el nombre ya está tomado, le agrega _v2, _v3... hasta encontrar uno libre.
 * `taken` debe traer los nombres ya existentes (BD + Meta + los de este mismo
 * archivo). El llamador es responsable de agregar el resultado al set.
 */
export function resolverNombreUnico(nombreNormalizado: string, taken: Set<string>): string {
  if (!taken.has(nombreNormalizado)) return nombreNormalizado

  // El sufijo cuenta contra el límite de Meta, así que recortamos la base.
  for (let version = 2; version <= 999; version++) {
    const sufijo = `_v${version}`
    const base = nombreNormalizado.slice(0, MAX_NOMBRE - sufijo.length)
    const candidato = `${base}${sufijo}`
    if (!taken.has(candidato)) return candidato
  }

  throw new Error(`No se pudo generar un nombre único para "${nombreNormalizado}" (999 versiones)`)
}

function splitLista(valor: string): string[] {
  if (!valor) return []
  return valor
    .split(SEPARADOR_LISTA)
    .map((s) => s.trim())
    .filter(Boolean)
}

function validarFila(row: BulkTemplateRow) {
  const { errores, advertencias } = row

  if (!row.nombreOriginal) {
    errores.push('Falta el nombre.')
  } else if (!row.nombre) {
    errores.push(
      `El nombre "${row.nombreOriginal}" queda vacío al normalizarlo. Meta solo acepta letras a-z, números y guion bajo.`,
    )
  } else if (row.nombre !== row.nombreOriginal.toLowerCase().trim().replace(/\s+/g, '_')) {
    advertencias.push(`El nombre se normalizó a "${row.nombre}".`)
  }

  if (!row.mensaje) {
    errores.push('Falta el mensaje.')
    return
  }
  if (row.mensaje.length > MAX_MENSAJE) {
    errores.push(`El mensaje tiene ${row.mensaje.length} caracteres (máximo ${MAX_MENSAJE}).`)
  }

  const variables = extraerVariables(row.mensaje)

  // Meta exige que las variables sean correlativas desde 1: {{1}}, {{2}}, {{3}}.
  const correlativas = variables.every((n, i) => n === i + 1)
  if (variables.length > 0 && !correlativas) {
    errores.push(
      `Las variables deben ser correlativas desde {{1}}. En el mensaje están: ${variables
        .map((n) => `{{${n}}}`)
        .join(', ')}.`,
    )
  }

  if (variables.length > 0) {
    if (row.ejemplosMensaje.length === 0) {
      errores.push(
        `El mensaje tiene ${variables.length} variable(s) y no hay ejemplos. Meta los exige para aprobar. Separalos con "${SEPARADOR_LISTA}".`,
      )
    } else if (row.ejemplosMensaje.length !== variables.length) {
      errores.push(
        `El mensaje tiene ${variables.length} variable(s) pero hay ${row.ejemplosMensaje.length} ejemplo(s). Debe haber uno por variable, separados con "${SEPARADOR_LISTA}".`,
      )
    }
  } else if (row.ejemplosMensaje.length > 0) {
    advertencias.push('El mensaje no tiene variables; los ejemplos se ignoran.')
    row.ejemplosMensaje = []
  }

  // Motivos de rechazo frecuentes en la revisión de Meta, aunque la creación
  // devuelva OK. No bloqueamos, pero avisamos.
  const sinEspacios = row.mensaje.trim()
  if (/^\{\{\s*\d+\s*\}\}/.test(sinEspacios)) {
    advertencias.push('El mensaje empieza con una variable; Meta suele rechazarlo.')
  }
  if (/\{\{\s*\d+\s*\}\}$/.test(sinEspacios)) {
    advertencias.push('El mensaje termina con una variable; Meta suele rechazarlo.')
  }
  if (/\{\{\s*\d+\s*\}\}\s*\{\{\s*\d+\s*\}\}/.test(sinEspacios)) {
    advertencias.push('Hay dos variables seguidas; Meta suele rechazarlo.')
  }

  if (row.header) {
    if (row.header.length > MAX_HEADER) {
      errores.push(`El header tiene ${row.header.length} caracteres (máximo ${MAX_HEADER}).`)
    }
    const varsHeader = extraerVariables(row.header)
    if (varsHeader.length > 1) {
      errores.push('El header admite como máximo una variable.')
    } else if (varsHeader.length === 1 && row.ejemplosHeader.length === 0) {
      errores.push('El header tiene una variable y falta su ejemplo en "ejemplos_header".')
    }
  }

  if (row.footer) {
    if (row.footer.length > MAX_FOOTER) {
      errores.push(`El footer tiene ${row.footer.length} caracteres (máximo ${MAX_FOOTER}).`)
    }
    if (extraerVariables(row.footer).length > 0) {
      errores.push('El footer no admite variables.')
    }
  }
}

export async function parseTemplatesExcel(file: File): Promise<TemplatesParseResult> {
  try {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
      return { success: false, error: 'El archivo Excel no contiene hojas.' }
    }

    const sheet = workbook.Sheets[firstSheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
      raw: true,
    })

    if (rows.length < 2) {
      return {
        success: false,
        error: 'El archivo no tiene filas de datos. Debe incluir encabezados y al menos una fila.',
      }
    }

    const headerRow = rows[0].map((c) => String(c ?? ''))
    const idx = {
      nombre: findHeaderIndex(headerRow, NOMBRE_ALIASES),
      mensaje: findHeaderIndex(headerRow, MENSAJE_ALIASES),
      ejemplosMensaje: findHeaderIndex(headerRow, EJEMPLOS_MENSAJE_ALIASES),
      categoria: findHeaderIndex(headerRow, CATEGORIA_ALIASES),
      idioma: findHeaderIndex(headerRow, IDIOMA_ALIASES),
      header: findHeaderIndex(headerRow, HEADER_ALIASES),
      ejemplosHeader: findHeaderIndex(headerRow, EJEMPLOS_HEADER_ALIASES),
      footer: findHeaderIndex(headerRow, FOOTER_ALIASES),
      descripcion: findHeaderIndex(headerRow, DESCRIPCION_ALIASES),
    }

    if (idx.nombre === -1) {
      return { success: false, error: 'No se encontró la columna "nombre" en el archivo.' }
    }
    if (idx.mensaje === -1) {
      return { success: false, error: 'No se encontró la columna "mensaje" en el archivo.' }
    }

    const columnasOpcionales = (
      ['ejemplosMensaje', 'categoria', 'idioma', 'header', 'ejemplosHeader', 'footer', 'descripcion'] as const
    ).filter((k) => idx[k] !== -1)

    const parsed: BulkTemplateRow[] = []

    for (let i = 1; i < rows.length; i++) {
      const raw = rows[i]
      if (!raw || raw.every((c) => c === null || c === undefined || c === '')) continue

      const get = (index: number) => (index === -1 ? '' : cellToString(raw[index]))

      const nombreOriginal = get(idx.nombre)
      const categoriaRaw = get(idx.categoria).toUpperCase()
      const categoriaValida = (CATEGORIAS_VALIDAS as readonly string[]).includes(categoriaRaw)

      const row: BulkTemplateRow = {
        fila: i + 1, // +1 porque el Excel es 1-based y la fila 1 es el encabezado
        nombreOriginal,
        nombre: normalizeTemplateName(nombreOriginal),
        mensaje: get(idx.mensaje),
        ejemplosMensaje: splitLista(get(idx.ejemplosMensaje)),
        categoria: categoriaValida
          ? (categoriaRaw as BulkTemplateRow['categoria'])
          : 'MARKETING',
        idioma: get(idx.idioma) || 'es_CO',
        header: get(idx.header) || null,
        ejemplosHeader: splitLista(get(idx.ejemplosHeader)),
        footer: get(idx.footer) || null,
        descripcion: get(idx.descripcion) || null,
        errores: [],
        advertencias: [],
      }

      if (categoriaRaw && !categoriaValida) {
        row.advertencias.push(
          `Categoría "${categoriaRaw}" no reconocida, se usa MARKETING. Válidas: ${CATEGORIAS_VALIDAS.join(', ')}.`,
        )
      }

      validarFila(row)
      parsed.push(row)
    }

    if (parsed.length === 0) {
      return { success: false, error: 'El archivo no contiene filas con datos.' }
    }

    // Nombres repetidos dentro del propio archivo: no es un error, se versionan
    // igual que contra los ya existentes. Solo avisamos.
    const vistos = new Map<string, number>()
    for (const row of parsed) {
      if (!row.nombre) continue
      const previa = vistos.get(row.nombre)
      if (previa !== undefined) {
        row.advertencias.push(
          `El nombre "${row.nombre}" ya aparece en la fila ${previa} del archivo; se creará como versión.`,
        )
      } else {
        vistos.set(row.nombre, row.fila)
      }
    }

    return { success: true, rows: parsed, columnasOpcionales }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido al leer el archivo.'
    return { success: false, error: `No se pudo procesar el archivo: ${message}` }
  }
}

/**
 * Genera el .xlsx de ejemplo que se descarga desde el diálogo, con los
 * encabezados que entiende el parser y dos filas de muestra.
 */
export function generarExcelEjemplo(): Blob {
  const datos = [
    [
      'nombre',
      'mensaje',
      'ejemplos_mensaje',
      'categoria',
      'idioma',
      'header',
      'ejemplos_header',
      'footer',
      'descripcion',
    ],
    [
      'recordatorio cuota',
      'Hola {{1}}, te recordamos que tu cuota de {{2}} vence el {{3}}. Puedes pagarla desde la app.',
      'Juan|150000|30 de noviembre',
      'UTILITY',
      'es_CO',
      '',
      '',
      'Saya Investments',
      'Recordatorio mensual de pago',
    ],
    [
      'bienvenida asociados',
      'Bienvenido a Saya. Estamos felices de tenerte con nosotros y te acompañaremos en cada paso.',
      '',
      'MARKETING',
      'es_CO',
      '',
      '',
      'Saya Investments',
      '',
    ],
  ]

  const sheet = XLSX.utils.aoa_to_sheet(datos)
  sheet['!cols'] = [
    { wch: 24 },
    { wch: 60 },
    { wch: 32 },
    { wch: 14 },
    { wch: 10 },
    { wch: 20 },
    { wch: 18 },
    { wch: 20 },
    { wch: 28 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Plantillas')

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
