import { prisma } from '@/lib/prisma'
import type { ContactabilityMetrics } from '@/lib/types'

export type ContactabilityScope = 'global' | 'principal' | 'alterno'

export type ContactabilityError = {
  code: string
  count: number
}

export type SecondaryContactabilitySummary = {
  eligible: number
  withAlternate: number
  withoutAlternate: number
  retried: number
  notRetried: number
}

export type CampaignContactability = {
  global: ContactabilityMetrics
  principal: ContactabilityMetrics
  alternate: ContactabilityMetrics
  secondarySummary: SecondaryContactabilitySummary
  errors: Record<ContactabilityScope, ContactabilityError[]>
}

type StatusRow = {
  scope: ContactabilityScope
  status: string
  has_alternate: boolean
  retried: boolean
  count: bigint
}

type ErrorRow = {
  scope: ContactabilityScope
  code: string
  count: bigint
}

const EMPTY_SUMMARY: SecondaryContactabilitySummary = {
  eligible: 0,
  withAlternate: 0,
  withoutAlternate: 0,
  retried: 0,
  notRetried: 0,
}

function percentage(value: number, total: number) {
  return total > 0 ? (value * 100) / total : 0
}

function metricsFromRows(rows: StatusRow[], scope: ContactabilityScope): ContactabilityMetrics {
  const counts = new Map<string, number>()

  for (const row of rows) {
    if (row.scope !== scope) continue
    counts.set(row.status, (counts.get(row.status) ?? 0) + Number(row.count))
  }

  const pending = counts.get('pending') ?? 0
  const sentOnly = counts.get('sent') ?? 0
  const deliveredOnly = counts.get('delivered') ?? 0
  const read = counts.get('read') ?? 0
  const failed = counts.get('failed') ?? 0
  const total = pending + sentOnly + deliveredOnly + read + failed
  const sent = sentOnly + deliveredOnly + read + failed
  const delivered = deliveredOnly + read

  return {
    total,
    sent,
    delivered,
    read,
    failed,
    sentOnly,
    deliveredOnly,
    pending,
    deliveryRate: percentage(delivered, total),
    readRate: percentage(read, total),
    failureRate: percentage(failed, total),
  }
}

function summaryFromRows(rows: StatusRow[]): SecondaryContactabilitySummary {
  const alternateRows = rows.filter((row) => row.scope === 'alterno')
  if (alternateRows.length === 0) return EMPTY_SUMMARY

  let eligible = 0
  let withAlternate = 0
  let retriedWithAlternate = 0

  for (const row of alternateRows) {
    const count = Number(row.count)
    eligible += count
    if (row.has_alternate) {
      withAlternate += count
      if (row.retried) retriedWithAlternate += count
    }
  }

  return {
    eligible,
    withAlternate,
    withoutAlternate: eligible - withAlternate,
    retried: retriedWithAlternate,
    notRetried: withAlternate - retriedWithAlternate,
  }
}

