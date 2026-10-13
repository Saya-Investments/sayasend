import * as XLSX from 'xlsx'

import { prisma } from '@/lib/prisma'

export type GrupoSorteo = 'RETADOR' | 'CONVENCIONAL'

export const GRUPO_LABEL: Record<GrupoSorteo, string> = {
  RETADOR: 'Retador',
  CONVENCIONAL: 'Convencional',
}

// Orden de las columnas en BD_FONDOS_COL. `datos_bq` es jsonb y Postgres
// reordena sus claves, así que el Excel las vuelve a poner en este orden; una
// columna nueva que no esté en la lista sale al final.
const COLUMNAS_BD_FONDOS = [
  'Foja', 'Certificado', 'Codigo_Asociado', 'Num_Doc', 'N_Doc', 'Edad', 'Estado_Asociado', 'Nombres',
  'Apellido_Paterno', 'Apellido_Materno', 'Telf_SMS', 'Telefono_2', 'Telefono_3', 'Telefono_4', 'Telefono_5',
  'Telefono_6', 'Telefono_7', 'Telefono_8', 'E_mail', 'Producto', 'Marca', 'C_Adm', 'C_Cap', 'Cod_Bco',
  'Cta_Inscripcion_con_IGV', 'Pag_Cap', 'A_Favor', 'Debe_penalidad_incumplimiento_remate',
  'Fec_Entr_Chq_Sort_Resuelto', 'Cta_Ins_Venc', 'Codigo_Comprometido', 'Debito_Automatico', 'Fec_1raAsamb',
  'Fec_Inscripcion', 'Fec_Reingreso', 'Fec_Adjudicacion', 'Fec_Entrega', 'Fec_Resolucion', 'Fec_Cancelacion',
  'Fec_Ult_Pag_CCAP', 'Fec_Venc_Cuota', 'Ingreso_Mensual', 'Ingreso_Otros', 'Pago_cuota', 'Mora', 'Cta_Act_Pag',
  'Num_Cta_Cap_Pag_Activo', 'Cta_Pag_Caida_Vtas', 'Linea', 'Sit_Laboral', 'Origen_Vta', 'Sexo', 'Tipo_Persona',
  'Tipo_Venta', 'Reinc_Reub', 'Zona',
]

function enOrden(contrato: Record<string, unknown>) {
  const extras = Object.keys(contrato).filter((columna) => !COLUMNAS_BD_FONDOS.includes(columna))
  return [...COLUMNAS_BD_FONDOS, ...extras].map((columna) => [columna, limpiar(contrato[columna] ?? null)] as const)
}

function soloFecha(value: Date) {
  return value.toISOString().slice(0, 10)
}

// BD_FONDOS_COL rellena los textos con espacios ("3115669950  ", "          ").
function limpiar(value: unknown) {
  return typeof value === 'string' ? value.trim() : value
}

// Un Excel por grupo del sorteo de la campaña: una fila por contrato, con todas
// las columnas de BigQuery tal como estaban el día del sorteo.
export async function excelSorteo(campaignId: string, grupo: GrupoSorteo) {
  const sorteados = await prisma.preadmision_sorteo.findMany({
    where: { campaign_id: campaignId, grupo },
    orderBy: { dni: 'asc' },
  })

  const filas = sorteados.flatMap((s) => {
    const contratos = Array.isArray(s.datos_bq) ? (s.datos_bq as Record<string, unknown>[]) : []
    return contratos.map((contrato) => ({
      Grupo: GRUPO_LABEL[grupo],
      'Fecha sorteo': soloFecha(s.fecha_corrida),
      'Asamblea objetivo': soloFecha(s.asamblea_objetivo),
      ...Object.fromEntries(enOrden(contrato)),
    }))
  })

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(filas), GRUPO_LABEL[grupo])

  return {
    personas: sorteados.length,
    buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer,
  }
}

export function nombreExcelSorteo(campaignNombre: string, grupo: GrupoSorteo) {
  const base = campaignNombre.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) || 'campaign'
  return `${base}_${GRUPO_LABEL[grupo].toLowerCase()}.xlsx`
}
