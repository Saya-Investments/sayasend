/**
 * Crea CDV_COL.Preadmision_Bienvenida_Sorteo si no existe: las columnas del
 * sorteo (ciclo, grupo, campaña...) seguidas de las de BD_FONDOS_COL con sus
 * mismos tipos. La llena la corrida diaria (lib/preadmision-bigquery.ts).
 *
 * Uso: node scripts/crear-tabla-preadmision-bigquery.mjs
 */
import { BigQuery } from '@google-cloud/bigquery'

process.loadEnvFile('.env')

let raw = process.env.BIG_QUERY_KEY.trim()
if (/^['"]/.test(raw)) raw = raw.slice(1, -1)
const credentials = JSON.parse(raw)
credentials.private_key = credentials.private_key.replace(/\n/g, '\n')

const bigquery = new BigQuery({ projectId: 'peak-emitter-350713', credentials })
const DATASET = 'peak-emitter-350713.CDV_COL'

await bigquery.query(`
  CREATE TABLE IF NOT EXISTS \`${DATASET}.Preadmision_Bienvenida_Sorteo\`
  OPTIONS (description = 'Sorteo diario de la bienvenida de Pre-admision (Bot Educador): una fila por contrato. Grupo RETADOR recibe la bienvenida; CONVENCIONAL no. Lo carga sayasend.')
  AS
  SELECT
    CAST(NULL AS STRING) AS Mes_Corte,
    CAST(NULL AS STRING) AS Ciclo,
    CAST(NULL AS DATE) AS Asamblea_Objetivo,
    CAST(NULL AS DATE) AS Fecha_Sorteo,
    CAST(NULL AS STRING) AS Grupo,
    CAST(NULL AS STRING) AS Campania,
    CAST(NULL AS INT64) AS Semilla,
    CAST(NULL AS TIMESTAMP) AS Cargado_En,
    f.*
  FROM \`${DATASET}.BD_FONDOS_COL\` f
  WHERE FALSE
`)

const [columnas] = await bigquery.query(`
  SELECT column_name, data_type
  FROM \`${DATASET}.INFORMATION_SCHEMA.COLUMNS\`
  WHERE table_name = 'Preadmision_Bienvenida_Sorteo'
  ORDER BY ordinal_position
`)
console.log(`OK: ${columnas.length} columnas`)
console.log(columnas.map((c) => `${c.column_name}:${c.data_type}`).join(', '))
