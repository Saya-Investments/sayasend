'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { getWhatsAppErrorDescription } from '@/lib/whatsapp-error-codes'

export type ErrorItem = {
  code: string
  /** Contactos únicos con ese código, sin importar a qué número se envió. */
  count: number
  /** Contactos cuyo error salió al enviar al teléfono principal. */
  principal: number
  /** Contactos cuyo error salió en el segundo intento, al teléfono alterno. */
  alterno: number
}

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

  // El desglose por teléfono solo aparece si la campaña realmente tuvo un
  // segundo intento al alterno. Si no (p. ej. asociados sin telefono_3), se
  // mantiene la barra única por contacto de siempre.
  const hayAlterno = errors.some((e) => e.alterno > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Errores Detectados</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(180, errors.length * (hayAlterno ? 60 : 45))}>
          <BarChart data={errors} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="code" width={80} />
            <Tooltip
              formatter={(value: number, name: string) => [value, hayAlterno ? name : 'Contactos']}
              labelFormatter={(label) => `Código ${label} — ${getWhatsAppErrorDescription(label)}`}
            />
            {hayAlterno ? (
              <>
                <Legend />
                <Bar dataKey="principal" name="Teléfono principal" fill="#E74C3C" radius={[0, 4, 4, 0]} />
                <Bar dataKey="alterno" name="Teléfono alterno" fill="#E59866" radius={[0, 4, 4, 0]} />
              </>
            ) : (
              <Bar dataKey="count" fill="#E74C3C" radius={[0, 4, 4, 0]} />
            )}
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
          {hayAlterno ? (
            <>
              Los errores están separados según el número al que se envió: el teléfono principal
              del asociado y el alterno del segundo intento. Se cuentan contactos únicos, no
              eventos; un mismo contacto puede aparecer en más de un código y en ambos teléfonos,
              por lo que la suma de las barras puede superar el total de fallidos.
            </>
          ) : (
            <>
              Cada barra cuenta contactos únicos afectados, no eventos. Un mismo contacto puede
              aparecer en más de un código, por lo que la suma de las barras puede superar el total
              de fallidos. Esta campaña no registra intentos a un teléfono alterno, así que no hay
              desglose por número.
            </>
          )}
        </p>
      </CardContent>
    </Card>
  )
}
