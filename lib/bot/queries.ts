// Lecturas del Bot Educador v2. Se lee directo de la base; los cambios de
// estado van por lib/bot/bot-api.ts.
//
// El filtro por asesor va SIEMPRE en el SQL, con el id de la sesión. La
// asignación se guarda por etapa (crm_asignacion.etapa_id → etapa_uuid), pero
// en la v2 un cliente tiene una etapa por ciclo, así que el asesor ve todas las
// etapas de los clientes que tiene asignados.
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type { Sesion } from '@/lib/auth/session'
import { PREFIJO_PRUEBA, RESULTADOS_ACCION, TIPOS_ACCION } from '@/lib/bot/constants'

// Últimos 10 dígitos: Meta guarda '573102022107', clientes '3102022107'.
const tel10 = (col: Prisma.Sql) => Prisma.sql`right(regexp_replace(${col}, '[^0-9]', '', 'g'), 10)`

// Clientes que tiene asignados un asesor (por cualquiera de sus etapas).
const CLIENTES_DEL_ASESOR = (asesorId: string) => Prisma.sql`
  SELECT DISTINCT ec.cliente_id
  FROM sayasend.crm_asignacion a
  JOIN sayasend.edu_etapa_cliente ec ON ec.etapa_uuid = a.etapa_id
  WHERE a.id_asesor = ${asesorId}::uuid
`

export async function puedeVerEtapa(sesion: Sesion, etapaUuid: string): Promise<boolean> {
  if (sesion.rol === 'admin') return true
  const rows = await prisma.$queryRaw<Array<{ ok: boolean }>>`
    SELECT true AS ok
    FROM sayasend.edu_etapa_cliente e
    WHERE e.etapa_uuid = ${etapaUuid}::uuid
      AND e.cliente_id IN (${CLIENTES_DEL_ASESOR(sesion.sub)})
  `
  return rows.length > 0
}

export async function puedeVerIncidencia(sesion: Sesion, incidenciaUuid: string): Promise<boolean> {
  if (sesion.rol === 'admin') return true
  const rows = await prisma.$queryRaw<Array<{ ok: boolean }>>`
    SELECT true AS ok
    FROM sayasend.edu_incidencia i
    JOIN sayasend.edu_etapa_cliente e USING (etapa_cliente_id)
    WHERE i.incidencia_uuid = ${incidenciaUuid}::uuid
      AND e.cliente_id IN (${CLIENTES_DEL_ASESOR(sesion.sub)})
  `
  return rows.length > 0
}

// ---------------------------------------------------------------------------
// Lista de clientes (vista edu_estado_actual: solo etapas EN_CURSO)

export type FiltrosClientes = {
  rangoScore?: string // 'riesgo' | 'inconforme' | 'neutro' | 'conforme'
  etapa?: string
  soloRetiro?: boolean
  soloDerivadas?: boolean
  // Tipo de tarea pendiente (RETIRO | RECLAMO | CAJA_NEGRA | PREGUNTA | OTROS).
  tipoTarea?: string
  asesor?: string // solo admin: id de asesor, o 'sin' para los no asignados
  q?: string
}

export type ClienteBotFila = {
  etapaUuid: string
  etapaClienteId: string
  clienteId: string
  nombre: string
  codigos: string[]
  telefono: string
  etapa: string
  ventanaFin: string | null
  diasRestantes: number | null
  score: number
  deltaScore: number
  estadoConversacional: string | null
  motivoPrincipal: string | null
  nAbiertas: number
  nDerivadas: number
  derivadaPendiente: boolean
  motivoDerivacion: string | null
  derivadaEn: string | null
  botPausadoHasta: string | null
  ultimaRespuesta: string | null
  asesorId: string | null
  asesorNombre: string | null
  accionTipo: string | null
  accionResultado: string | null
  accionAt: string | null
  totalAcciones: number
  esPrueba: boolean
}

