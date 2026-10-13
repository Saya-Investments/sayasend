import { Prisma } from '@prisma/client'

import { queryInscritosPreadmision } from '@/lib/bigquery'
import { proximaAsamblea, hoyEnColombia } from '@/lib/calendario-colombia'
import { freezeCampaignContacts } from '@/lib/campaign-contacts'
import { excludeForBot } from '@/lib/exclusiones-bot'
import { prisma } from '@/lib/prisma'
import { MINIMO_PARA_SORTEAR, semillaDeCorrida, sortear } from '@/lib/sorteo-retadores'
import type { CampaignContact } from '@/lib/types'

// Bienvenida de Pre-admisión del Bot Educador, una corrida por día:
//
// 1. Trae de BD_FONDOS_COL a los ACTIVOS cuya 1ra asamblea es la próxima
//    asamblea principal (6to día hábil del mes).
// 2. Quita a los que ya entraron a un sorteo y a los que no deben ir al bot
//    (retiro, contrato en Admisión, opt-out).
// 3. Si quedan al menos MINIMO_PARA_SORTEAR, sortea el 40% (hacia abajo) como
//    retadores: reciben la bienvenida en una campaña marcada para el bot. El
//    resto queda como convencional y no recibe nada. Si no alcanza, se acumulan
//    para el día siguiente.
//
// La base de BigQuery se actualiza a las 5 am con los inscritos hasta el día
// anterior, por eso basta con mirar "los que aún no se sortearon".

const PLANTILLA_BIENVENIDA = 'pre_admision_bot_bienvenida'
// Mismo texto que ya usa `clientes.frente` para Admisión (sin tilde).
const FRENTE = 'Admision'

export type ModoCorrida = 'simular' | 'borrador' | 'enviar'

type Persona = {
  dni: string
  contacto: CampaignContact
  filas: Record<string, unknown>[]
}

export type PersonaResumen = {
  dni: string
  nombre: string
  telefono: string
  fechaInscripcion: string | null
  codigos: string
}

export type ResultadoCorrida = {
  modo: ModoCorrida
  hoy: string
  asamblea: string
  semilla: number
  contratosEnBigQuery: number
  personasEnBigQuery: number
  yaSorteados: number
  excluidos: Array<PersonaResumen & { motivo: string }>
  pendientes: number
  estado: 'esperando' | 'sorteado'
  retadores: PersonaResumen[]
  convencional: PersonaResumen[]
  campaignId: string | null
  campaignNombre: string | null
}

function texto(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim()
}

function soloFecha(value: unknown) {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(texto(value))
  return match ? match[1] : null
}

function aFechaUtc(value: string | null) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

// Un DNI puede tener varios contratos: el envío es por persona, así que se
// junta en un solo contacto con los códigos separados por coma (como en el
// resto de campañas) y la inscripción más antigua.
function agruparPorDni(filas: Record<string, unknown>[], asamblea: string): Persona[] {
  const porDni = new Map<string, Record<string, unknown>[]>()
  for (const fila of filas) {
    const dni = texto(fila.Num_Doc)
    if (dni) porDni.set(dni, [...(porDni.get(dni) ?? []), fila])
  }

  return [...porDni.entries()].map(([dni, filasDni]) => {
    const primero = (columna: string) => filasDni.map((f) => texto(f[columna])).find(Boolean) ?? ''
    const fechas = (columna: string) =>
      filasDni
        .map((f) => soloFecha(f[columna]))
        .filter((f): f is string => f !== null)
        .sort()

    const ctaActPag = filasDni.map((f) => Number(f.Cta_Act_Pag)).filter(Number.isFinite)

    const contacto: CampaignContact = {
      codigoAsociado: filasDni.map((f) => texto(f.Codigo_Asociado)).filter(Boolean).sort().join(', '),
      numDoc: dni,
      nombre: primero('Nombres'),
      telefono: primero('Telefono_2'),
      telefono3: primero('Telefono_3') || null,
      segmento: '',
      monto: 0,
      ctaActPag: ctaActPag.length > 0 ? Math.max(...ctaActPag) : null,
      // {{2}} de la plantilla: la campaña lo manda como fechaAsamblea.
      fechaAsamblea: asamblea,
      fecha1raAsamblea: asamblea,
      fechaInscripcion: fechas('Fec_Inscripcion')[0] ?? null,
      frente: FRENTE,
      fecUltPagCcap: fechas('Fec_Ult_Pag_CCAP').at(-1) ?? null,
      fechaUltimoPago: fechas('Fec_Ult_Pag_CCAP').at(-1) ?? null,
    }

    return { dni, contacto, filas: filasDni }
  })
}

function resumen(persona: Persona): PersonaResumen {
  const apellido = texto(persona.filas[0]?.Apellido_Paterno)
  return {
    dni: persona.dni,
    nombre: [persona.contacto.nombre, apellido].filter(Boolean).join(' '),
    telefono: persona.contacto.telefono,
    fechaInscripcion: (persona.contacto.fechaInscripcion as string | null) ?? null,
    codigos: persona.contacto.codigoAsociado,
  }
}

// Los motivos del bot (retiro, Admisión) más el opt-out, que también saca al
// cliente del bot.
async function separarExcluidos(personas: Persona[]) {
  const { excluded } = await excludeForBot(
    personas.map((p) => p.contacto),
    'PRE_ADMISION',
  )
  const motivos = new Map<string, string>(
    excluded.map((e) => [e.numDoc, e.motivo === 'retiro' ? 'Retiro en el Bot Educador' : 'Contrato en Admisión']),
  )

  const optOut = await prisma.cliente.findMany({
    where: { dni: { in: personas.map((p) => p.dni) }, opt_out: true },
    select: { dni: true },
  })
  for (const { dni } of optOut) {
    if (!motivos.has(dni)) motivos.set(dni, 'Opt-out')
  }

  return {
    elegibles: personas.filter((p) => !motivos.has(p.dni)),
    excluidos: personas.filter((p) => motivos.has(p.dni)).map((p) => ({ ...resumen(p), motivo: motivos.get(p.dni)! })),
    excludedBot: excluded,
  }
}

