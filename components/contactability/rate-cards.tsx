'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ContactabilityMetrics } from '@/lib/types'

interface RateCardsProps {
  metrics: ContactabilityMetrics
}

export function RateCards({ metrics }: RateCardsProps) {
  const rates = [
    {
      title: 'Tasa de Entrega',
      value: metrics.deliveryRate.toFixed(1),
      description: 'Mensajes entregados exitosamente',
      color: 'text-green-600',
    },
    {
      title: 'Tasa de Lectura',
      value: metrics.readRate.toFixed(1),
      description: 'Mensajes leídos por los destinatarios',
      color: 'text-purple-600',
    },
    {
      title: 'Tasa de Fallo',
      value: metrics.failureRate.toFixed(1),
      description: 'Mensajes que fallaron al enviarse',
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
