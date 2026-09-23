/**
 * Rellena `fecha_1ra_asamblea` y `fecha_inscripcion` de TODOS los clientes a
 * partir de `Fec_1raAsamb` y `Fec_Inscripcion` de `Historico_BDfondos_Scoring`.
 *
 * Match: primero por contrato (el primero de `codigo_asociado`, que puede traer
 * varios separados por coma — mismo criterio que usan las queries de
 * lib/bigquery.ts al crear la campaña); si no aparece, por DNI tomando el
 * contrato de menor código.
 *
 * Uso (desde la raíz del proyecto):
 *   node scripts/backfill-fechas-asamblea-inscripcion.mjs            # dry-run
 *   node scripts/backfill-fechas-asamblea-inscripcion.mjs --apply    # escribe
 *   node scripts/backfill-fechas-asamblea-inscripcion.mjs --tabla=Otra_Tabla
 */
import fs from 'fs'

import { BigQuery } from '@google-cloud/bigquery'
import { Prisma, PrismaClient } from '@prisma/client'

const BIGQUERY_PROJECT_ID = 'peak-emitter-350713'
const BIGQUERY_DATASET_ID = 'CDV_COL'

const APPLY = process.argv.includes('--apply')
const TABLA =
  process.argv.find((a) => a.startsWith('--tabla='))?.split('=')[1] ?? 'Historico_BDfondos_Scoring'

if (!/^[A-Za-z0-9_]+$/.test(TABLA)) throw new Error('Nombre de tabla inválido')

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

// --- helpers ---------------------------------------------------------------

// BigQueryDate -> "YYYY-MM-DD"
function aTextoFecha(value) {
  if (value === null || value === undefined) return null
  const v = typeof value === 'object' && 'value' in value ? value.value : value
  return v ? String(v).slice(0, 10) : null
}

// Date de Prisma (@db.Date, en UTC) -> "YYYY-MM-DD"
function fechaBd(value) {
  return value ? value.toISOString().slice(0, 10) : null
}

function aDateUtc(texto) {
  const [y, m, d] = texto.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

// --- main ------------------------------------------------------------------

const prisma = new PrismaClient()
const bq = bigQueryClient()

console.log(APPLY ? '=== MODO APLICAR ===' : '=== DRY-RUN (usa --apply para escribir) ===')

const [rows] = await bq.query({
  query: `
    SELECT
      CAST(\`Contrato\` AS STRING) AS contrato,
      CAST(\`DNI\` AS STRING) AS dni,
      ANY_VALUE(SAFE_CAST(\`Fec_1raAsamb\` AS DATE)) AS fecha1raAsamblea,
      ANY_VALUE(SAFE_CAST(\`Fec_Inscripcion\` AS DATE)) AS fechaInscripcion
    FROM \`${BIGQUERY_PROJECT_ID}.${BIGQUERY_DATASET_ID}.${TABLA}\`
    WHERE \`Contrato\` IS NOT NULL
    GROUP BY contrato, dni
  `,
})

const porContrato = new Map()
const porDni = new Map()
for (const r of rows) {
  const fila = {
    contrato: r.contrato,
    f1: aTextoFecha(r.fecha1raAsamblea),
    fi: aTextoFecha(r.fechaInscripcion),
  }
  porContrato.set(r.contrato.trim(), fila)
  const dni = r.dni?.trim()
  if (dni) {
    const previo = porDni.get(dni)
    if (!previo || fila.contrato < previo.contrato) porDni.set(dni, fila)
  }
}
console.log(`${TABLA}: ${porContrato.size} contratos, ${porDni.size} DNIs`)

const clientes = await prisma.cliente.findMany({
  select: {
    id: true,
    dni: true,
    codigoAsociado: true,
    fecha_1ra_asamblea: true,
    fecha_inscripcion: true,
  },
})

const cambios = []
let porDniCount = 0
const sinMatch = []

for (const cliente of clientes) {
  const contratos = cliente.codigoAsociado
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)

  let fila = contratos.map((c) => porContrato.get(c)).find(Boolean)
  if (!fila) {
    fila = porDni.get(cliente.dni.trim())
    if (fila) porDniCount++
  }
  if (!fila) {
    sinMatch.push(cliente.dni)
    continue
  }

  const data = {}
  if (fila.f1 && fila.f1 !== fechaBd(cliente.fecha_1ra_asamblea)) data.fecha_1ra_asamblea = aDateUtc(fila.f1)
  if (fila.fi && fila.fi !== fechaBd(cliente.fecha_inscripcion)) data.fecha_inscripcion = aDateUtc(fila.fi)
  if (Object.keys(data).length > 0) cambios.push({ cliente, data })
}

for (const { cliente, data } of cambios.slice(0, 10)) {
  const detalle = Object.entries(data)
    .map(([k, v]) => `${k}: ${fechaBd(cliente[k]) ?? 'NULL'} -> ${fechaBd(v)}`)
    .join(', ')
  console.log(`  dni ${cliente.dni} (${cliente.codigoAsociado})  ${detalle}`)
}
if (cambios.length > 10) console.log(`  ... y ${cambios.length - 10} más`)

console.log(
  `\nClientes: ${clientes.length} | con cambios: ${cambios.length} | ` +
    `match por DNI (sin contrato): ${porDniCount} | sin match: ${sinMatch.length}`,
)

// Un UPDATE ... FROM (VALUES ...) por lote: con un update por cliente la BD
// remota tardaba ~4 min cada 1000 y la transacción terminaba cortándose.
if (APPLY && cambios.length > 0) {
  const LOTE = 1000
  for (let i = 0; i < cambios.length; i += LOTE) {
    const valores = cambios.slice(i, i + LOTE).map(({ cliente, data }) =>
      Prisma.sql`(${cliente.id}::uuid, ${fechaBd(data.fecha_1ra_asamblea)}::date, ${fechaBd(data.fecha_inscripcion)}::date)`,
    )
    await prisma.$executeRaw`
      UPDATE sayasend.clientes AS c SET
        fecha_1ra_asamblea = COALESCE(v.f1, c.fecha_1ra_asamblea),
        fecha_inscripcion = COALESCE(v.fi, c.fecha_inscripcion)
      FROM (VALUES ${Prisma.join(valores)}) AS v(id, f1, fi)
      WHERE c.id = v.id
    `
    console.log(`  ✓ ${Math.min(i + LOTE, cambios.length)}/${cambios.length}`)
  }
}

await prisma.$disconnect()