export async function getCampaignContactability(
  campaignId: string,
): Promise<CampaignContactability> {
  const statusRows = await prisma.$queryRaw<StatusRow[]>`
    WITH contactos AS (
      SELECT
        cc.id,
        cc.send_status,
        cc.retry_count,
        cc.failure_code_1,
        cc.failure_code_2,
        NULLIF(trim(cc.phone_1), '') AS phone_1,
        NULLIF(trim(cc.phone_2), '') AS phone_2,
        right(regexp_replace(COALESCE(NULLIF(trim(cc.phone_1), ''), cl.telefono), '[^0-9]', '', 'g'), 10)
          AS principal_phone,
        NULLIF(
          right(regexp_replace(COALESCE(NULLIF(trim(cc.phone_2), ''), cl.telefono_3), '[^0-9]', '', 'g'), 10),
          ''
        ) AS alternate_phone
      FROM sayasend.campaign_contacts cc
      JOIN sayasend.clientes cl ON cl.id = cc.cliente_id
      WHERE cc.campaign_id = ${campaignId}::uuid
    ),
    mensajes_clasificados AS (
      SELECT
        mo.id_msg,
        c.id AS contact_id,
        CASE
          WHEN c.alternate_phone IS NOT NULL
           AND right(regexp_replace(mo.phone_to, '[^0-9]', '', 'g'), 10) = c.alternate_phone
           AND right(regexp_replace(mo.phone_to, '[^0-9]', '', 'g'), 10)
               IS DISTINCT FROM c.principal_phone
          THEN 'alterno'
          ELSE 'principal'
        END AS phone_kind
      FROM sayasend.mensaje_out mo
      JOIN contactos c ON c.id = mo.campaign_contact_id
      WHERE mo.campaign_id = ${campaignId}::uuid
    ),
    estado_por_mensaje AS (
      SELECT
        mc.id_msg,
        mc.contact_id,
        mc.phone_kind,
        CASE
          WHEN COALESCE(bool_or(
            mse.estado = 'failed'
            OR CASE
              WHEN jsonb_typeof(mse.errors_json) = 'array'
              THEN jsonb_array_length(mse.errors_json) > 0
              ELSE false
            END
          ), false) THEN 'failed'
          WHEN COALESCE(bool_or(mse.estado = 'read'), false) THEN 'read'
          WHEN COALESCE(bool_or(mse.estado = 'delivered'), false) THEN 'delivered'
          ELSE 'sent'
        END AS status
      FROM mensajes_clasificados mc
      LEFT JOIN sayasend.mensaje_status_event mse ON mse.id_msg = mc.id_msg
      GROUP BY mc.id_msg, mc.contact_id, mc.phone_kind
    ),
    estado_por_intento AS (
      SELECT
        contact_id,
        phone_kind,
        CASE MAX(
          CASE status
            WHEN 'read' THEN 4
            WHEN 'delivered' THEN 3
            WHEN 'sent' THEN 2
            WHEN 'failed' THEN 1
            ELSE 0
          END
        )
          WHEN 4 THEN 'read'
          WHEN 3 THEN 'delivered'
          WHEN 2 THEN 'sent'
          WHEN 1 THEN 'failed'
          ELSE NULL
        END AS status
      FROM estado_por_mensaje
      GROUP BY contact_id, phone_kind
    ),
    estados_base AS (
      SELECT
        c.*,
        c.alternate_phone IS NOT NULL
          AND c.alternate_phone IS DISTINCT FROM c.principal_phone AS has_alternate,
        CASE
          WHEN NULLIF(trim(c.failure_code_1), '') IS NOT NULL THEN 'failed'
          WHEN principal.status IS NOT NULL THEN principal.status
          WHEN c.phone_2 IS NULL
           AND c.retry_count = 0
           AND c.send_status IN ('sent', 'delivered', 'read', 'failed')
          THEN c.send_status
          ELSE 'pending'
        END AS principal_status,
        CASE
          WHEN NULLIF(trim(c.failure_code_2), '') IS NOT NULL THEN 'failed'
          ELSE alterno.status
        END AS alternate_status,
        c.retry_count > 0
          OR c.phone_2 IS NOT NULL
          OR NULLIF(trim(c.failure_code_2), '') IS NOT NULL
          OR alterno.status IS NOT NULL AS retried
      FROM contactos c
      LEFT JOIN estado_por_intento principal
        ON principal.contact_id = c.id AND principal.phone_kind = 'principal'
      LEFT JOIN estado_por_intento alterno
        ON alterno.contact_id = c.id AND alterno.phone_kind = 'alterno'
    ),
    estados AS (
      SELECT
        *,
        CASE
          WHEN principal_status <> 'failed' THEN principal_status
          WHEN alternate_status IN ('sent', 'delivered', 'read') THEN alternate_status
          ELSE 'failed'
        END AS global_status,
        COALESCE(alternate_status, 'pending') AS secondary_status
      FROM estados_base
    ),
    scoped AS (
      SELECT 'global'::text AS scope, global_status AS status, false AS has_alternate, false AS retried
      FROM estados

      UNION ALL

      SELECT 'principal'::text, principal_status, false, false
      FROM estados

      UNION ALL

      SELECT 'alterno'::text, secondary_status, has_alternate, retried
      FROM estados
      WHERE principal_status = 'failed'
    )
    SELECT
      scope,
      status,
      has_alternate,
      retried,
      COUNT(*)::bigint AS count
    FROM scoped
    GROUP BY scope, status, has_alternate, retried
  `

  const errorRows = await prisma.$queryRaw<ErrorRow[]>`
    WITH contactos AS (
      SELECT
        cc.id,
        cc.failure_code_1,
        cc.failure_code_2,
        NULLIF(trim(cc.phone_1), '') AS phone_1,
        NULLIF(trim(cc.phone_2), '') AS phone_2,
        right(regexp_replace(COALESCE(NULLIF(trim(cc.phone_1), ''), cl.telefono), '[^0-9]', '', 'g'), 10)
          AS principal_phone,
        NULLIF(
          right(regexp_replace(COALESCE(NULLIF(trim(cc.phone_2), ''), cl.telefono_3), '[^0-9]', '', 'g'), 10),
          ''
        ) AS alternate_phone
      FROM sayasend.campaign_contacts cc
      JOIN sayasend.clientes cl ON cl.id = cc.cliente_id
      WHERE cc.campaign_id = ${campaignId}::uuid
    ),
    mensajes_clasificados AS (
      SELECT
        mo.id_msg,
        c.id AS contact_id,
        CASE
          WHEN c.alternate_phone IS NOT NULL
           AND right(regexp_replace(mo.phone_to, '[^0-9]', '', 'g'), 10) = c.alternate_phone
           AND right(regexp_replace(mo.phone_to, '[^0-9]', '', 'g'), 10)
               IS DISTINCT FROM c.principal_phone
          THEN 'alterno'
          ELSE 'principal'
        END AS phone_kind
      FROM sayasend.mensaje_out mo
      JOIN contactos c ON c.id = mo.campaign_contact_id
      WHERE mo.campaign_id = ${campaignId}::uuid
    ),
    estado_por_mensaje AS (
      SELECT
        mc.id_msg,
        mc.contact_id,
        mc.phone_kind,
        CASE
          WHEN COALESCE(bool_or(
            mse.estado = 'failed'
            OR CASE
              WHEN jsonb_typeof(mse.errors_json) = 'array'
              THEN jsonb_array_length(mse.errors_json) > 0
              ELSE false
            END
          ), false) THEN 'failed'
          WHEN COALESCE(bool_or(mse.estado = 'read'), false) THEN 'read'
          WHEN COALESCE(bool_or(mse.estado = 'delivered'), false) THEN 'delivered'
          ELSE 'sent'
        END AS status
      FROM mensajes_clasificados mc
      LEFT JOIN sayasend.mensaje_status_event mse ON mse.id_msg = mc.id_msg
      GROUP BY mc.id_msg, mc.contact_id, mc.phone_kind
    ),
    estado_por_intento AS (
      SELECT
        contact_id,
        phone_kind,
        CASE MAX(
          CASE status
            WHEN 'read' THEN 4
            WHEN 'delivered' THEN 3
            WHEN 'sent' THEN 2
            WHEN 'failed' THEN 1
            ELSE 0
          END
        )
          WHEN 4 THEN 'read'
          WHEN 3 THEN 'delivered'
          WHEN 2 THEN 'sent'
          WHEN 1 THEN 'failed'
          ELSE NULL
        END AS status
      FROM estado_por_mensaje
      GROUP BY contact_id, phone_kind
    ),
    estados AS (
      SELECT
        c.id,
        CASE
          WHEN NULLIF(trim(c.failure_code_1), '') IS NOT NULL THEN 'failed'
          ELSE principal.status
        END AS principal_status,
        CASE
          WHEN NULLIF(trim(c.failure_code_2), '') IS NOT NULL THEN 'failed'
          ELSE alterno.status
        END AS alternate_status
      FROM contactos c
      LEFT JOIN estado_por_intento principal
        ON principal.contact_id = c.id AND principal.phone_kind = 'principal'
      LEFT JOIN estado_por_intento alterno
        ON alterno.contact_id = c.id AND alterno.phone_kind = 'alterno'
    ),
    errores_guardados AS (
      SELECT id AS contact_id, trim(failure_code_1) AS code, 'principal'::text AS phone_kind
      FROM contactos
      WHERE NULLIF(trim(failure_code_1), '') IS NOT NULL

      UNION ALL

      SELECT id, trim(failure_code_2), 'alterno'::text
      FROM contactos
      WHERE NULLIF(trim(failure_code_2), '') IS NOT NULL
    ),
    errores_evento AS (
      SELECT
        mc.contact_id,
        (err->>'code')::text AS code,
        mc.phone_kind,
        c.failure_code_1,
        c.failure_code_2
      FROM sayasend.mensaje_status_event mse
      JOIN mensajes_clasificados mc ON mc.id_msg = mse.id_msg
      JOIN contactos c ON c.id = mc.contact_id
      CROSS JOIN LATERAL jsonb_array_elements(mse.errors_json) AS err
      WHERE mse.errors_json IS NOT NULL
        AND jsonb_typeof(mse.errors_json) = 'array'
        AND err ? 'code'
    ),
    errores_legacy AS (
      SELECT contact_id, code, phone_kind
      FROM errores_evento
      WHERE (phone_kind = 'principal' AND NULLIF(trim(failure_code_1), '') IS NULL)
         OR (phone_kind = 'alterno' AND NULLIF(trim(failure_code_2), '') IS NULL)
    ),
    errores_intento AS (
      SELECT contact_id, code, phone_kind FROM errores_guardados
      UNION ALL
      SELECT contact_id, code, phone_kind FROM errores_legacy
    ),
    errores_scoped AS (
      SELECT 'principal'::text AS scope, e.contact_id, e.code
      FROM errores_intento e
      WHERE e.phone_kind = 'principal'

      UNION ALL

      SELECT 'alterno'::text, e.contact_id, e.code
      FROM errores_intento e
      WHERE e.phone_kind = 'alterno'

      UNION ALL

      SELECT 'global'::text, e.contact_id, e.code
      FROM errores_intento e
      JOIN estados s ON s.id = e.contact_id
      WHERE (e.phone_kind = 'alterno' AND s.alternate_status = 'failed')
         OR (e.phone_kind = 'principal'
             AND s.principal_status = 'failed'
             AND s.alternate_status IS NULL)
    )
    SELECT scope, code, COUNT(DISTINCT contact_id)::bigint AS count
    FROM errores_scoped
    GROUP BY scope, code
    ORDER BY scope, count DESC, code
  `

  const errors: Record<ContactabilityScope, ContactabilityError[]> = {
    global: [],
    principal: [],
    alterno: [],
  }

  for (const row of errorRows) {
    if (errors[row.scope].length >= 10) continue
    errors[row.scope].push({ code: row.code, count: Number(row.count) })
  }

  return {
    global: metricsFromRows(statusRows, 'global'),
    principal: metricsFromRows(statusRows, 'principal'),
    alternate: metricsFromRows(statusRows, 'alterno'),
    secondarySummary: summaryFromRows(statusRows),
    errors,
  }
}
