'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

// Una sola medida por gráfico y un solo color: son magnitudes, no identidades,
// así que no hace falta paleta categórica ni leyenda. El color lo pone el tema.
const COLOR = 'var(--primary)'
const COLOR_SUAVE = 'color-mix(in oklab, var(--primary) 45%, var(--card))'

function CajaTooltip({ titulo, valor, sufijo }: { titulo: string; valor: number; sufijo: string }) {
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-popover-foreground">{titulo}</div>
      <div className="text-muted-foreground">
        {valor} {sufijo}
      </div>
    </div>
  )
}

type Fila = { label: string; total: number }

// Barras horizontales: la etiqueta se lee de corrido y el largo compara.
export function BarrasEstados({ datos, sufijo = 'gestiones' }: { datos: Fila[]; sufijo?: string }) {
  if (datos.length === 0) {
    return <Vacio>Todavía no hay gestiones registradas en este rango.</Vacio>
  }
  const alto = Math.max(160, datos.length * 44)
  const max = Math.max(...datos.map((d) => d.total))

  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 8 }} barCategoryGap={10}>
        <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis type="number" hide domain={[0, max * 1.15]} />
        <YAxis
          type="category"
          dataKey="label"
          width={150}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: 'var(--muted)' }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <CajaTooltip titulo={String(payload[0].payload.label)} valor={Number(payload[0].value)} sufijo={sufijo} />
            ) : null
          }
        />
        <Bar
          dataKey="total"
          fill={COLOR}
          radius={[0, 4, 4, 0]}
          barSize={18}
          isAnimationActive={false}
          label={{ position: 'right', fill: 'var(--foreground)', fontSize: 12, fontWeight: 600 }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

// Evolución en el tiempo: una línea, con puntos para que se vean los días sueltos.
export function LineaPorDia({ datos }: { datos: Array<{ fecha: string; total: number }> }) {
  if (datos.length === 0) {
    return <Vacio>Sin gestiones en este rango.</Vacio>
  }

  // Los días sin gestiones también son dato: sin ellos la línea salta huecos y
  // exagera la actividad.
  const serie: Array<{ fecha: string; total: number }> = []
  const porFecha = new Map(datos.map((d) => [d.fecha, d.total]))
  const dia = new Date(`${datos[0].fecha}T00:00:00Z`)
  const fin = new Date(`${datos[datos.length - 1].fecha}T00:00:00Z`)
  while (dia <= fin) {
    const f = dia.toISOString().slice(0, 10)
    serie.push({ fecha: f, total: porFecha.get(f) ?? 0 })
    dia.setUTCDate(dia.getUTCDate() + 1)
  }

  const formatoDia = (f: string) => {
    const [y, m, d] = f.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-CO', {
      timeZone: 'UTC',
      day: '2-digit',
      month: 'short',
    })
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={serie} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="fecha"
          tickFormatter={formatoDia}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
        />
        <YAxis
          allowDecimals={false}
          width={32}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
        />
        <Tooltip
          cursor={{ stroke: 'var(--border)' }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <CajaTooltip
                titulo={formatoDia(String(payload[0].payload.fecha))}
                valor={Number(payload[0].value)}
                sufijo="gestiones"
              />
            ) : null
          }
        />
        <Line
          type="monotone"
          dataKey="total"
          stroke={COLOR}
          strokeWidth={2}
          isAnimationActive={false}
          dot={{ r: 4, fill: COLOR, stroke: 'var(--card)', strokeWidth: 2 }}
          activeDot={{ r: 6, fill: COLOR, stroke: COLOR_SUAVE, strokeWidth: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
      {children}
    </div>
  )
}
