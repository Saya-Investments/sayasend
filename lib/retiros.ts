import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type { CampaignContact } from '@/lib/types'

/**
 * Clientes que el Bot Educador marcó como retiro: alguna de sus etapas tiene
 * `motivo_principal = 'retiro'` o una incidencia de tipo RETIRO. A esos el bot
 * no les vuelve a hablar, así que se sacan de las campañas con `etapa_bot`.
 *
 * Devuelve los DNI y códigos de asociado marcados, para cruzar con los
 * contactos de la campaña por cualquiera de los dos.
 */
export async function findRetiroKeys(contacts: CampaignContact[]) {
  const dnis = [...new Set(contacts.map((c) => String(c.numDoc ?? '').trim()).filter(Boolean))]
  const codigos = [
    ...new Set(contacts.map((c) => String(c.codigoAsociado ?? '').trim()).filter(Boolean)),
  ]

  if (dnis.length === 0 && codigos.length === 0) {
    return { dnis: new Set<string>(), codigos: new Set<string>() }
  }

  const rows = await prisma.$queryRaw<Array<{ dni: string; codigo_asociado: string }>>(Prisma.sql`
    SELECT DISTINCT c.dni, c.codigo_asociado
    FROM clientes c
    JOIN edu_etapa_cliente e ON e.cliente_id = c.id
    WHERE (c.dni = ANY(${dnis}::text[]) OR c.codigo_asociado = ANY(${codigos}::text[]))
      AND (
        e.motivo_principal = 'retiro'
        OR e.estado_etapa = 'SALIDA_RETIRO'
        OR EXISTS (
          SELECT 1 FROM edu_incidencia i
          WHERE i.etapa_cliente_id = e.etapa_cliente_id AND i.tipo = 'RETIRO'
        )
      )
  `)

  return {
    dnis: new Set(rows.map((r) => r.dni)),
    codigos: new Set(rows.map((r) => r.codigo_asociado)),
  }
}

export async function excludeRetiros(contacts: CampaignContact[]) {
  const { dnis, codigos } = await findRetiroKeys(contacts)
  const kept: CampaignContact[] = []
  const excluded: CampaignContact[] = []

  for (const contact of contacts) {
    const isRetiro =
      dnis.has(String(contact.numDoc ?? '').trim()) ||
      codigos.has(String(contact.codigoAsociado ?? '').trim())
    ;(isRetiro ? excluded : kept).push(contact)
  }

  return { kept, excluded }
}
