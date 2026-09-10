import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { createMetaTemplate, getAllMetaTemplates } from '@/lib/meta-template-service'
import { normalizeTemplateName, resolverNombreUnico } from '@/lib/excel-templates'

export const runtime = 'nodejs'
export const maxDuration = 300

// ============================================================================
// POST /api/templates/bulk — crea varias plantillas de una, a partir de las
// filas ya parseadas del Excel (el parseo pasa en el cliente, igual que con
// los contactos de campaña).
//
// Cada plantilla se crea igual que en POST /api/templates, con dos diferencias:
//   - el nombre se versiona (_v2, _v3...) si ya existe en Meta, en la BD o
//     antes en este mismo lote, en vez de fallar por duplicado;
//   - las filas se procesan en serie y con una pausa entre ellas, porque Meta
//     tira rate limit si le mandás las creaciones en paralelo.
//
// Nunca aborta el lote por una fila fallida: devuelve el resultado de cada una
// para que el usuario reintente solo las que fallaron.
// ============================================================================

const MAX_PLANTILLAS_POR_LOTE = 200
const PAUSA_ENTRE_CREACIONES_MS = 350

type BulkTemplateInput = {
  fila?: number
  nombre: string
  mensaje: string
  ejemplosMensaje?: string[]
  categoria?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  idioma?: string
  header?: string | null
  ejemplosHeader?: string[]
  footer?: string | null
  descripcion?: string | null
}

/**
 * Qué hacer cuando el nombre ya existe (en Meta, en la BD o antes en el lote):
 *   - 'versionar': crea la plantilla como _v2, _v3... (default)
 *   - 'omitir': salta la fila SOLO si la que ya existe tiene el mismo mensaje,
 *     o sea si es literalmente la misma plantilla. Sirve para resubir el mismo
 *     archivo después de un piloto sin duplicar lo ya creado. Si el nombre
 *     coincide pero el mensaje es otro, es una plantilla distinta que casualmente
 *     se llama igual: esa se versiona igual que siempre, para no perderla.
 */
type SiNombreExiste = 'versionar' | 'omitir'

/** Compara mensajes ignorando diferencias de espaciado que Meta no distingue. */
function mismoMensaje(a: string, b: string) {
  const normalizar = (s: string) => s.trim().replace(/\s+/g, ' ')
  return normalizar(a) === normalizar(b)
}

