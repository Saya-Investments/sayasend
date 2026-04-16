'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Send, CheckCircle2, Eye, AlertCircle } from 'lucide-react'
import type { ContactabilityMetrics } from '@/lib/types'

interface MetricsCardsProps {
  metrics: ContactabilityMetrics
}

export function MetricsCards({ metrics }: MetricsCardsProps) {
  const cards = [
    {
      title: 'Total',
      value: metrics.total,
      icon: Users,
      color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    },
    {
      title: 'Enviados',
      value: metrics.sent,
      icon: Send,
      color: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300',
    },
    {
      title: 'Entregados',
      value: metrics.delivered,
      icon: CheckCircle2,
      color: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300',
    },
    {
      title: 'Leídos',
      value: metrics.read,
      icon: Eye,
      color: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300',
    },
    {
      title: 'Fallidos',
      value: metrics.failed,
      icon: AlertCircle,
      color: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
  )
}
