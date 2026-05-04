import * as XLSX from 'xlsx'

import type { CampaignContact } from '@/lib/types'

export type ExcelParseResult =
  | { success: true; contacts: CampaignContact[]; warnings: string[] }
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
]

const TELEFONO_ALIASES = [
  'telefono',
  'teléfono',
  'tel',
  'phone',
  'celular',
  'movil',
  'móvil',
  'numero telefono',
  'numero de telefono',
  'whatsapp',
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

export async function parseContactsExcel(file: File): Promise<ExcelParseResult> {
  try {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
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

    if (numDocIdx === -1) {
      return {
        success: false,
        error: 'No se encontró la columna "Num Doc" en el archivo.',
      }
    }
    if (telefonoIdx === -1) {
      return {
        success: false,
        error: 'No se encontró la columna "telefono" en el archivo.',
      }
    }

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

      if (!numDoc) {
        skippedNoDoc++
        continue
      }

      contacts.push({
        codigoAsociado: numDoc,
        numDoc,
        telefono,
        nombre: '',
        segmento: '',
        monto: 0,
        fechaUltimoPago: null,
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

    return { success: true, contacts, warnings }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido al leer el archivo.'
    return { success: false, error: `No se pudo procesar el archivo: ${message}` }
  }
}
