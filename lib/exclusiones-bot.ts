import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type { ContactoExcluidoBot, MotivoExclusionBot } from '@/lib/exclusiones-bot-texto'
import type { CampaignContact, EtapaBot } from '@/lib/types'

function clave(value: unknown) {
  return String(value ?? '').trim()
}

export async function excludeForBot(contacts: CampaignContact[], etapaBot: EtapaBot) {
  const dnis = [...new Set(contacts.map((c) => clave(c.numDoc)).filter(Boolean))]
  const codigos = [...new Set(contacts.map((c) => clave(c.codigoAsociado)).filter(Boolean))]
  const conAdmision = etapaBot === 'PRE_ADMISION'

  // Se cruza por DNI o código: `clientes` tiene una fila por DNI, así que un
  // contrato nuevo del Excel cae sobre el cliente que ya existe con otro código.
  const rows =
    dnis.length === 0 && codigos.length === 0
      ? []
      : await prisma.$queryRaw<Array<{ dni: string; codigo_asociado: string; retiro: boolean; admision: boolean }>>(Prisma.sql`
          SELECT c.dni, c.codigo_asociado,
            EXISTS (
              SELECT 1 FROM edu_etapa_cliente e
              WHERE e.cliente_id = c.id
                AND (
                  e.motivo_principal = 'retiro'
                  OR e.estado_etapa = 'SALIDA_RETIRO'
                  OR EXISTS (
                    SELECT 1 FROM edu_incidencia i
                    WHERE i.etapa_cliente_id = e.etapa_cliente_id AND i.tipo = 'RETIRO'
                  )
                )
            ) AS retiro,
            ${conAdmision} AND (
              EXISTS (
                SELECT 1 FROM campaign_contacts cc
                JOIN campaigns ca ON ca.id = cc.campaign_id
                WHERE cc.cliente_id = c.id AND ca.etapa_bot = 'ADMISION' AND cc.sent_at IS NOT NULL
              )
              OR EXISTS (
                SELECT 1 FROM edu_etapa_cliente e WHERE e.cliente_id = c.id AND e.etapa = 'ADM'
              )
            ) AS admision
          FROM clientes c
          WHERE c.dni = ANY(${dnis}::text[]) OR c.codigo_asociado = ANY(${codigos}::text[])
        `)

  type Marca = { motivo: MotivoExclusionBot; codigoEnBase: string }
  const byDni = new Map<string, Marca>()
  const byCodigo = new Map<string, Marca>()
  for (const row of rows) {
    // Retiro manda sobre admisión: es el motivo más fuerte para no escribirle.
    const motivo: MotivoExclusionBot | null = row.retiro ? 'retiro' : row.admision ? 'admision' : null
    if (motivo) {
      const marca = { motivo, codigoEnBase: row.codigo_asociado }
      byDni.set(row.dni, marca)
      byCodigo.set(row.codigo_asociado, marca)
    }
  }

  const kept: CampaignContact[] = []
  const excluded: ContactoExcluidoBot[] = []

  for (const contact of contacts) {
    const marca = byDni.get(clave(contact.numDoc)) ?? byCodigo.get(clave(contact.codigoAsociado))
    if (marca) {
      excluded.push({
        codigoAsociado: clave(contact.codigoAsociado),
        numDoc: clave(contact.numDoc),
        nombre: clave(contact.nombre),
        ...marca,
      })
    } else {
      kept.push(contact)
    }
  }

  return { kept, excluded }
}
