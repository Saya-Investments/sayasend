/**
 * Por qué un contacto no entra a una campaña del Bot Educador:
 *
 * - `retiro`: el bot ya lo marcó como retiro (`motivo_principal = 'retiro'`,
 *   salida por retiro o una incidencia RETIRO). Aplica a cualquier etapa.
 * - `admision`: ya está en Admisión — recibió una campaña de Admisión bot o
 *   tiene una etapa ADM en el bot. Solo aplica a campañas de Pre-admisión: si
 *   tiene otro contrato en Admisión, no se le manda la bienvenida de Pre.
 */
export type MotivoExclusionBot = 'retiro' | 'admision'

export interface ContactoExcluidoBot {
  codigoAsociado: string
  numDoc: string
  nombre: string
  motivo: MotivoExclusionBot
  // Código con que el cliente ya está en la base (p. ej. su contrato en
  // Admisión). Puede ser distinto del código del Excel: `clientes` tiene una
  // fila por DNI.
  codigoEnBase?: string
}

export const MOTIVO_EXCLUSION_LABEL: Record<MotivoExclusionBot, string> = {
  retiro: 'Retiro en el Bot Educador',
  admision: 'Contrato en Admisión',
}

export function contarPorMotivo(excluded: ContactoExcluidoBot[]) {
  const counts: Record<MotivoExclusionBot, number> = { retiro: 0, admision: 0 }
  for (const item of excluded) counts[item.motivo]++
  return counts
}

// Texto para avisos: "Se quitaron 10 clientes porque tienen un contrato en
// Admisión y 3 marcados como retiro en el Bot Educador."
export function resumenExclusiones(excluded: ContactoExcluidoBot[], verbo = 'Se quitaron') {
  const { admision, retiro } = contarPorMotivo(excluded)
  const partes: string[] = []
  if (admision > 0) {
    partes.push(
      admision === 1
        ? '1 cliente porque tiene un contrato en Admisión'
        : `${admision} clientes porque tienen un contrato en Admisión`,
    )
  }
  if (retiro > 0) {
    partes.push(
      retiro === 1
        ? '1 cliente marcado como retiro en el Bot Educador'
        : `${retiro} clientes marcados como retiro en el Bot Educador`,
    )
  }
  return partes.length > 0 ? `${verbo} ${partes.join(' y ')}.` : ''
}