export async function listarClientesBot(sesion: Sesion, filtros: FiltrosClientes = {}): Promise<ClienteBotFila[]> {
  const where: Prisma.Sql[] = [Prisma.sql`true`]

  if (sesion.rol === 'asesor') {
    where.push(Prisma.sql`v.cliente_id IN (${CLIENTES_DEL_ASESOR(sesion.sub)})`)
  } else if (filtros.asesor === 'sin') {
    where.push(Prisma.sql`asig.id_asesor IS NULL`)
  } else if (filtros.asesor) {
    where.push(Prisma.sql`asig.id_asesor = ${filtros.asesor}::uuid`)
  }

  const rangos: Record<string, [number, number]> = {
    riesgo: [0, 29],
    inconforme: [30, 49],
    neutro: [50, 69],
    conforme: [70, 100],
  }
  const rango = filtros.rangoScore ? rangos[filtros.rangoScore] : undefined
  if (rango) where.push(Prisma.sql`v.score_actual BETWEEN ${rango[0]} AND ${rango[1]}`)
  if (filtros.etapa) where.push(Prisma.sql`v.etapa::text = ${filtros.etapa}`)
  if (filtros.soloRetiro) where.push(Prisma.sql`v.motivo_principal = 'retiro'`)
  if (filtros.soloDerivadas) where.push(Prisma.sql`der.pendientes > 0`)
  if (filtros.tipoTarea) {
    const tipo =
      filtros.tipoTarea === 'OTROS'
        ? Prisma.sql`COALESCE(upper(i.tipo), 'OTROS') NOT IN ('RETIRO', 'RECLAMO', 'CAJA_NEGRA', 'PREGUNTA')`
        : Prisma.sql`upper(i.tipo) = ${filtros.tipoTarea}`
    where.push(Prisma.sql`EXISTS (
      SELECT 1 FROM sayasend.edu_incidencia i
      WHERE i.etapa_cliente_id = v.etapa_cliente_id
        AND i.derivada_en IS NOT NULL AND i.atendida_en IS NULL
        AND (i.agendada_para IS NULL OR i.agendada_para <= now())
        AND ${tipo}
    )`)
  }
  if (filtros.q) {
    const like = `%${filtros.q.trim()}%`
    where.push(Prisma.sql`(v.nombre ILIKE ${like} OR v.telefono ILIKE ${like} OR v.codigo_asociado ILIKE ${like})`)
  }

  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT v.*,
           e.codigos, e.bot_pausado_hasta,
           asig.id_asesor, u.nombre AS asesor_nombre,
           COALESCE(der.pendientes, 0) AS der_pendientes, der.motivo_derivacion, der.derivada_en,
           ac.tipo AS ac_tipo, ac.resultado AS ac_resultado, ac.created_at AS ac_at, ac.total AS ac_total
    FROM sayasend.edu_estado_actual v
    JOIN sayasend.edu_etapa_cliente e ON e.etapa_cliente_id = v.etapa_cliente_id
    LEFT JOIN sayasend.crm_asignacion asig ON asig.etapa_id = v.etapa_uuid
    LEFT JOIN sayasend.crm_usuarios u ON u.id_usuario = asig.id_asesor
    LEFT JOIN LATERAL (
      -- Derivaciones pendientes: se filtra por derivada_en, no por estado (un
      -- retiro se deriva mientras la incidencia sigue ABIERTA).
      SELECT count(*)::int AS pendientes,
             (array_agg(i.motivo_derivacion ORDER BY (i.motivo_derivacion = 'RETIRO') DESC, i.derivada_en))[1] AS motivo_derivacion,
             min(i.derivada_en) AS derivada_en
      FROM sayasend.edu_incidencia i
      WHERE i.etapa_cliente_id = v.etapa_cliente_id
        AND i.derivada_en IS NOT NULL AND i.atendida_en IS NULL
    ) der ON true
    LEFT JOIN LATERAL (
      SELECT tipo, resultado, created_at, count(*) OVER ()::int AS total
      FROM sayasend.crm_acciones
      WHERE etapa_id = v.etapa_uuid
      ORDER BY created_at DESC
      LIMIT 1
    ) ac ON true
    WHERE ${Prisma.join(where, ' AND ')}
    ORDER BY (v.motivo_principal = 'retiro') DESC,
             der.pendientes DESC NULLS LAST,
             v.score_actual ASC,
             v.dias_restantes ASC
    LIMIT 1000
  `

  return rows.map((r) => {
    const codigos = ((r.codigos as string[] | null) ?? []).filter(Boolean)
    const codigoAsociado = String(r.codigo_asociado ?? '')
    return {
      etapaUuid: String(r.etapa_uuid),
      etapaClienteId: String(r.etapa_cliente_id),
      clienteId: String(r.cliente_id),
      nombre: String(r.nombre ?? ''),
      codigos: codigos.length > 0 ? codigos : codigoAsociado.split(',').map((c) => c.trim()).filter(Boolean),
      telefono: String(r.telefono ?? ''),
      etapa: String(r.etapa),
      ventanaFin: fechaSolo(r.ventana_fin as Date | null),
      diasRestantes: r.dias_restantes === null ? null : Number(r.dias_restantes),
      score: numero(r.score_actual),
      deltaScore: numero(r.delta_score),
      estadoConversacional: (r.estado_conversacional as string | null) ?? null,
      motivoPrincipal: (r.motivo_principal as string | null) ?? null,
      nAbiertas: Number(r.n_abiertas ?? 0),
      nDerivadas: Number(r.n_derivadas ?? 0),
      derivadaPendiente: Number(r.der_pendientes ?? 0) > 0,
      motivoDerivacion: (r.motivo_derivacion as string | null) ?? null,
      derivadaEn: iso(r.derivada_en as Date | null),
      botPausadoHasta: iso(r.bot_pausado_hasta as Date | null),
      ultimaRespuesta: iso(r.ultima_respuesta as Date | null),
      asesorId: (r.id_asesor as string | null) ?? null,
      asesorNombre: (r.asesor_nombre as string | null) ?? null,
      accionTipo: (r.ac_tipo as string | null) ?? null,
      accionResultado: (r.ac_resultado as string | null) ?? null,
      accionAt: iso(r.ac_at as Date | null),
      totalAcciones: Number(r.ac_total ?? 0),
      esPrueba: codigoAsociado.toUpperCase().includes(PREFIJO_PRUEBA),
    }
  })
}

// ---------------------------------------------------------------------------
// Centro de tareas: una tarea = una incidencia que el bot derivó al asesor.
// Pendiente = sin atender (y sin agendar para más adelante); completada =
// atendida.

export type ResumenTipo = {
  tipo: string
  pendientes: number
  agendadas: number
  completadas: number
  total: number
}

export type ResumenTareas = {
  total: number
  pendientes: number
  agendadas: number
  completadas: number
  efectividad: number
  porTipo: ResumenTipo[]
}

export async function resumenTareas(sesion: Sesion, opciones: { sinAsignar?: boolean } = {}): Promise<ResumenTareas> {
  const where: Prisma.Sql[] = [Prisma.sql`i.derivada_en IS NOT NULL`]
  if (sesion.rol === 'asesor') {
    where.push(Prisma.sql`e.cliente_id IN (${CLIENTES_DEL_ASESOR(sesion.sub)})`)
  } else if (opciones.sinAsignar) {
    where.push(Prisma.sql`asig.id_asesor IS NULL`)
  }

  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT
      CASE WHEN upper(i.tipo) IN ('RETIRO', 'RECLAMO', 'CAJA_NEGRA', 'PREGUNTA') THEN upper(i.tipo) ELSE 'OTROS' END AS tipo,
      count(*) FILTER (WHERE i.atendida_en IS NULL AND (i.agendada_para IS NULL OR i.agendada_para <= now()))::int AS pendientes,
      count(*) FILTER (WHERE i.atendida_en IS NULL AND i.agendada_para > now())::int AS agendadas,
      count(*) FILTER (WHERE i.atendida_en IS NOT NULL)::int AS completadas,
      count(*)::int AS total
    FROM sayasend.edu_incidencia i
    JOIN sayasend.edu_etapa_cliente e USING (etapa_cliente_id)
    LEFT JOIN sayasend.crm_asignacion asig ON asig.etapa_id = e.etapa_uuid
    WHERE ${Prisma.join(where, ' AND ')}
    GROUP BY 1
  `

  const porTipo = rows.map((r) => ({
    tipo: String(r.tipo),
    pendientes: Number(r.pendientes ?? 0),
    agendadas: Number(r.agendadas ?? 0),
    completadas: Number(r.completadas ?? 0),
    total: Number(r.total ?? 0),
  }))
  const suma = (campo: keyof ResumenTipo) => porTipo.reduce((acc, t) => acc + (t[campo] as number), 0)
  const total = suma('total')
  const completadas = suma('completadas')

  return {
    total,
    pendientes: suma('pendientes'),
    agendadas: suma('agendadas'),
    completadas,
    efectividad: total > 0 ? Math.round((completadas / total) * 100) : 0,
    porTipo,
  }
}

