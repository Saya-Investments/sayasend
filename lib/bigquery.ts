import { BigQuery } from '@google-cloud/bigquery'

const BIGQUERY_PROJECT_ID = 'peak-emitter-350713'
const BIGQUERY_DATASET_ID = 'CDV_COL'
const TABLE_NAME_PATTERN = /^[A-Za-z0-9_]+$/

type BigQueryCredentialShape = {
  project_id?: string
  private_key?: string
  client_email?: string
}

export type BigQueryTableInfo = {
  id: string
  name: string
}

export type BigQueryColumnInfo = {
  name: string
  type: string
}

export type BigQueryContactFilters = {
  segmento?: string
  estrategia?: string
}

let bigQueryClient: BigQuery | null = null

function parseBigQueryCredentials(): BigQueryCredentialShape {
  const rawCredentials = process.env.BIG_QUERY_KEY

  if (!rawCredentials) {
    throw new Error('BIG_QUERY_KEY is not defined')
  }

  let normalizedCredentials = rawCredentials.trim()

  if (
    (normalizedCredentials.startsWith("'") && normalizedCredentials.endsWith("'")) ||
    (normalizedCredentials.startsWith('"') && normalizedCredentials.endsWith('"'))
  ) {
    normalizedCredentials = normalizedCredentials.slice(1, -1)
  }

  const credentials = JSON.parse(normalizedCredentials) as BigQueryCredentialShape

  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n')
  }

  return credentials
}

export function getBigQueryClient() {
  if (!bigQueryClient) {
    const credentials = parseBigQueryCredentials()

    bigQueryClient = new BigQuery({
      projectId: credentials.project_id ?? BIGQUERY_PROJECT_ID,
      credentials,
    })
  }

  return bigQueryClient
}

function validateTableName(tableName: string) {
  if (!TABLE_NAME_PATTERN.test(tableName)) {
    throw new Error('Invalid BigQuery table name')
  }
}

function normalizeKey(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function serializeBigQueryValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null
  }

  if (Array.isArray(value)) {
    return value.map(serializeBigQueryValue)
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'object') {
    if ('value' in (value as Record<string, unknown>) && typeof (value as { value?: unknown }).value !== 'object') {
      return (value as { value?: unknown }).value ?? null
    }

    if (typeof (value as { toJSON?: () => unknown }).toJSON === 'function') {
      return (value as { toJSON: () => unknown }).toJSON()
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        serializeBigQueryValue(nestedValue),
      ]),
    )
  }

  return value
}

function getFirstMatchingValue(
  row: Record<string, unknown>,
  candidateNames: string[],
) {
  const entries = Object.entries(row)
  const normalizedCandidates = new Set(candidateNames.map(normalizeKey))

  const match = entries.find(([key]) => normalizedCandidates.has(normalizeKey(key)))
  return match?.[1] ?? null
}

function toNumber(value: unknown) {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  return 0
}

function toStringValue(value: unknown) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
}

function normalizeContactRow(row: Record<string, unknown>) {
  const fechaUltimoPago =
    getFirstMatchingValue(row, [
      'fechaUltimoPago',
      'fecha_ultimo_pago',
      'fecUltPagCcap',
      'fec_ult_pag_ccap',
      'Fec_Ult_Pag_CCAP',
    ]) ?? null

  return {
    ...row,
    codigoAsociado: toStringValue(
      getFirstMatchingValue(row, ['codigoAsociado', 'codigo_asociado', 'cod_asociado']),
    ),
    dni: toStringValue(getFirstMatchingValue(row, ['dni'])),
    telefono: toStringValue(getFirstMatchingValue(row, ['telefono', 'celular', 'phone'])),
    nombre: toStringValue(getFirstMatchingValue(row, ['nombre', 'cliente', 'full_name'])),
    monto: toNumber(getFirstMatchingValue(row, ['monto', 'importe', 'saldo'])),
    probabilidad: toNumber(getFirstMatchingValue(row, ['probabilidad'])),
    segmento: toStringValue(getFirstMatchingValue(row, ['segmento'])),
    estrategia: toStringValue(getFirstMatchingValue(row, ['estrategia'])),
    fechaAsamblea: toStringValue(getFirstMatchingValue(row, ['fechaAsamblea', 'fecha_asamblea'])),
    fechaVencimiento: toStringValue(
      getFirstMatchingValue(row, ['fechaVencimiento', 'fecha_vencimiento']),
    ),
    fecUltPagCcap: toStringValue(
      getFirstMatchingValue(row, ['fecUltPagCcap', 'fec_ult_pag_ccap', 'Fec_Ult_Pag_CCAP']),
    ),
    fechaUltimoPago: fechaUltimoPago ? toStringValue(fechaUltimoPago) : null,
  }
}

export async function listBigQueryTables(): Promise<BigQueryTableInfo[]> {
  const dataset = getBigQueryClient().dataset(BIGQUERY_DATASET_ID)
  const [tables] = await dataset.getTables()

  return tables
    .map((table) => ({
      id: table.id ?? '',
      name: table.id ?? '',
    }))
    .filter((table) => table.id)
    .sort((left, right) => left.name.localeCompare(right.name))
}

export async function getBigQueryTableColumns(
  tableName: string,
): Promise<BigQueryColumnInfo[]> {
  validateTableName(tableName)

  const table = getBigQueryClient().dataset(BIGQUERY_DATASET_ID).table(tableName)
  const [metadata] = await table.getMetadata()
  const fields = metadata.schema?.fields ?? []

  return fields.map((field: { name: string; type?: string }) => ({
    name: field.name,
    type: field.type ?? 'STRING',
  }))
}

export async function queryBigQueryContacts(
  tableName: string,
  filters: BigQueryContactFilters,
) {
  validateTableName(tableName)

  const columns = await getBigQueryTableColumns(tableName)
  const normalizedColumnNames = new Set(columns.map((column) => normalizeKey(column.name)))
  const clauses: string[] = []
  const params: Record<string, string> = {}

  if (filters.segmento && normalizedColumnNames.has('segmento')) {
    clauses.push('CAST(segmento AS STRING) = @segmento')
    params.segmento = filters.segmento
  }

  if (filters.estrategia && normalizedColumnNames.has('estrategia')) {
    clauses.push('CAST(estrategia AS STRING) = @estrategia')
    params.estrategia = filters.estrategia
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
  const query = `
    SELECT *
    FROM \`${BIGQUERY_PROJECT_ID}.${BIGQUERY_DATASET_ID}.${tableName}\`
    ${whereClause}
    LIMIT 200
  `

  const [rows] = await getBigQueryClient().query({ query, params })
  const serializedRows = rows.map((row) => serializeBigQueryValue(row) as Record<string, unknown>)

  return {
    columns,
    contacts: serializedRows.map(normalizeContactRow),
  }
}