export async function correrBienvenidaPreadmision(modo: ModoCorrida, hoy = hoyEnColombia()): Promise<ResultadoCorrida> {
  const asamblea = proximaAsamblea(hoy)
  const semilla = semillaDeCorrida(hoy)

  const filas = await queryInscritosPreadmision(asamblea)
  const personas = agruparPorDni(filas, asamblea)

  const sorteados = await prisma.preadmision_sorteo.findMany({
    where: { dni: { in: personas.map((p) => p.dni) } },
    select: { dni: true },
  })
  const yaSorteados = new Set(sorteados.map((s) => s.dni))
  const nuevos = personas.filter((p) => !yaSorteados.has(p.dni))

  const { elegibles, excluidos, excludedBot } = await separarExcluidos(nuevos)

  const base = {
    modo,
    hoy,
    asamblea,
    semilla,
    contratosEnBigQuery: filas.length,
    personasEnBigQuery: personas.length,
    yaSorteados: yaSorteados.size,
    excluidos,
    pendientes: elegibles.length,
  }

  if (elegibles.length < MINIMO_PARA_SORTEAR) {
    return { ...base, estado: 'esperando', retadores: [], convencional: [], campaignId: null, campaignNombre: null }
  }

  const { retadores, convencional } = sortear(elegibles, (p) => p.dni, semilla)
  const resultado: ResultadoCorrida = {
    ...base,
    estado: 'sorteado',
    retadores: retadores.map(resumen),
    convencional: convencional.map(resumen),
    campaignId: null,
    campaignNombre: null,
  }

  if (modo === 'simular') {
    return resultado
  }

  const plantilla = await prisma.template.findUnique({
    where: { nombre: PLANTILLA_BIENVENIDA },
    select: { id: true, estadoMeta: true },
  })
  if (!plantilla || plantilla.estadoMeta !== 'APPROVED') {
    throw new Error(`La plantilla ${PLANTILLA_BIENVENIDA} no existe o no está aprobada en Meta`)
  }

  const nombreCampania = `pre_admision_bienvenida_${hoy}`
  const enviar = modo === 'enviar'

  const campaignId = await prisma.$transaction(
    async (tx) => {
      const campaign = await tx.campaign.create({
        data: {
          nombre: nombreCampania,
          templateId: plantilla.id,
          databaseName: 'BD_FONDOS_COL',
          sendMode: 'M0',
          variableMappings: { '1': 'nombre', '2': 'fechaAsamblea' },
          totalContacts: retadores.length,
          // Programada para ya: el cron de envíos la toma en el siguiente minuto.
          status: enviar ? 'scheduled' : 'draft',
          scheduledAt: enviar ? new Date() : null,
          refreshOnSend: false,
          // El scheduler vuelve a fijar esta fecha en `clientes` justo antes de
          // enviar, por si otra campaña la pisó entre medio.
          fechaAsambleaManual: aFechaUtc(asamblea),
          etapa_bot: 'PRE_ADMISION',
          excluidos_bot: excludedBot.length > 0 ? (excludedBot as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        },
      })

      // Fill-only (como Excel): BD_FONDOS_COL no trae segmento ni monto, así
      // que no se pisan los de un cliente que ya existía. La fecha de
      // asamblea sí se sobreescribe porque es la variable del mensaje, y el
      // frente porque estos clientes son de Admisión.
      await freezeCampaignContacts(
        tx,
        campaign.id,
        retadores.map((p) => p.contacto),
        { isExcelSource: true, overwriteFields: ['fechaAsamblea', 'frente'] },
      )

      const clientes = await tx.cliente.findMany({
        where: { dni: { in: elegibles.map((p) => p.dni) } },
        select: { id: true, dni: true },
      })
      const clientePorDni = new Map(clientes.map((c) => [c.dni, c.id]))

      const fila = (persona: Persona, grupo: 'RETADOR' | 'CONVENCIONAL') => ({
        dni: persona.dni,
        grupo,
        fecha_corrida: aFechaUtc(hoy)!,
        semilla: BigInt(semilla),
        asamblea_objetivo: aFechaUtc(asamblea)!,
        fecha_inscripcion: aFechaUtc((persona.contacto.fechaInscripcion as string | null) ?? null),
        nombre: resumen(persona).nombre.slice(0, 150),
        telefono: persona.contacto.telefono.slice(0, 20) || null,
        codigos_asociado: persona.contacto.codigoAsociado.slice(0, 150),
        // La campaña de la corrida: los dos grupos la llevan, para poder bajar
        // desde ella el Excel de retadores y el de convencional.
        campaign_id: campaign.id,
        cliente_id: clientePorDni.get(persona.dni) ?? null,
        datos_bq: persona.filas as Prisma.InputJsonValue,
      })

      // El DNI es único en la tabla: si otra corrida ya sorteó a alguien,
      // esto falla y se deshace todo, campaña incluida.
      await tx.preadmision_sorteo.createMany({
        data: [...retadores.map((p) => fila(p, 'RETADOR')), ...convencional.map((p) => fila(p, 'CONVENCIONAL'))],
      })

      return campaign.id
    },
    { timeout: 180000, maxWait: 15000 },
  )

  return { ...resultado, campaignId, campaignNombre: nombreCampania }
}
