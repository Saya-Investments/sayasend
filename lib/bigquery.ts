import { BigQuery } from '@google-cloud/bigquery'

import type { BigQueryColumn, BigQueryContactsPayload } from '@/lib/types'
import retencionRetadorPhones from '@/lib/retencion-retador-phones.json'

const BIGQUERY_PROJECT_ID = 'peak-emitter-350713'
const BIGQUERY_DATASET_ID = 'CDV_COL'
const TABLE_NAME_PATTERN = /^[A-Za-z0-9_]+$/

const RETENCION_RETADOR_PHONES: Record<string, string> = retencionRetadorPhones

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
  frente?: string
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

export async function listBigQueryFrentes(tableName: string): Promise<string[]> {
  validateTableName(tableName)

  const query = `
    SELECT DISTINCT CAST(\`Frente\` AS STRING) AS frente
    FROM \`${BIGQUERY_PROJECT_ID}.${BIGQUERY_DATASET_ID}.${tableName}\`
    WHERE \`Frente\` IS NOT NULL
      AND CAST(\`Frente\` AS STRING) != ''
    ORDER BY frente
  `

  const [rows] = await getBigQueryClient().query({ query })

  return rows
    .map((row) => {
      const serialized = serializeBigQueryValue(row) as Record<string, unknown>
      return toNullableString(serialized.frente)
    })
    .filter((value): value is string => value !== null)
}

