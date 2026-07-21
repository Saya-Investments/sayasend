/**
 * Recalcula los campos que salían de `BDfondos_snapshots` para clientes ya
 * congelados en campañas: `ctaActPag`, `monto`, `monto1`, `monto2` y `monto3`.
 *
 * Contexto: `snap_dedup` deduplicaba los snapshots con `ORDER BY 1` (una
 * constante), así que BigQuery devolvía una fila al azar de las ~87 que tiene
 * cada asociado. Los snapshots anteriores a 2026-05 traen `Cta_Act_Pag` en
 * NULL, y `C_Adm`/`C_Cap` varían en el tiempo, así que tanto la cuota como los
 * montos quedaron mal en las campañas creadas antes del fix.
 *
 * Uso (desde la raíz del proyecto):
 *   node scripts/recalcular-campos-snapshot.mjs                 # dry-run
 *   node scripts/recalcular-campos-snapshot.mjs --apply         # escribe
 *   node scripts/recalcular-campos-snapshot.mjs --campana=m2_    # filtra por prefijo
 */
import fs from 'fs'

import { BigQuery } from '@google-cloud/bigquery'
import { PrismaClient } from '@prisma/client'

const BIGQUERY_PROJECT_ID = 'peak-emitter-350713'
const BIGQUERY_DATASET_ID = 'CDV_COL'

const APPLY = process.argv.includes('--apply')
const PREFIJO =
  process.argv.find((a) => a.startsWith('--campana='))?.split('=')[1] ??
  'm2_julio_consecuencia_verificado'

// --- .env ------------------------------------------------------------------

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