// ---------------------------------------------------------------------------
// Detalle del cliente

export async function obtenerDetalle(etapaUuid: string) {
  const etapa = await prisma.edu_etapa_cliente.findUnique({
    where: { etapa_uuid: etapaUuid },
    include: {
      clientes: {
        select: {
          id: true,
          nombre: true,
          dni: true,
          telefono: true,
          telefono3: true,
          codigoAsociado: true,
          fecha_inscripcion: true,
          fecha_1ra_asamblea: true,
          opt_out: true,
        },
      },
      edu_incidencia: { orderBy: { abierta_en: 'asc' } },
      edu_score_evento: { orderBy: { evento_id: 'asc' } },
      crmAsignacion: { include: { asesor: { select: { id: true, nombre: true } } } },
      crmAcciones: { orderBy: { createdAt: 'desc' }, include: { usuario: { select: { nombre: true } } } },
    },
  })
  if (!etapa) return null

  // El score nunca se reinicia: cada etapa arranca donde cerró la anterior, así
  // que el recorrido completo del cliente es parte del contexto.
  const etapasDelCliente = await prisma.edu_etapa_cliente.findMany({
    where: { cliente_id: etapa.cliente_id },
    orderBy: { ventana_inicio: 'asc' },
    select: {
      etapa_uuid: true,
      etapa: true,
      ciclo: true,
      estado_etapa: true,
      ventana_inicio: true,
      ventana_fin: true,
      score_inicio: true,
      score_actual: true,
      estado_conversacional: true,
    },
  })

  return {
    etapaUuid: etapa.etapa_uuid,
    etapaClienteId: etapa.etapa_cliente_id.toString(),
    enCurso: etapa.estado_etapa === 'EN_CURSO',
    cliente: {
      id: etapa.clientes.id,
      nombre: etapa.clientes.nombre,
      dni: etapa.clientes.dni,
      telefono: etapa.clientes.telefono,
      telefono3: etapa.clientes.telefono3,
      codigoAsociado: etapa.clientes.codigoAsociado,
      optOut: etapa.clientes.opt_out,
      fechaInscripcion: fechaSolo(etapa.clientes.fecha_inscripcion),
      fecha1raAsamblea: fechaSolo(etapa.clientes.fecha_1ra_asamblea),
    },
    etapaActual: {
      etapa: etapa.etapa,
      ciclo: etapa.ciclo,
      // Los contratos que cubre esta etapa: el score es de todos ellos juntos.
      codigos: etapa.codigos,
      estadoEtapa: etapa.estado_etapa,
      estadoConversacional: etapa.estado_conversacional,
      motivoPrincipal: etapa.motivo_principal,
      ventanaInicio: fechaSolo(etapa.ventana_inicio),
      ventanaFin: fechaSolo(etapa.ventana_fin),
      scoreInicio: numero(etapa.score_inicio),
      scoreActual: numero(etapa.score_actual),
      tuvoInteraccion: etapa.tuvo_interaccion,
      riesgo: etapa.riesgo,
      botPausadoHasta: iso(etapa.bot_pausado_hasta),
      ultimaRespuesta: iso(etapa.ultima_respuesta_en),
      abiertoEn: iso(etapa.abierto_en),
      cerradoEn: iso(etapa.cerrado_en),
    },
    historialEtapas: etapasDelCliente.map((e) => ({
      etapaUuid: e.etapa_uuid,
      etapa: e.etapa,
      ciclo: e.ciclo,
      estadoEtapa: e.estado_etapa,
      ventanaInicio: fechaSolo(e.ventana_inicio),
      ventanaFin: fechaSolo(e.ventana_fin),
      scoreInicio: numero(e.score_inicio),
      scoreActual: numero(e.score_actual),
      estadoConversacional: e.estado_conversacional,
      esActual: e.etapa_uuid === etapa.etapa_uuid,
    })),
    incidencias: etapa.edu_incidencia.map((i) => ({
      incidenciaUuid: i.incidencia_uuid,
      incidenciaId: i.incidencia_id.toString(),
      categoria: i.categoria,
      estado: i.estado,
      intentosBot: i.intentos_bot,
      insistencias: i.insistencias,
      intentosContacto: i.intentos_contacto,
      abiertaEn: iso(i.abierta_en)!,
      derivadaEn: iso(i.derivada_en),
      motivoDerivacion: i.motivo_derivacion,
      agendadaPara: iso(i.agendada_para),
      atendidaEn: iso(i.atendida_en),
      asesor: i.asesor,
      resultado: i.resultado,
      observaciones: i.observaciones,
      cerradaEn: iso(i.cerrada_en),
    })),
    // El ledger: por qué el score es el que es.
    ledger: etapa.edu_score_evento.map((s) => ({
      eventoId: s.evento_id.toString(),
      ocurridoEn: iso(s.ocurrido_en)!,
      motivo: s.motivo,
      grupo: s.grupo,
      puntos: numero(s.puntos),
      scoreAntes: numero(s.score_antes),
      scoreDespues: numero(s.score_despues),
      nota: s.nota,
    })),
    asesor: etapa.crmAsignacion?.asesor ?? null,
    acciones: etapa.crmAcciones.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      resultado: a.resultado,
      observaciones: a.observaciones,
      duracionSeg: a.duracionSeg,
      usuario: a.usuario.nombre,
      createdAt: iso(a.createdAt)!,
    })),
  }
}

