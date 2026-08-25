'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ContactabilityMetrics } from '@/lib/types'

interface RateCardsProps {
  metrics: ContactabilityMetrics
  denominator?: number
  denominatorLabel?: string
}

export function RateCards({
  metrics,
  denominator = metrics.total,
  denominatorLabel = 'contactos',
}: RateCardsProps) {
  const rate = (value: number) => (denominator > 0 ? (value * 100) / denominator : 0)

  // Las tres se calculan sobre el total, así que no son excluyentes entre sí:
  // los leídos ya están contados dentro de los entregados. La descripción deja
  // explícito el numerador para que no se lean como partes de un mismo 100%.
  const rates = [
    {
      title: 'Tasa de Entrega',
      value: rate(metrics.delivered).toFixed(1),
      description: `${metrics.delivered} de ${denominator} ${denominatorLabel} alcanzaron entrega (incluye los leídos)`,
      color: 'text-green-600',
    },
    {
      title: 'Tasa de Lectura',
      value: rate(metrics.read).toFixed(1),
      description: `${metrics.read} de ${denominator} ${denominatorLabel} alcanzaron lectura`,
      color: 'text-purple-600',
    },
    {
      title: 'Tasa de Fallo',
      value: rate(metrics.failed).toFixed(1),
      description: `${metrics.failed} de ${denominator} ${denominatorLabel} fallaron al enviarse`,
      color: 'text-red-600',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {rates.map((rate) => (
        <Card key={rate.title}>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {rate.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className={`text-4xl font-bold ${rate.color}`}>
              {rate.value}%
            </div>
            <p className="text-xs text-muted-foreground">{rate.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
