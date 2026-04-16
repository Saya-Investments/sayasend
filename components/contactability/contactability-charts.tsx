'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
  Trapezoid,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Funnel,
  FunnelChart,
} from 'recharts'
import type { ContactabilityMetrics } from '@/lib/types'

interface ContactabilityChartsProps {
  metrics: ContactabilityMetrics
}

export function ContactabilityCharts({ metrics }: ContactabilityChartsProps) {
  // Pie chart data
  const statusData = [
    { name: 'Enviados', value: metrics.sent, color: '#0084D1' },
    { name: 'Entregados', value: metrics.delivered, color: '#2ECC71' },
    { name: 'Leídos', value: metrics.read, color: '#9B59B6' },
    { name: 'Fallidos', value: metrics.failed, color: '#E74C3C' },
  ]

  // Funnel data
  const funnelData = [
    {
      name: `Enviados ${metrics.sent} (100%)`,
      value: metrics.sent,
      fill: '#0084D1',
    },
    {
      name: `Entregados ${metrics.delivered} (${((metrics.delivered / metrics.sent) * 100).toFixed(1)}%)`,
      value: metrics.delivered,
      fill: '#2ECC71',
    },
    {
      name: `Leídos ${metrics.read} (${((metrics.read / metrics.sent) * 100).toFixed(1)}%)`,
      value: metrics.read,
      fill: '#9B59B6',
    },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Distribución de Estados</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Funnel Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Funnel de Conversión</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {funnelData.map((item, index) => (
              <div key={index}>
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: item.fill }}
                  />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
                  <div
                    className="h-full flex items-center justify-center text-white text-xs font-bold transition-all"
                    style={{
                      width: `${(item.value / metrics.sent) * 100}%`,
                      backgroundColor: item.fill,
                    }}
                  >
                    {item.value > 0 && `${((item.value / metrics.sent) * 100).toFixed(1)}%`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