function bigQueryClient() {
  let raw = process.env.BIG_QUERY_KEY.trim()
  if (/^['"]/.test(raw) && /['"]$/.test(raw)) raw = raw.slice(1, -1)
  const credentials = JSON.parse(raw)
  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n')
  }
  return new BigQuery({ projectId: credentials.project_id, credentials })
}

// --- consulta --------------------------------------------------------------

// Misma SQL que `queryBigQueryContactsCobranza` en lib/bigquery.ts, recortada a
// los campos que dependen del snapshot. Si esa query cambia, actualizar aquí.
function construirQuery(tableName, filtros) {
  if (!/^[A-Za-z0-9_]+$/.test(tableName)) throw new Error('Nombre de tabla inválido')

  const clauses = []
  const params = {}
  for (const [campo, columna] of [
    ['segmento', 'segmento'],
    ['estrategia', 'estrategia'],
    ['frente', 'Frente'],
  ]) {
    const valores = (filtros[campo] ?? []).filter(Boolean)
    if (valores.length > 0) {
      clauses.push(`CAST(src.\`${columna}\` AS STRING) IN UNNEST(@${campo})`)
      params[campo] = valores
    }
  }
  const whereClause = clauses.length > 0 ? `AND ${clauses.join(' AND ')}` : ''

  const query = `
    WITH ciclo_activo AS (
      SELECT fecha_inicio_ciclo, fecha_fin_ciclo, mes_corte_label
      FROM \`${BIGQUERY_PROJECT_ID}.${BIGQUERY_DATASET_ID}.ciclos_pago\`
      WHERE CURRENT_DATE('America/Bogota') BETWEEN fecha_inicio_ciclo AND fecha_fin_ciclo
      QUALIFY ROW_NUMBER() OVER (ORDER BY fecha_inicio_ciclo DESC) = 1
    ),
    snap_dedup AS (
      SELECT *
      FROM \`${BIGQUERY_PROJECT_ID}.${BIGQUERY_DATASET_ID}.BDfondos_snapshots\`
      QUALIFY ROW_NUMBER() OVER (
        PARTITION BY CAST(\`Codigo_Asociado\` AS STRING)
        ORDER BY \`fecha_snapshot\` DESC
      ) = 1
    ),
    contratos_pendientes AS (
      SELECT
        CAST(src.\`Contrato\` AS STRING) AS contrato,
        CAST(src.\`DNI\` AS STRING) AS dni
      FROM \`${BIGQUERY_PROJECT_ID}.${BIGQUERY_DATASET_ID}.${tableName}\` src
      JOIN ciclo_activo ciclo
        ON CAST(src.\`mes_corte\` AS STRING) = CAST(ciclo.mes_corte_label AS STRING)
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
        SAFE_CAST(snap.\`C_Adm\` AS NUMERIC) AS c_adm,
        SAFE_CAST(snap.\`C_Cap\` AS NUMERIC) AS c_cap,
        SAFE_CAST(snap.\`Cta_Act_Pag\` AS INT64) AS cta_act_pag
      FROM contratos_pendientes c
      LEFT JOIN snap_dedup snap
        ON c.contrato = CAST(snap.\`Codigo_Asociado\` AS STRING)
    )
    SELECT
      dni AS numDoc,
      SUM(IFNULL(c_adm + c_cap, 0)) AS monto,
      SUM(IFNULL(2 * (c_adm + c_cap), 0)) AS monto_1,
      SUM(IFNULL(3 * (c_adm + c_cap), 0)) AS monto_2,
      SUM(IFNULL(4 * (c_adm + c_cap), 0)) AS monto_3,
      MAX(cta_act_pag) AS ctaActPag
    FROM contratos_con_fondos
    GROUP BY dni
  `

  return { query, params }
}

function aNumero(value) {
  if (value === null || value === undefined) return 0
  const n = Number(typeof value === 'object' && 'value' in value ? value.value : value)
  return Number.isFinite(n) ? n : 0
}

function aEnteroONulo(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(typeof value === 'object' && 'value' in value ? value.value : value)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

// Compara un Decimal de Prisma contra un number sin sufrir el redondeo binario.
function mismoMonto(actual, nuevo) {
  if (actual === null || actual === undefined) return false
  return Number(actual).toFixed(2) === Number(nuevo).toFixed(2)
}

// --- main ------------------------------------------------------------------

const prisma = new PrismaClient()
const bq = bigQueryClient()

const campanas = await prisma.campaign.findMany({
  where: { nombre: { startsWith: PREFIJO } },
  select: {
    id: true,
    nombre: true,
    databaseName: true,
    gestionType: true,
    segmentoFilter: true,
    estrategiaFilter: true,
    frenteFilter: true,
  },
  orderBy: { nombre: 'asc' },
})

if (campanas.length === 0) {
  console.log(`No hay campañas que empiecen con "${PREFIJO}".`)
  await prisma.$disconnect()
  process.exit(0)
}

console.log(APPLY ? '=== MODO APLICAR ===' : '=== DRY-RUN (usa --apply para escribir) ===')

let totalCambios = 0
let totalSinDato = 0

for (const campana of campanas) {
  if (campana.gestionType !== 'gestion_cobranza') {
    console.log(`\n${campana.nombre}: gestionType="${campana.gestionType}", se omite.`)
    continue
  }

  const parseFiltro = (v) => {
    if (!v) return []
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed : [String(parsed)]
    } catch {
      return [v]
    }
  }

  const { query, params } = construirQuery(campana.databaseName, {
    segmento: parseFiltro(campana.segmentoFilter),
    estrategia: parseFiltro(campana.estrategiaFilter),
    frente: parseFiltro(campana.frenteFilter),
  })

  const [rows] = await bq.query({ query, params })
  const porDni = new Map(rows.map((r) => [String(r.numDoc), r]))

  const contactos = await prisma.campaignContact.findMany({
    where: { campaignId: campana.id },
    select: {
      cliente: {
        select: {
          id: true, dni: true, codigoAsociado: true,
          ctaActPag: true, monto: true, monto1: true, monto2: true, monto3: true,
        },
      },
    },
  })

  console.log(`\n${campana.nombre}  (${contactos.length} contactos, ${rows.length} filas en BigQuery)`)

  const cambios = []
  const sinDato = []

  for (const { cliente } of contactos) {
    const row = porDni.get(cliente.dni)
    if (!row) {
      sinDato.push(cliente.dni)
      continue
    }

    const nuevo = {
      ctaActPag: aEnteroONulo(row.ctaActPag),
      monto: aNumero(row.monto),
      monto1: aNumero(row.monto_1),
      monto2: aNumero(row.monto_2),
      monto3: aNumero(row.monto_3),
    }

    const data = {}
    if (nuevo.ctaActPag !== null && nuevo.ctaActPag !== cliente.ctaActPag) {
      data.ctaActPag = nuevo.ctaActPag
    }
    for (const campo of ['monto', 'monto1', 'monto2', 'monto3']) {
      if (!mismoMonto(cliente[campo], nuevo[campo])) data[campo] = nuevo[campo]
    }

    if (Object.keys(data).length > 0) {
      cambios.push({ cliente, data })
    }
  }

  for (const { cliente, data } of cambios) {
    const detalle = Object.entries(data)
      .map(([k, v]) => `${k}: ${cliente[k] === null ? 'NULL' : String(cliente[k])} -> ${v}`)
      .join(', ')
    console.log(`  dni ${cliente.dni} (${cliente.codigoAsociado})  ${detalle}`)
  }

  if (sinDato.length > 0) {
    console.log(`  sin fila en BigQuery hoy (se dejan intactos): ${sinDato.length} -> ${sinDato.join(', ')}`)
  }

  if (APPLY && cambios.length > 0) {
    await prisma.$transaction(
      cambios.map(({ cliente, data }) =>
        prisma.cliente.update({ where: { id: cliente.id }, data }),
      ),
    )
    console.log(`  ✓ ${cambios.length} clientes actualizados`)
  } else {
    console.log(`  ${cambios.length} clientes con diferencias`)
  }

  totalCambios += cambios.length
  totalSinDato += sinDato.length
}

console.log(
  `\nTotal: ${totalCambios} clientes ${APPLY ? 'actualizados' : 'a actualizar'}` +
    (totalSinDato > 0 ? `, ${totalSinDato} sin fila en BigQuery` : ''),
)

await prisma.$disconnect()