export type DetalleCliente = NonNullable<Awaited<ReturnType<typeof obtenerDetalle>>>

// ---------------------------------------------------------------------------
// Conversación: toda en chat_messages, con lo que el bot entendió de cada
// mensaje del cliente (edu_clasificacion).

export async function mensajesDeCliente(clienteId: string, telefono: string, limite = 300) {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT m.id, m.direction, m.message_type, m.text_body, m.template_name, m.created_at, m.status,
           m.origen, m.edu_incidencia_id,
           cl.categoria, cl.confianza, cl.requiere_revision
    FROM sayasend.chat_messages m
    LEFT JOIN sayasend.edu_clasificacion cl ON cl.chat_message_id = m.id
    WHERE m.cliente_id = ${clienteId}::uuid
       OR ${tel10(Prisma.sql`m.phone`)} = ${tel10(Prisma.sql`${telefono}`)}
    ORDER BY m.created_at DESC
    LIMIT ${limite}
  `
  return rows.reverse().map((r) => ({
    id: String(r.id),
    direction: String(r.direction) as 'inbound' | 'outbound',
    messageType: (r.message_type as string | null) ?? null,
    textBody: (r.text_body as string | null) ?? null,
    templateName: (r.template_name as string | null) ?? null,
    createdAt: iso(r.created_at as Date)!,
    status: (r.status as string | null) ?? null,
    origen: (r.origen as string | null) ?? null,
    incidenciaId: r.edu_incidencia_id === null ? null : String(r.edu_incidencia_id),
    categoria: (r.categoria as string | null) ?? null,
    confianza: r.confianza === null ? null : numero(r.confianza),
    requiereRevision: Boolean(r.requiere_revision),
  }))
}

export type MensajeBot = Awaited<ReturnType<typeof mensajesDeCliente>>[number]


// ---------------------------------------------------------------------------
// Dashboard de gestiones del asesor (crm_acciones) y resumen de categorías del
// bot. Los dos aceptan un rango de fechas; el rango se resuelve en la página.

export type RangoFechas = { desde?: string; hasta?: string }

// Rango -> condición SQL sobre una columna timestamptz. `hasta` es inclusivo.
function entreFechas(col: Prisma.Sql, { desde, hasta }: RangoFechas) {
  const partes: Prisma.Sql[] = []
  if (desde) partes.push(Prisma.sql`${col} >= ${`${desde} 00:00:00-05`}::timestamptz`)
  if (hasta) partes.push(Prisma.sql`${col} <= ${`${hasta} 23:59:59-05`}::timestamptz`)
  return partes.length > 0 ? Prisma.join(partes, ' AND ') : Prisma.sql`true`
}

export type DashboardGestiones = {
  total: number
  hoy: number
  promedioDia: number
  clientes: number
  asesoresActivos: number
  porResultado: Array<{ clave: string; label: string; total: number }>
  porTipo: Array<{ clave: string; label: string; total: number }>
  porDia: Array<{ fecha: string; total: number }>
  porAsesor: Array<{ asesor: string; total: number }>
  ultimas: Array<{
    id: string
    fecha: string
    asesor: string
    cliente: string
    etapaUuid: string
    tipo: string
    resultado: string
    observaciones: string | null
  }>
}

export async function dashboardGestiones(
  rango: RangoFechas,
  opciones: { asesorId?: string } = {},
): Promise<DashboardGestiones> {
  const where: Prisma.Sql[] = [entreFechas(Prisma.sql`a.created_at`, rango)]
  if (opciones.asesorId) where.push(Prisma.sql`a.id_usuario = ${opciones.asesorId}::uuid`)
  const filtro = Prisma.join(where, ' AND ')

  const [totales] = await prisma.$queryRaw<Array<Record<string, number>>>`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE a.created_at::date = (now() AT TIME ZONE 'America/Bogota')::date)::int AS hoy,
      count(DISTINCT a.etapa_id)::int AS clientes,
      count(DISTINCT a.id_usuario)::int AS asesores,
      count(DISTINCT a.created_at::date)::int AS dias
    FROM sayasend.crm_acciones a
    WHERE ${filtro}
  `
  const porResultado = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT a.resultado AS clave, count(*)::int AS total
    FROM sayasend.crm_acciones a
    WHERE ${filtro}
    GROUP BY 1
    ORDER BY 2 DESC
  `
  const porTipo = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT a.tipo AS clave, count(*)::int AS total
    FROM sayasend.crm_acciones a
    WHERE ${filtro}
    GROUP BY 1
    ORDER BY 2 DESC
  `
  const porDia = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT (a.created_at AT TIME ZONE 'America/Bogota')::date AS fecha, count(*)::int AS total
    FROM sayasend.crm_acciones a
    WHERE ${filtro}
    GROUP BY 1
    ORDER BY 1
  `
  const porAsesor = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT u.nombre AS asesor, count(*)::int AS total
    FROM sayasend.crm_acciones a
    JOIN sayasend.crm_usuarios u ON u.id_usuario = a.id_usuario
    WHERE ${filtro}
    GROUP BY 1
    ORDER BY 2 DESC
  `
  const ultimas = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT a.id, a.created_at, a.tipo, a.resultado, a.observaciones,
           u.nombre AS asesor, c.nombre AS cliente, a.etapa_id
    FROM sayasend.crm_acciones a
    JOIN sayasend.crm_usuarios u ON u.id_usuario = a.id_usuario
    JOIN sayasend.edu_etapa_cliente e ON e.etapa_uuid = a.etapa_id
    JOIN sayasend.clientes c ON c.id = e.cliente_id
    WHERE ${filtro}
    ORDER BY a.created_at DESC
    LIMIT 25
  `

  const dias = Number(totales?.dias ?? 0)
  const total = Number(totales?.total ?? 0)

  return {
    total,
    hoy: Number(totales?.hoy ?? 0),
    // Promedio por día con gestiones: dividir por los días del rango daría casi
    // siempre 0 en un piloto que todavía no gestiona todos los días.
    promedioDia: dias > 0 ? Math.round((total / dias) * 10) / 10 : 0,
    clientes: Number(totales?.clientes ?? 0),
    asesoresActivos: Number(totales?.asesores ?? 0),
    porResultado: porResultado.map((r) => ({
      clave: String(r.clave),
      label: RESULTADOS_ACCION.find((x) => x.value === r.clave)?.label ?? String(r.clave),
      total: Number(r.total),
    })),
    porTipo: porTipo.map((r) => ({
      clave: String(r.clave),
      label: TIPOS_ACCION.find((x) => x.value === r.clave)?.label ?? String(r.clave),
      total: Number(r.total),
    })),
    porDia: porDia.map((r) => ({ fecha: fechaSolo(r.fecha as Date)!, total: Number(r.total) })),
    porAsesor: porAsesor.map((r) => ({ asesor: String(r.asesor), total: Number(r.total) })),
    ultimas: ultimas.map((r) => ({
      id: String(r.id),
      fecha: iso(r.created_at as Date)!,
      asesor: String(r.asesor),
      cliente: String(r.cliente ?? ''),
      etapaUuid: String(r.etapa_id),
      tipo: TIPOS_ACCION.find((x) => x.value === r.tipo)?.label ?? String(r.tipo),
      resultado: RESULTADOS_ACCION.find((x) => x.value === r.resultado)?.label ?? String(r.resultado),
      observaciones: (r.observaciones as string | null) ?? null,
    })),
  }
}