export async function listBigQueryEstrategias(tableName: string): Promise<string[]> {
  validateTableName(tableName)

  const query = `
    SELECT DISTINCT CAST(\`estrategia\` AS STRING) AS estrategia
    FROM \`${BIGQUERY_PROJECT_ID}.${BIGQUERY_DATASET_ID}.${tableName}\`
    WHERE \`estrategia\` IS NOT NULL
      AND CAST(\`estrategia\` AS STRING) != ''
    ORDER BY estrategia
  `

  const [rows] = await getBigQueryClient().query({ query })

  return rows
    .map((row) => {
      const serialized = serializeBigQueryValue(row) as Record<string, unknown>
      return toNullableString(serialized.estrategia)
    })
    .filter((value): value is string => value !== null)
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
    clauses.push('CAST(src.`estrategia` AS STRING) = @estrategia')
    params.estrategia = filters.estrategia
  }

  if (filters.frente) {
    clauses.push('CAST(src.`Frente` AS STRING) = @frente')
    params.frente = filters.frente
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
    ciclo_siguiente AS (
      SELECT
        fecha_inicio_ciclo AS fecha_inicio_siguiente
      FROM \`${BIGQUERY_PROJECT_ID}.${BIGQUERY_DATASET_ID}.ciclos_pago\`
      WHERE fecha_inicio_ciclo > (SELECT fecha_fin_ciclo FROM ciclo_activo)
      QUALIFY ROW_NUMBER() OVER (ORDER BY fecha_inicio_ciclo ASC) = 1
    ),
    contratos_pendientes AS (
      SELECT
        CAST(src.\`Contrato\` AS STRING) AS contrato,
        CAST(src.\`DNI\` AS STRING) AS dni,
        SAFE_CAST(src.\`probabilidad\` AS NUMERIC) AS probabilidad,
        CAST(src.\`segmento\` AS STRING) AS segmento,
        CAST(src.\`estrategia\` AS STRING) AS estrategia,
        CAST(src.\`Frente\` AS STRING) AS frente,
        SAFE_CAST(src.\`Cuota\` AS NUMERIC) AS cuota,
        sig.fecha_inicio_siguiente AS fecha_asamblea,
        ciclo.fecha_fin_ciclo AS fecha_vencimiento,
        CAST(src.\`mes\` AS STRING) AS mes,
        src.\`Fec_Ult_Pag_CCAP\` AS fec_ult_pag_ccap
      FROM \`${BIGQUERY_PROJECT_ID}.${BIGQUERY_DATASET_ID}.${tableName}\` src
      JOIN ciclo_activo ciclo
        ON CAST(src.\`mes_corte\` AS STRING) = CAST(ciclo.mes_corte_label AS STRING)
      CROSS JOIN ciclo_siguiente sig
      WHERE (
          src.\`Fec_Ult_Pag_CCAP\` IS NULL
          OR src.\`Fec_Ult_Pag_CCAP\` < ciclo.fecha_inicio_ciclo
        )
        ${whereClause}
      QUALIFY ROW_NUMBER() OVER (
        PARTITION BY CAST(src.\`Contrato\` AS STRING)
        ORDER BY src.\`Fec_Ult_Pag_CCAP\` DESC NULLS LAST
      ) = 1
    ),
    contratos_con_fondos AS (
      SELECT
        c.*,
        CAST(fondos.\`Nombres\` AS STRING) AS nombre,
        CAST(fondos.\`Telefono_2\` AS STRING) AS telefono
      FROM contratos_pendientes c
      LEFT JOIN \`${BIGQUERY_PROJECT_ID}.${BIGQUERY_DATASET_ID}.DB_BDfondos_actual\` fondos
        ON c.contrato = CAST(fondos.\`Codigo_Asociado\` AS STRING)
    )
    SELECT
      STRING_AGG(contrato, ', ' ORDER BY IFNULL(cuota, 0) DESC) AS codigoAsociado,
      dni AS numDoc,
      ANY_VALUE(probabilidad HAVING MAX IFNULL(cuota, 0)) AS probabilidadPago,
      ANY_VALUE(segmento HAVING MAX IFNULL(cuota, 0)) AS segmento,
      ANY_VALUE(estrategia HAVING MAX IFNULL(cuota, 0)) AS gestion,
      ANY_VALUE(frente HAVING MAX IFNULL(cuota, 0)) AS frente,
      ANY_VALUE(nombre HAVING MAX IFNULL(cuota, 0)) AS nombre,
      ANY_VALUE(telefono HAVING MAX IFNULL(cuota, 0)) AS telefono,
      SUM(IFNULL(cuota, 0)) AS monto,
      ANY_VALUE(fecha_asamblea HAVING MAX IFNULL(cuota, 0)) AS fechaAsamblea,
      ANY_VALUE(fecha_vencimiento HAVING MAX IFNULL(cuota, 0)) AS fechaVencimiento,
      ANY_VALUE(mes HAVING MAX IFNULL(cuota, 0)) AS mes,
      ANY_VALUE(fec_ult_pag_ccap HAVING MAX IFNULL(cuota, 0)) AS fecUltPagCcap,
      ANY_VALUE(fec_ult_pag_ccap HAVING MAX IFNULL(cuota, 0)) AS fechaUltimoPago
    FROM contratos_con_fondos
    GROUP BY dni
    ORDER BY segmento, monto DESC
  `

  const [rows] = await getBigQueryClient().query({ query, params })
  const serializedRows = rows.map((row) => serializeBigQueryValue(row) as Record<string, unknown>)

  const contacts = serializedRows.map((row) => {
    const numDoc = toStringValue(row.numDoc)
    let telefono = toStringValue(row.telefono)

    if (!telefono && numDoc) {
      const fallback = RETENCION_RETADOR_PHONES[numDoc]
      if (fallback) {
        telefono = fallback
      }
    }

    return {
      codigoAsociado: toStringValue(row.codigoAsociado),
      numDoc,
      probabilidadPago: toNumber(row.probabilidadPago),
      segmento: toStringValue(row.segmento),
      gestion: toStringValue(row.gestion),
      frente: toNullableString(row.frente),
      nombre: toStringValue(row.nombre),
      telefono,
      monto: toNumber(row.monto),
      fechaAsamblea: toNullableString(row.fechaAsamblea),
      fechaVencimiento: toNullableString(row.fechaVencimiento),
      mes: toNullableString(row.mes) ?? '',
      fecUltPagCcap: toNullableString(row.fecUltPagCcap),
      fechaUltimoPago: toNullableString(row.fechaUltimoPago),
    }
  })

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
