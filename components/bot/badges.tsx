import { cn } from '@/lib/utils'
import {
  ESTADO_CONV_LABEL,
  ESTADO_ETAPA_LABEL,
  ESTADO_INCIDENCIA_LABEL,
  ETAPA_LABEL,
  MOTIVO_DERIVACION_LABEL,
  OTRO_TIPO,
  rangoScore,
  TIPOS_TAREA,
} from '@/lib/bot/constants'

const base = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap'

// El score es del BOT: mide lo que logró por sí solo. Una gestión del asesor no
// lo sube (ver §6 del documento v2).
export function ScoreBadge({
  score,
  motivoPrincipal,
  conRango = true,
}: {
  score: number
  motivoPrincipal?: string | null
  conRango?: boolean
}) {
  const r = rangoScore(score, motivoPrincipal)
  return (
    <span className={cn(base, r.className)} title={`${r.label} · score ${score.toFixed(0)} / 100`}>
      {score.toFixed(0)}
      {conRango && <span className="ml-1 font-medium opacity-80">{r.label}</span>}
    </span>
  )
}

export function DeltaScore({ delta }: { delta: number }) {
  if (!delta) return <span className="text-xs text-muted-foreground">sin cambios</span>
  const sube = delta > 0
  return (
    <span className={cn('text-xs font-semibold', sube ? 'text-emerald-700' : 'text-red-600')}>
      {sube ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}
    </span>
  )
}

export function EtapaBadge({ etapa, ciclo }: { etapa: string; ciclo?: number }) {
  return (
    <span className={cn(base, 'border-primary/20 bg-primary/10 text-primary')}>
      {ETAPA_LABEL[etapa] ?? etapa}
      {ciclo ? <span className="ml-1 font-medium opacity-70">{String(ciclo).slice(4)}/{String(ciclo).slice(0, 4)}</span> : null}
    </span>
  )
}

export function EstadoConvBadge({ estado }: { estado: string | null }) {
  if (!estado) return <span className="text-sm text-muted-foreground">Sin estado</span>
  const info = ESTADO_CONV_LABEL[estado]
  const inconforme = estado.startsWith('INCONFORME')
  return (
    <span
      className={cn(base, inconforme ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-border bg-muted text-foreground')}
      title={info?.ayuda}
    >
      {info?.label ?? estado}
    </span>
  )
}

export function EstadoEtapaBadge({ estado }: { estado: string }) {
  const salida = estado.startsWith('SALIDA')
  return (
    <span
      className={cn(
        base,
        estado === 'EN_CURSO'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : salida
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-border bg-muted text-muted-foreground',
      )}
    >
      {ESTADO_ETAPA_LABEL[estado] ?? estado}
    </span>
  )
}

export function EstadoIncidenciaBadge({ estado }: { estado: string }) {
  const resuelta = estado.startsWith('RESUELTA')
  const abierta = estado === 'ABIERTA' || estado === 'EN_INTENTO' || estado === 'DERIVADA'
  return (
    <span
      className={cn(
        base,
        resuelta
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : abierta
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : 'border-border bg-muted text-muted-foreground',
      )}
    >
      {ESTADO_INCIDENCIA_LABEL[estado] ?? estado}
    </span>
  )
}

// Por qué llegó al asesor. Un retiro va primero siempre.
export function MotivoDerivacionBadge({ motivo }: { motivo: string | null }) {
  if (!motivo) return null
  const info = MOTIVO_DERIVACION_LABEL[motivo]
  return (
    <span
      className={cn(base, motivo === 'RETIRO' ? 'border-red-700 bg-red-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-700')}
      title={info?.ayuda}
    >
      {info?.label ?? motivo}
    </span>
  )
}

// Tipo de tarea: la caja del centro de tareas a la que pertenece.
export function TipoTareaBadge({ tipo }: { tipo: string }) {
  const t = [...TIPOS_TAREA, OTRO_TIPO].find((x) => x.tipo === tipo) ?? OTRO_TIPO
  return <span className={cn(base, 'border-transparent', t.acento)}>{t.label}</span>
}

export function CategoriaBadge({ categoria }: { categoria: string }) {
  return <span className={cn(base, 'border-border bg-muted text-foreground')}>{categoria.replace(/_/g, ' ')}</span>
}

export function PruebaBadge() {
  return <span className={cn(base, 'border-dashed border-slate-400 text-slate-500')}>PRUEBA</span>
}
