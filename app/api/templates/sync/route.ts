import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getAllMetaTemplates } from '@/lib/meta-template-service'

export const runtime = 'nodejs'

// POST /api/templates/sync — espeja las templates de Meta en la BD:
// - Crea las que existen en Meta pero no en BD (match por nombre).
// - Actualiza las existentes (preserva UUIDs para no romper campañas).
// - Para las que están en BD pero ya NO en Meta (huérfanas):
//     · Intenta borrarlas.
//     · Si el borrado falla (porque tienen campañas asociadas via FK),
//       las marca con estadoMeta = 'DELETED_IN_META' para preservar
//       el histórico + evitar que se usen en campañas nuevas.
export async function POST() {
  try {
    const metaTemplates = await getAllMetaTemplates()

    const bdTemplates = await prisma.template.findMany({
      select: { id: true, nombre: true, estadoMeta: true, metaId: true },
    })
    const bdByName = new Map(bdTemplates.map((t) => [t.nombre, t]))
    const metaNames = new Set(metaTemplates.map((m) => m.nombre))

    let creadas = 0
    let actualizadas = 0
    let borradas = 0
    let marcadasComoEliminadas = 0
    const errores: Array<{ nombre: string; error: string }> = []

    // Crear / actualizar las que vinieron de Meta
    for (const mt of metaTemplates) {
      try {
        const existing = bdByName.get(mt.nombre)
        if (existing) {
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
              headerType: mt.headerFormat ?? null,
              // NOTA: no sobreescribimos headerMediaUrl porque esa es la URL
              // del GCS bucket que se setea al crear la template desde el CRM.
              // El sync desde Meta solo captura el tipo (IMAGE/VIDEO/etc.), no
              // la URL del sample — Meta no la expone reliably.
            },
          })
          actualizadas++
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
              headerType: mt.headerFormat ?? null,
              // headerMediaUrl queda null — si el template tiene IMAGE header
              // creado en Meta Business Manager (no via nuestro CRM), el admin
              // deberá agregarle la URL GCS manualmente para poder enviarlo.
            },
          })
          creadas++
        }
      } catch (error) {
        errores.push({ nombre: mt.nombre, error: (error as Error).message })
      }
    }

    // Manejar huérfanas (existen en BD pero no en Meta)
    const orphans = bdTemplates.filter((t) => !metaNames.has(t.nombre))
    for (const orphan of orphans) {
      try {
        // Intento #1: borrar completamente
        await prisma.template.delete({ where: { id: orphan.id } })
        borradas++
      } catch {
        // Falla típicamente por FK (Campaign.templateId apunta a esta template).
        // Fallback: soft-flag. Preservamos la fila para mantener el histórico
        // de campañas que la usaron, y la marcamos como eliminada en Meta
        // para que la UI la filtre del flujo de crear nueva campaña.
        try {
          await prisma.template.update({
            where: { id: orphan.id },
            data: { estadoMeta: 'DELETED_IN_META' },
          })
          marcadasComoEliminadas++
        } catch (updateError) {
          errores.push({
            nombre: orphan.nombre,
            error: `No se pudo borrar ni marcar como eliminada: ${(updateError as Error).message}`,
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      resumen: {
        totalMeta: metaTemplates.length,
        totalBdAntes: bdTemplates.length,
        creadas,
        actualizadas,
        borradas,
        marcadasComoEliminadas,
        errores: errores.length,
      },
      errores,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
