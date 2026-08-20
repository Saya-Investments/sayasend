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

interface ErrorsChartProps {
  principalErrors: ErrorItem[]
  alternateErrors: ErrorItem[]
}

export function ErrorsChart({ principalErrors, alternateErrors }: ErrorsChartProps) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-foreground">Errores detectados</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Fallos registrados en cada intento de envío, separados por número.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PhoneErrorsCard
          title="Teléfono principal"
          description="Primer intento con clientes.telefono"
          emptyMessage="No hay errores registrados para el teléfono principal."
          errors={principalErrors}
          color="#E74C3C"
        />
        <PhoneErrorsCard
          title="Teléfono alterno"
          description="Segundo intento con clientes.telefono_3"
          emptyMessage="No hay errores registrados para el teléfono alterno."
          errors={alternateErrors}
          color="#E59866"
        />
      </div>

      <p className="text-xs text-muted-foreground italic">
        Cada barra cuenta contactos únicos afectados, no eventos. Un contacto puede aparecer en
        más de un código y en ambas secciones; las métricas generales conservan el resultado final
        del contacto después de todos los intentos.
      </p>
    </section>
  )
}

function PhoneErrorsCard({
  title,
  description,
  emptyMessage,
  errors,
  color,
}: {
  title: string
  description: string
  emptyMessage: string
  errors: ErrorItem[]
  color: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
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
                <Bar dataKey="count" name="Contactos" fill={color} radius={[0, 4, 4, 0]} />
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
      </CardContent>
    </Card>
  )
}
