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
              labelFormatter={(label) => `Código ${label}`}
            />
            <Bar dataKey="count" fill="#E74C3C" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted-foreground mt-4 italic">
          Los códigos de error más frecuentes pueden indicar problemas sistemáticos
        </p>
      </CardContent>
    </Card>
  )
}
