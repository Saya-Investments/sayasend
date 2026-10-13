import { cicloDeAsamblea, insertarSorteoPreadmision } from '@/lib/bigquery'
import { prisma } from '@/lib/prisma'

export type SincronizacionBigQuery = { filas: number; error: string | null }

function soloFecha(value: Date) {
  return value.toISOString().slice(0, 10)
}

function mensajeDeError(error: unknown) {
  // El insert de BigQuery devuelve PartialFailureError con el detalle por fila.
  const detalle = (error as { errors?: Array<{ errors?: Array<{ message?: string }> }> })?.errors?.[0]?.errors?.[0]?.message
  return detalle ?? (error instanceof Error ? error.message : String(error))
}

// Sube a CDV_COL.Preadmision_Bienvenida_Sorteo los sorteados que aún no están
// allá: una fila por contrato, con el ciclo de pago de su asamblea objetivo y
// todas las columnas de BD_FONDOS_COL del día del sorteo. Si BigQuery falla,
// quedan pendientes y la próxima corrida los vuelve a intentar.
export async function sincronizarSorteoBigQuery(): Promise<SincronizacionBigQuery> {
  const pendientes = await prisma.preadmision_sorteo.findMany({
    where: { sincronizado_bq_at: null },
    include: { campaigns: { select: { nombre: true } } },
    orderBy: [{ fecha_corrida: 'asc' }, { dni: 'asc' }],
  })
  if (pendientes.length === 0) return { filas: 0, error: null }

  try {
    const ciclos = new Map<string, { mesCorte: string; ciclo: string }>()
    for (const asamblea of new Set(pendientes.map((s) => soloFecha(s.asamblea_objetivo)))) {
      ciclos.set(asamblea, await cicloDeAsamblea(asamblea))
    }

    const cargadoEn = new Date().toISOString()
    const filas = pendientes.flatMap((s) => {
      const asamblea = soloFecha(s.asamblea_objetivo)
      const { mesCorte, ciclo } = ciclos.get(asamblea)!
      const contratos = Array.isArray(s.datos_bq) ? (s.datos_bq as Record<string, unknown>[]) : []

      return contratos.map((contrato) => ({
        insertId: `${s.dni}-${String(contrato.Codigo_Asociado ?? '')}`,
        json: {
          Mes_Corte: mesCorte,
          Ciclo: ciclo,
          Asamblea_Objetivo: asamblea,
          Fecha_Sorteo: soloFecha(s.fecha_corrida),
          Grupo: s.grupo,
          Campania: s.campaigns?.nombre ?? null,
          Semilla: Number(s.semilla),
          Cargado_En: cargadoEn,
          ...contrato,
        },
      }))
    })

    await insertarSorteoPreadmision(filas)
    await prisma.preadmision_sorteo.updateMany({
      where: { id: { in: pendientes.map((s) => s.id) } },
      data: { sincronizado_bq_at: new Date() },
    })

    return { filas: filas.length, error: null }
  } catch (error) {
    console.error('[PreadmisionBigQuery] No se pudo subir el sorteo:', error)
    return { filas: 0, error: mensajeDeError(error) }
  }
}
