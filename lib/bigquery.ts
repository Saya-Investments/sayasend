import { BigQuery } from '@google-cloud/bigquery'

import type { BigQueryColumn, BigQueryContactsPayload } from '@/lib/types'

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

function toStringValue(value: unknown) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
}

function toNullableString(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  return String(value)
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

export async function queryBigQueryContacts(
  tableName: string,
  filters: BigQueryContactFilters,
): Promise<BigQueryContactsPayload> {
  validateTableName(tableName)

  const clauses: string[] = []
  const params: Record<string, string> = {}

  if (filters.segmento) {
    clauses.push('CAST(src.`segmento` AS STRING) = @segmento')
    params.segmento = filters.segmento
  }

  if (filters.estrategia) {
    clauses.push('CAST(src.`gestion` AS STRING) = @estrategia')
    params.estrategia = filters.estrategia
  }

  const whereClause = clauses.length > 0 ? `AND ${clauses.join(' AND ')}` : ''

  const query = `
    WITH ciclo_activo AS (
      SELECT
        fecha_inicio_ciclo,
        fecha_fin_ciclo,
        mes_corte,
        mes_corte_label
      FROM \`${BIGQUERY_PROJECT_ID}.${BIGQUERY_DATASET_ID}.ciclos_pago\`
      WHERE CURRENT_DATE('America/Bogota') BETWEEN fecha_inicio_ciclo AND fecha_fin_ciclo
      QUALIFY ROW_NUMBER() OVER (ORDER BY fecha_inicio_ciclo DESC) = 1
    ),
    morosos AS (
      SELECT
        h.DNI,
        STRING_AGG(DISTINCT CAST(h.Contrato AS STRING), ', ' ORDER BY CAST(h.Contrato AS STRING)) AS Contrato,
        ANY_VALUE(h.Frente) AS Frente,
        ANY_VALUE(h.segmento) AS segmento,
        ANY_VALUE(h.estrategia) AS estrategia,
        SUM(h.Cuota) AS Cuota,
        ANY_VALUE(h.Fec_Ult_Pag_CCAP) AS Fec_Ult_Pag_CCAP,
        ANY_VALUE(h.Zona) AS Zona,
        ANY_VALUE(h.mes) AS mes
      FROM \`${BIGQUERY_PROJECT_ID}.${BIGQUERY_DATASET_ID}.Historico_BDfondos_Scoring\` h
      JOIN \`${BIGQUERY_PROJECT_ID}.${BIGQUERY_DATASET_ID}.ciclos_pago\` c
        ON h.mes_corte = c.mes_corte_label
      WHERE CURRENT_DATE('America/Bogota') BETWEEN c.fecha_inicio_ciclo AND c.fecha_fin_ciclo
        AND (
          h.Fec_Ult_Pag_CCAP IS NULL
          OR h.Fec_Ult_Pag_CCAP < c.fecha_inicio_ciclo
        )
      GROUP BY h.DNI
    )
    SELECT
      CAST(src.\`Codigo Asociado\` AS STRING) AS codigoAsociado,
      CAST(src.\`Num Doc\` AS STRING) AS numDoc,
      SAFE_CAST(src.\`probabilidad_pago\` AS NUMERIC) AS probabilidadPago,
      CAST(src.\`segmento\` AS STRING) AS segmento,
      CAST(src.\`gestion\` AS STRING) AS gestion,
      CAST(morosos.Frente AS STRING) AS frente,
      CAST(fondos.\`Nombres\` AS STRING) AS nombre,
      CAST(fondos.\`Telf_SMS\` AS STRING) AS telefono,
      SAFE_CAST(morosos.Cuota AS NUMERIC) AS monto,
      ciclo.fecha_inicio_ciclo AS fechaAsamblea,
      ciclo.fecha_fin_ciclo AS fechaVencimiento,
      CAST(morosos.mes AS STRING) AS mes,
      morosos.Fec_Ult_Pag_CCAP AS fecUltPagCcap,
      morosos.Fec_Ult_Pag_CCAP AS fechaUltimoPago
    FROM \`${BIGQUERY_PROJECT_ID}.${BIGQUERY_DATASET_ID}.${tableName}\` src
    JOIN morosos
      ON CAST(src.\`Num Doc\` AS STRING) = CAST(morosos.DNI AS STRING)
      AND REGEXP_CONTAINS(
        CONCAT(', ', morosos.Contrato, ', '),
        CONCAT(', ', CAST(src.\`Codigo Asociado\` AS STRING), ', ')
      )
    LEFT JOIN \`${BIGQUERY_PROJECT_ID}.${BIGQUERY_DATASET_ID}.DB_BDfondos_actual\` fondos
      ON CAST(src.\`Codigo Asociado\` AS STRING) = CAST(fondos.\`Codigo_Asociado\` AS STRING)
    CROSS JOIN ciclo_activo ciclo
    WHERE 1 = 1
      ${whereClause}
    ORDER BY CAST(src.\`segmento\` AS STRING), SAFE_CAST(morosos.Cuota AS NUMERIC) DESC
    LIMIT 200
  `

  const [rows] = await getBigQueryClient().query({ query, params })
  const serializedRows = rows.map((row) => serializeBigQueryValue(row) as Record<string, unknown>)

  const contacts = serializedRows.map((row) => ({
    codigoAsociado: toStringValue(row.codigoAsociado),
    numDoc: toStringValue(row.numDoc),
    probabilidadPago: toNumber(row.probabilidadPago),
    segmento: toStringValue(row.segmento),
    gestion: toStringValue(row.gestion),
    frente: toNullableString(row.frente),
    nombre: toStringValue(row.nombre),
    telefono: toStringValue(row.telefono),
    monto: toNumber(row.monto),
    fechaAsamblea: toNullableString(row.fechaAsamblea),
    fechaVencimiento: toNullableString(row.fechaVencimiento),
    mes: toNullableString(row.mes) ?? '',
    fecUltPagCcap: toNullableString(row.fecUltPagCcap),
    fechaUltimoPago: toNullableString(row.fechaUltimoPago),
  }))

  const columns: BigQueryColumn[] = [
    { name: 'codigoAsociado', type: 'STRING' },
    { name: 'numDoc', type: 'STRING' },
    { name: 'probabilidadPago', type: 'NUMERIC' },
    { name: 'segmento', type: 'STRING' },
    { name: 'gestion', type: 'STRING' },
    { name: 'frente', type: 'STRING' },
    { name: 'nombre', type: 'STRING' },
    { name: 'telefono', type: 'STRING' },
    { name: 'monto', type: 'NUMERIC' },
    { name: 'fechaAsamblea', type: 'DATE' },
    { name: 'fechaVencimiento', type: 'DATE' },
    { name: 'mes', type: 'STRING' },
    { name: 'fecUltPagCcap', type: 'DATE' },
  ]

  return {
    columns,
    contacts,
  }
}
