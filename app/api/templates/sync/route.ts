import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getAllMetaTemplates } from '@/lib/meta-template-service'

export const runtime = 'nodejs'

// POST /api/templates/sync — trae todas las templates de Meta y sincroniza con la BD:
// - Crea las que existen en Meta pero no en BD (match por nombre)
// - Actualiza el estado_meta / meta_id de las que ya existen
export async function POST() {
  try {
    const metaTemplates = await getAllMetaTemplates()

    const bdTemplates = await prisma.template.findMany({
      select: { id: true, nombre: true, estadoMeta: true, metaId: true },
    })
    const bdByName = new Map(bdTemplates.map((t) => [t.nombre, t]))

    let creadas = 0
    let actualizadas = 0
    let errores: Array<{ nombre: string; error: string }> = []

    for (const mt of metaTemplates) {
      try {
        const existing = bdByName.get(mt.nombre)
        if (existing) {
          if (
            existing.estadoMeta !== mt.estadoMeta ||
            existing.metaId !== mt.id
          ) {
            await prisma.template.update({
              where: { id: existing.id },
              data: {
                estadoMeta: mt.estadoMeta,
                metaId: mt.id,
                categoria: mt.categoria,
                idioma: mt.idioma,
                contenido: mt.contenido,
                header: mt.header,
                footer: mt.footer,
                botones: mt.botones ? (mt.botones as object) : undefined,
              },
            })
            actualizadas++
          }
        } else {
          await prisma.template.create({
            data: {
              nombre: mt.nombre,
              contenido: mt.contenido,
              metaId: mt.id,
              estadoMeta: mt.estadoMeta,
              categoria: mt.categoria,
              idioma: mt.idioma,
              header: mt.header,
              footer: mt.footer,
              botones: mt.botones ? (mt.botones as object) : undefined,
            },
          })
          creadas++
        }
      } catch (error) {
        errores.push({ nombre: mt.nombre, error: (error as Error).message })
      }
    }

    return NextResponse.json({
      success: true,
      resumen: {
        totalMeta: metaTemplates.length,
        totalBd: bdTemplates.length,
        creadas,
        actualizadas,
        errores: errores.length,
      },
      errores,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