// Cuántos temas trajo el cliente, por tipo y por categoría del bot.
export type ResumenCategorias = {
  total: number
  porCategoria: Record<string, number>
  porTipo: Record<string, number>
}

export async function resumenCategorias(
  rango: RangoFechas,
  opciones: { etapa?: string } = {},
): Promise<ResumenCategorias> {
  const where: Prisma.Sql[] = [entreFechas(Prisma.sql`i.abierta_en`, rango)]
  if (opciones.etapa) where.push(Prisma.sql`e.etapa::text = ${opciones.etapa}`)

  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT i.categoria, i.tipo, count(*)::int AS total
    FROM sayasend.edu_incidencia i
    JOIN sayasend.edu_etapa_cliente e USING (etapa_cliente_id)
    JOIN sayasend.clientes c ON c.id = e.cliente_id
    WHERE ${Prisma.join(where, ' AND ')}
      AND c.codigo_asociado NOT ILIKE ${'%' + PREFIJO_PRUEBA + '%'}
    GROUP BY 1, 2
  `

  const porCategoria: Record<string, number> = {}
  const porTipo: Record<string, number> = {}
  let total = 0
  for (const r of rows) {
    const n = Number(r.total)
    porCategoria[String(r.categoria)] = (porCategoria[String(r.categoria)] ?? 0) + n
    porTipo[String(r.tipo ?? 'OTROS')] = (porTipo[String(r.tipo ?? 'OTROS')] ?? 0) + n
    total += n
  }
  return { total, porCategoria, porTipo }
}

// ---------------------------------------------------------------------------

function iso(d: Date | null | undefined) {
  return d ? new Date(d).toISOString() : null
}

// Columnas @db.Date vienen como medianoche UTC: se corta a YYYY-MM-DD.
export function fechaSolo(d: Date | null | undefined) {
  return d ? new Date(d).toISOString().slice(0, 10) : null
}

// Decimal de Prisma / numeric de Postgres -> number.
function numero(v: unknown) {
  if (v === null || v === undefined) return 0
  const n = Number(v as number)
  return Number.isFinite(n) ? n : 0
}
