import type { FiltrosClientes } from '@/lib/bot/queries'

export type ParamsClientes = {
  score?: string
  etapa?: string
  retiro?: string
  derivadas?: string
  tipo?: string
  asesor?: string
  q?: string
}

// searchParams de la URL -> filtros de listarClientesBot.
export function filtrosDesdeParams(p: ParamsClientes): FiltrosClientes {
  return {
    rangoScore: p.score || undefined,
    etapa: p.etapa || undefined,
    soloRetiro: p.retiro === '1',
    soloDerivadas: p.derivadas === '1',
    tipoTarea: p.tipo ? p.tipo.toUpperCase() : undefined,
    asesor: p.asesor || undefined,
    q: p.q || undefined,
  }
}
