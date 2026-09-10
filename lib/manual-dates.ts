import type { CampaignContact, ManualCampaignDates } from '@/lib/types'

// Helpers puros (sin Prisma ni BigQuery) para la sobrescritura manual de la
// fecha de vencimiento y la fecha de asamblea. Se comparten entre el formulario
// (cliente), el endpoint de creación y el scheduler.

/**
 * Normaliza una fecha manual a "YYYY-MM-DD". Devuelve null si está vacía o no
 * es una fecha de calendario válida (p. ej. 2026-02-31).
 */
export function normalizeManualDate(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim())
  if (!match) {
    return null
  }

  const [, year, month, day] = match
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))

  if (
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() !== Number(month) - 1 ||
    parsed.getUTCDate() !== Number(day)
  ) {
    return null
  }

  return `${year}-${month}-${day}`
}

export function normalizeManualDates(
  dates: ManualCampaignDates | null | undefined,
): ManualCampaignDates {
  return {
    fechaVencimiento: normalizeManualDate(dates?.fechaVencimiento),
    fechaAsamblea: normalizeManualDate(dates?.fechaAsamblea),
  }
}

export function hasManualDates(dates: ManualCampaignDates | null | undefined) {
  const normalized = normalizeManualDates(dates)
  return !!normalized.fechaVencimiento || !!normalized.fechaAsamblea
}

/**
 * Devuelve los contactos con la fecha de vencimiento y/o de asamblea
 * reemplazadas por las manuales. Solo se pisa el campo que se llenó a mano; el
 * otro conserva lo que vino de BigQuery/Excel. Si no hay ninguna fecha manual
 * devuelve el mismo arreglo sin copiar.
 */
export function applyManualDates(
  contacts: CampaignContact[],
  dates: ManualCampaignDates | null | undefined,
): CampaignContact[] {
  const { fechaVencimiento, fechaAsamblea } = normalizeManualDates(dates)

  if (!fechaVencimiento && !fechaAsamblea) {
    return contacts
  }

  return contacts.map((contact) => ({
    ...contact,
    ...(fechaVencimiento ? { fechaVencimiento } : {}),
    ...(fechaAsamblea ? { fechaAsamblea } : {}),
  }))
}