type BulkResultado = {
  fila: number
  nombreSolicitado: string
  nombreFinal: string | null
  /** true cuando hubo que versionar el nombre porque ya existía. */
  versionado: boolean
  estado: 'creada' | 'omitida' | 'error'
  estadoMeta?: string
  error?: string
  /** Aclaración para el reporte cuando la fila no siguió el camino obvio. */
  nota?: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Junta las plantillas que ya existen (nombre normalizado → mensaje), sumando
 * las de la BD y las de Meta. Meta es la fuente de verdad — puede tener
 * plantillas que nunca se sincronizaron — pero si la llamada falla seguimos con
 * las de la BD en vez de tumbar todo el lote: en el peor caso Meta rechaza el
 * duplicado y queda reportado en esa fila.
 *
 * El mensaje se guarda para poder distinguir "esta plantilla ya la creé" de
 * "hay otra plantilla distinta que casualmente se llama igual".
 */
async function cargarExistentes(): Promise<{ existentes: Map<string, string>; avisoMeta?: string }> {
  const existentes = new Map<string, string>()

  const enBd = await prisma.template.findMany({ select: { nombre: true, contenido: true } })
  for (const t of enBd) existentes.set(normalizeTemplateName(t.nombre), t.contenido)

  try {
    const enMeta = await getAllMetaTemplates()
    for (const t of enMeta) existentes.set(normalizeTemplateName(t.nombre), t.contenido)
    return { existentes }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'error desconocido'
    return {
      existentes,
      avisoMeta: `No se pudo leer la lista de plantillas de Meta (${message}). El versionado usó solo los nombres de la base de datos.`,
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      templates?: BulkTemplateInput[]
      siNombreExiste?: SiNombreExiste
    }
    const entradas = body.templates ?? []
    const siNombreExiste: SiNombreExiste = body.siNombreExiste === 'omitir' ? 'omitir' : 'versionar'

    if (entradas.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se recibió ninguna plantilla' },
        { status: 400 },
      )
    }
    if (entradas.length > MAX_PLANTILLAS_POR_LOTE) {
      return NextResponse.json(
        {
          success: false,
          error: `Máximo ${MAX_PLANTILLAS_POR_LOTE} plantillas por archivo (llegaron ${entradas.length}).`,
        },
        { status: 400 },
      )
    }

    const { existentes, avisoMeta } = await cargarExistentes()
    const nombresOcupados = new Set(existentes.keys())

    const resultados: BulkResultado[] = []

    for (const [i, entrada] of entradas.entries()) {
      const fila = entrada.fila ?? i + 2
      const nombreSolicitado = normalizeTemplateName(entrada.nombre ?? '')

      if (!nombreSolicitado || !entrada.mensaje?.trim()) {
        resultados.push({
          fila,
          nombreSolicitado: entrada.nombre ?? '',
          nombreFinal: null,
          versionado: false,
          estado: 'error',
          error: 'Falta el nombre o el mensaje',
        })
        continue
      }

      // Solo se omite si la que ya existe es la MISMA plantilla (mismo mensaje).
      // Si el nombre coincide pero el mensaje cambió, es otra plantilla y hay
      // que crearla versionada: omitirla la perdería en silencio.
      let notaColision: string | undefined
      if (siNombreExiste === 'omitir' && nombresOcupados.has(nombreSolicitado)) {
        const mensajeExistente = existentes.get(nombreSolicitado)
        if (mensajeExistente !== undefined && mismoMensaje(mensajeExistente, entrada.mensaje)) {
          resultados.push({
            fila,
            nombreSolicitado,
            nombreFinal: nombreSolicitado,
            versionado: false,
            estado: 'omitida',
            nota: 'Ya existe con el mismo mensaje.',
          })
          continue
        }
        notaColision =
          'Ya existía una plantilla con ese nombre pero con otro mensaje, así que esta se creó como versión en vez de omitirse.'
      }

      let nombreFinal: string
      try {
        nombreFinal = resolverNombreUnico(nombreSolicitado, nombresOcupados)
      } catch (error) {
        resultados.push({
          fila,
          nombreSolicitado,
          nombreFinal: null,
          versionado: false,
          estado: 'error',
          error: error instanceof Error ? error.message : 'No se pudo generar un nombre único',
        })
        continue
      }

      // Se reserva antes de crear: si la creación falla, igual no queremos que
      // la siguiente fila del lote reintente con el mismo nombre.
      nombresOcupados.add(nombreFinal)
      const versionado = nombreFinal !== nombreSolicitado

      try {
        const metaResult = await createMetaTemplate({
          nombre: nombreFinal,
          mensaje: entrada.mensaje,
          categoria: entrada.categoria ?? 'MARKETING',
          idioma: entrada.idioma ?? 'es_CO',
          header: entrada.header ?? null,
          headerFormat: 'TEXT',
          footer: entrada.footer ?? null,
          ejemplos_mensaje: entrada.ejemplosMensaje?.length ? entrada.ejemplosMensaje : undefined,
          ejemplos_header: entrada.ejemplosHeader?.length ? entrada.ejemplosHeader : undefined,
        })

        await prisma.template.create({
          data: {
            nombre: metaResult.nombreMeta,
            descripcion: entrada.descripcion ?? null,
            contenido: entrada.mensaje,
            metaId: metaResult.metaId,
            estadoMeta: metaResult.estadoMeta,
            categoria: entrada.categoria ?? 'MARKETING',
            idioma: entrada.idioma ?? 'es_CO',
            header: entrada.header ?? null,
            footer: entrada.footer ?? null,
            headerType: entrada.header ? 'TEXT' : null,
          },
        })

        resultados.push({
          fila,
          nombreSolicitado,
          nombreFinal: metaResult.nombreMeta,
          versionado,
          estado: 'creada',
          estadoMeta: metaResult.estadoMeta,
          nota: notaColision,
        })
      } catch (error) {
        resultados.push({
          fila,
          nombreSolicitado,
          nombreFinal,
          versionado,
          estado: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido',
        })
      }

      if (i < entradas.length - 1) await sleep(PAUSA_ENTRE_CREACIONES_MS)
    }

    const creadas = resultados.filter((r) => r.estado === 'creada').length
    const omitidas = resultados.filter((r) => r.estado === 'omitida').length

    return NextResponse.json({
      success: true,
      resumen: {
        total: resultados.length,
        creadas,
        omitidas,
        errores: resultados.length - creadas - omitidas,
        versionadas: resultados.filter((r) => r.estado === 'creada' && r.versionado).length,
      },
      avisoMeta,
      resultados,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
