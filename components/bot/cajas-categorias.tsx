import { FileText, HelpCircle, TriangleAlert, UserMinus } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { ResumenCategorias } from '@/lib/bot/queries'

// Los cuatro grupos de temas, con el detalle de las categorías que el bot
// escribe en `edu_incidencia.categoria`. El grupo (`tipo`) lo calcula Postgres.
const GRUPOS = [
  {
    tipo: 'PREGUNTA',
    label: 'Preguntas',
    ayuda: 'Dudas que trajo el cliente',
    icono: HelpCircle,
    barra: 'bg-sky-500',
    acento: 'bg-sky-50 text-sky-700',
    borde: 'border-t-sky-500',
    categorias: [
      { clave: 'funcionamiento', label: 'Funcionamiento' },
      { clave: 'producto', label: 'Producto' },
      { clave: 'pagos', label: 'Pagos' },
    ],
  },
  {
    tipo: 'RECLAMO',
    label: 'Reclamos',
    ayuda: 'Molestias e información confusa',
    icono: TriangleAlert,
    barra: 'bg-amber-500',
    acento: 'bg-amber-50 text-amber-800',
    borde: 'border-t-amber-500',
    categorias: [
      { clave: 'reclamo_frustracion', label: 'Reclamo' },
      { clave: 'contradictoria', label: 'Info contradictoria' },
      { clave: 'incompleta', label: 'Info incompleta' },
    ],
  },
  {
    tipo: 'RETIRO',
    label: 'Retiros',
    ayuda: 'Pidió retirarse',
    icono: UserMinus,
    barra: 'bg-red-500',
    acento: 'bg-red-50 text-red-700',
    borde: 'border-t-red-500',
    categorias: [{ clave: 'retiro', label: 'Retiro' }],
  },
  {
    tipo: 'CAJA_NEGRA',
    label: 'Atención humana',
    ayuda: 'Seguros, legal, traspaso o pidió un asesor',
    icono: FileText,
    barra: 'bg-violet-500',
    acento: 'bg-violet-50 text-violet-700',
    borde: 'border-t-violet-500',
    categorias: [{ clave: 'caja_negra', label: 'Caja negra' }],
  },
] as const

export function CajasCategorias({ resumen }: { resumen: ResumenCategorias }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {GRUPOS.map((g) => {
        const Icono = g.icono
        const total = g.categorias.reduce((acc, c) => acc + (resumen.porCategoria[c.clave] ?? 0), 0)
        const pctGrupo = resumen.total > 0 ? Math.round((total / resumen.total) * 100) : 0

        return (
          <div key={g.tipo} className={cn('rounded-lg border border-t-4 border-border bg-card p-5', g.borde)}>
            <div className="flex items-start gap-3">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', g.acento)}>
                <Icono className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-foreground">{g.label}</div>
                <div className="text-xs text-muted-foreground">{g.ayuda}</div>
              </div>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-bold text-foreground">{total}</span>
              <span className="text-xs text-muted-foreground">
                {pctGrupo}% de {resumen.total || 0} temas
              </span>
            </div>

            <ul className="mt-4 space-y-2 border-t border-border pt-3">
              {g.categorias.map((c) => {
                const n = resumen.porCategoria[c.clave] ?? 0
                // Proporción dentro del grupo: compara las cajitas entre sí.
                const ancho = total > 0 ? Math.round((n / total) * 100) : 0
                return (
                  <li key={c.clave} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{c.label}</span>
                      <span className="font-semibold text-foreground">{n}</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-muted">
                      <div className={cn('h-full rounded-full', g.barra)} style={{ width: `${ancho}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
