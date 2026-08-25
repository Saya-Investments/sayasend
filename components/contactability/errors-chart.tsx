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

export type ErrorItem = {
  code: string
  count: number
}

export function ErrorsChart({
  errors,
  emptyMessage = 'No hay errores registrados en esta contactabilidad.',
}: {
  errors: ErrorItem[]
  emptyMessage?: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Errores detectados</CardTitle>
      </CardHeader>
      <CardContent>
        {errors.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">{emptyMessage}</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.max(180, errors.length * 45)}>
              <BarChart
                data={errors}
                layout="vertical"
                margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="code" width={80} />
                <Tooltip
                  formatter={(value: number) => [value, 'Contactos']}
                  labelFormatter={(label) =>
                    `Código ${label} — ${getWhatsAppErrorDescription(label)}`
                  }
                />
                <Bar dataKey="count" name="Contactos" fill="#E74C3C" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Significado de los códigos
              </p>
              <ul className="space-y-1.5">
                {errors.map((error) => (
                  <li key={error.code} className="text-sm flex gap-2">
                    <span className="font-mono font-semibold text-foreground shrink-0 min-w-[60px]">
                      {error.code}
                    </span>
                    <span className="text-muted-foreground">
                      {getWhatsAppErrorDescription(error.code)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        <p className="text-xs text-muted-foreground mt-4 italic">
          Cada barra cuenta contactos únicos afectados, no eventos. Un contacto puede aparecer en
          más de un código.
        </p>
      </CardContent>
    </Card>
  )
}
