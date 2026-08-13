'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Send, CheckCircle2, Eye, AlertCircle, Clock } from 'lucide-react'
import type { ContactabilityMetrics } from '@/lib/types'

interface MetricsCardsProps {
  metrics: ContactabilityMetrics
}

export function MetricsCards({ metrics }: MetricsCardsProps) {
  // Cada contacto cuenta en un solo estado: el más avanzado que alcanzó. Por eso
  // "Enviados" son los que aún no confirman entrega y "Entregados" los que no se
  // leyeron; así los baldes suman el total.
  const cards = [
    {
      title: 'Total',
      value: metrics.total,
      icon: Users,
      color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
      show: true,
    },
    {
      title: 'Pendientes',
      value: metrics.pending,
      icon: Clock,
      color: 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300',
      show: metrics.pending > 0,
    },
    {
      title: 'Enviados',
      value: metrics.sentOnly,
      icon: Send,
      color: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300',
      show: true,
    },
    {
      title: 'Entregados',
      value: metrics.deliveredOnly,
      icon: CheckCircle2,
      color: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300',
      show: true,
    },
    {
      title: 'Leídos',
      value: metrics.read,
      icon: Eye,
      color: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300',
      show: true,
    },
    {
      title: 'Fallidos',
      value: metrics.failed,
      icon: AlertCircle,
      color: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300',
      show: true,
    },
  ].filter((card) => card.show)

  return (
    <div className="space-y-2">
      <div
        className={`grid grid-cols-1 gap-4 ${
          cards.length === 6 ? 'md:grid-cols-6' : 'md:grid-cols-5'
        }`}
      >
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title}>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className={`p-3 rounded-lg mb-3 ${card.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="text-2xl font-bold">{card.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{card.title}</div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Cada contacto cuenta en un solo estado: el más avanzado que alcanzó. Los
        estados suman el total.
      </p>
    </div>
  )
}
