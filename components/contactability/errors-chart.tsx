'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { getWhatsAppErrorDescription } from '@/lib/whatsapp-error-codes'

export type ErrorItem = { code: string; count: number }

interface ErrorsChartProps {
  errors: ErrorItem[]
}

export function ErrorsChart({ errors }: ErrorsChartProps) {
  if (errors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Errores Detectados</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No hay errores registrados para esta campaña.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Errores Detectados</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(180, errors.length * 45)}>
          <BarChart data={errors} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="code" width={80} />
            <Tooltip
              formatter={(value: number) => [value, 'Ocurrencias']}
              labelFormatter={(label) => `Código ${label} — ${getWhatsAppErrorDescription(label)}`}
            />
            <Bar dataKey="count" fill="#E74C3C" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Significado de los códigos
          </p>
          <ul className="space-y-1.5">
            {errors.map((e) => (
              <li key={e.code} className="text-sm flex gap-2">
                <span className="font-mono font-semibold text-foreground shrink-0 min-w-[60px]">
                  {e.code}
                </span>
                <span className="text-muted-foreground">
                  {getWhatsAppErrorDescription(e.code)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted-foreground mt-4 italic">
          Los códigos de error más frecuentes pueden indicar problemas sistemáticos
        </p>
      </CardContent>
    </Card>
  )
}
