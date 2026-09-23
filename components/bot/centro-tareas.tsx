import Link from 'next/link'
import { ClipboardList, CreditCard, FileText, HelpCircle, TriangleAlert, UserMinus } from 'lucide-react'

import { cn } from '@/lib/utils'
import { OTRO_TIPO, TIPOS_TAREA } from '@/lib/bot/constants'
import type { ResumenTareas } from '@/lib/bot/queries'

const ICONOS = {
  retiro: UserMinus,
  reclamo: TriangleAlert,
  caja: FileText,
  pregunta: HelpCircle,
  otros: CreditCard,
} as const

type Props = {
  resumen: ResumenTareas
  // Tipo seleccionado, para resaltar su caja.
  tipoActivo?: string
  // Base de la URL de la pantalla (para los enlaces de cada caja).
  hrefBase: string
  fecha: string
  subtitulo?: string
}

// Cabecera del centro de tareas: totales del asesor y una caja por tipo de
// tema. Cada caja filtra la lista de abajo.
export function CentroTareas({ resumen, tipoActivo, hrefBase, fecha, subtitulo }: Props) {
  const cajas = [...TIPOS_TAREA, OTRO_TIPO].filter(
    (t) => t.tipo !== 'OTROS' || (resumen.porTipo.find((p) => p.tipo === 'OTROS')?.total ?? 0) > 0,
  )

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-primary p-6 text-primary-foreground">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
              <ClipboardList className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Centro de Tareas</h1>
              <p className="text-sm text-primary-foreground/80">{subtitulo ?? 'Temas que el bot te derivó'}</p>
            </div>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm">{fecha}</span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Total titulo="Total tareas" valor={resumen.total} />
          <Total titulo="Pendientes" valor={resumen.pendientes} />
          <Total titulo="Completadas" valor={resumen.completadas} />
          <Total titulo="Efectividad" valor={`${resumen.efectividad}%`} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cajas.map((caja) => {
          const datos = resumen.porTipo.find((p) => p.tipo === caja.tipo)
          const pendientes = datos?.pendientes ?? 0
          const completadas = datos?.completadas ?? 0
          const total = datos?.total ?? 0
          const progreso = total > 0 ? Math.round((completadas / total) * 100) : 0
          const activo = tipoActivo === caja.tipo
          const Icono = ICONOS[caja.icono as keyof typeof ICONOS] ?? ClipboardList

          return (
            <Link
              key={caja.tipo}
              href={activo ? hrefBase : `${hrefBase}?tipo=${caja.tipo}`}
              className={cn(
                'rounded-lg border border-t-4 bg-card p-5 transition-shadow hover:shadow-md',
                caja.className,
                activo ? 'ring-2 ring-primary' : 'border-border',
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', caja.acento)}>
                  <Icono className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">{caja.label}</div>
                  <div className="text-xs text-muted-foreground">{caja.ayuda}</div>
                </div>
              </div>

              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="text-3xl font-bold text-foreground">{pendientes}</div>
                  <div className="text-xs text-muted-foreground">Pendientes</div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-emerald-600">{completadas}</div>
                  <div className="text-xs text-muted-foreground">Completadas</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs font-medium">
                  <span>Progreso</span>
                  <span className="text-muted-foreground">{progreso}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${progreso}%` }} />
                </div>
              </div>

              <div className={cn('mt-4 rounded-md py-1.5 text-center text-xs font-semibold', caja.acento)}>
                {total} {total === 1 ? 'tarea total' : 'tareas totales'}
                {(datos?.agendadas ?? 0) > 0 && ` · ${datos?.agendadas} agendadas`}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function Total({ titulo, valor }: { titulo: string; valor: number | string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold">{valor}</div>
      <div className="text-sm text-primary-foreground/80">{titulo}</div>
    </div>
  )
}
