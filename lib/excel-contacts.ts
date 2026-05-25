import * as XLSX from 'xlsx'

import type { CampaignContact } from '@/lib/types'

export type ExcelParseResult =
  | { success: true; contacts: CampaignContact[]; warnings: string[]; foundOptionalColumns: string[] }
  | { success: false; error: string }

const NUM_DOC_ALIASES = [
  'num doc',
  'numdoc',
  'num_doc',
  'numero doc',
  'numero documento',
  'numero de documento',
  'número doc',
  'número documento',
  'número de documento',
  'documento',
  'dni',
  'doc',
  'cedula',
  'cédula',
  'num. doc',
  'nro doc',
  'nro. doc',
  'nro documento',
  'nro. documento',
  'ruc',
  'pasaporte',
  'identificacion',
  'identificación',
  'id cliente',
  'id',
]

const TELEFONO_ALIASES = [
  'nro. telefonico',
  'nro telefonico',
  'nro. telefónico',
  'nro telefónico',
  'telefono',
  'teléfono',
  'celular',
  'cel',
  'movil',
  'móvil',
  'numero celular',
  'número celular',
  'nro celular',
  'nro. celular',
  'numero telefono',
  'número teléfono',
  'nro telefono',
  'nro. telefono',
  'telefono sms',
  'teléfono sms',
  'tel',
  'tel.',
  'phone',
  'mobile',
  'numero movil',
  'número móvil',
  'nro movil',
  'nro. movil',
  'contacto',
]

const CODIGO_ASOCIADO_ALIASES = [
  'codigo asociado',
  'código asociado',
  'codigoasociado',
  'codigo_asociado',
  'cod asociado',
  'cod. asociado',
]

const MONTO_ALIASES = [
  'monto',
  'valor',
  'deuda',
  'saldo',
  'saldo deuda',
  'importe',
  'amount',
  'monto deuda',
  'saldo capital',
  'capital',
  'valor deuda',
  'total deuda',
  'total',
]

const NOMBRE_ALIASES = [
  'nombre',
  'nombres',
  'name',
  'nombre completo',
  'nombres y apellidos',
  'apellidos y nombres',
  'cliente',
  'nombre cliente',
  'razón social',
  'razon social',
]

const FECHA_VENCIMIENTO_ALIASES = [
  'fecha vencimiento',
  'fecha de vencimiento',
  'fec vencimiento',
  'fec. vencimiento',
  'vencimiento',
  'fecha_vencimiento',
  'fecha venc',
  'fec venc',
  'fec. venc',
  'f. vencimiento',
  'f vencimiento',
  'fecha vto',
  'vto',
  'fecha limite',
  'fecha límite',
  'fecha expiracion',
  'fecha expiración',
  'due date',
]

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function findHeaderIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normalizeHeader)
  for (let i = 0; i < normalized.length; i++) {
    if (aliases.includes(normalized[i])) {
      return i
    }
  }
  return -1
}

// Castea cualquier valor de celda a string. Para números, evita la notación
// científica (p. ej. 9.1234e+9 -> "9123400000") usando toFixed(0) cuando es entero.
export function castCellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') {
    if (Number.isFinite(value) && Number.isInteger(value)) {
      return value.toFixed(0)
    }
    return String(value).trim()
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value instanceof Date) return value.toISOString()
  return String(value).trim()
}

function parseMonto(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/[$€£%\s]/g, '').replace(/,/g, '')
    const num = parseFloat(cleaned)
    return Number.isFinite(num) ? num : 0
  }
  return 0
}

function parseFecha(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString().split('T')[0]
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }
  return null
}

export async function parseContactsExcel(file: File): Promise<ExcelParseResult> {
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
    const numDocIdx = findHeaderIndex(headerRow, NUM_DOC_ALIASES)
    const telefonoIdx = findHeaderIndex(headerRow, TELEFONO_ALIASES)
    const codigoAsociadoIdx = findHeaderIndex(headerRow, CODIGO_ASOCIADO_ALIASES)
    const nombreIdx = findHeaderIndex(headerRow, NOMBRE_ALIASES)
    const montoIdx = findHeaderIndex(headerRow, MONTO_ALIASES)
    const fechaVencimientoIdx = findHeaderIndex(headerRow, FECHA_VENCIMIENTO_ALIASES)

    if (numDocIdx === -1) {
      return {
        success: false,
        error: 'No se encontró la columna "Num Doc" en el archivo.',
      }
    }
    if (telefonoIdx === -1) {
      return {
        success: false,
        error: 'No se encontró la columna "Nro. Telefonico" en el archivo.',
      }
    }
    if (codigoAsociadoIdx === -1) {
      return {
        success: false,
        error: 'No se encontró la columna "Codigo Asociado" en el archivo.',
      }
    }

    const foundOptionalColumns: string[] = []
    if (nombreIdx !== -1) foundOptionalColumns.push('nombre')
    if (montoIdx !== -1) foundOptionalColumns.push('monto')
    if (fechaVencimientoIdx !== -1) foundOptionalColumns.push('fechaVencimiento')

    const contacts: CampaignContact[] = []
    const warnings: string[] = []
    let skippedEmpty = 0
    let skippedNoDoc = 0

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.every((c) => c === null || c === undefined || c === '')) {
        skippedEmpty++
        continue
      }

      const numDoc = castCellToString(row[numDocIdx])
      const telefono = castCellToString(row[telefonoIdx])
      const codigoAsociado = castCellToString(row[codigoAsociadoIdx])

      if (!numDoc) {
        skippedNoDoc++
        continue
      }

      contacts.push({
        codigoAsociado,
        numDoc,
        telefono,
        nombre: nombreIdx !== -1 ? castCellToString(row[nombreIdx]) : '',
        segmento: '',
        monto: montoIdx !== -1 ? parseMonto(row[montoIdx]) : 0,
        fechaUltimoPago: null,
        fechaVencimiento: fechaVencimientoIdx !== -1 ? parseFecha(row[fechaVencimientoIdx]) : null,
      })
    }

    if (contacts.length === 0) {
      return { success: false, error: 'El archivo no contiene filas válidas con "Num Doc".' }
    }

    if (skippedEmpty > 0) {
      warnings.push(`Se omitieron ${skippedEmpty} filas vacías.`)
    }
    if (skippedNoDoc > 0) {
      warnings.push(`Se omitieron ${skippedNoDoc} filas sin "Num Doc".`)
    }

    return { success: true, contacts, warnings, foundOptionalColumns }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido al leer el archivo.'
    return { success: false, error: `No se pudo procesar el archivo: ${message}` }
  }
}
