'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, Eye, RefreshCw, Users } from 'lucide-react'

import { Calendar, CalendarDayButton } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export type ScheduledCampaign = {
  id: string
  nombre: string
  scheduledAt: string // ISO
  totalContacts: number
  refreshOnSend: boolean
  template: { nombre: string } | null
}

// Clave de día por sus componentes locales — agrupa las campañas igual que se
// muestran en el resto de la app (new Date(...).toLocaleString()).
function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function sameDay(a: Date, b: Date) {
  return dayKey(a) === dayKey(b)
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

export function CampaignsCalendar({ campaigns }: { campaigns: ScheduledCampaign[] }) {
  // Pre-parsea las fechas una vez.
  const items = useMemo(
    () => campaigns.map((c) => ({ ...c, date: new Date(c.scheduledAt) })),
    [campaigns],
  )

  // Días que tienen al menos una campaña (para marcarlos con un punto).
  const daysWithCampaigns = useMemo(() => {
    const set = new Set<string>()
    for (const item of items) set.add(dayKey(item.date))
    return set
  }, [items])

  // Día seleccionado: por defecto la próxima campaña programada (o hoy).
  const [selected, setSelected] = useState<Date | undefined>(() => {
    const now = new Date()
    const upcoming = items.find((item) => item.date.getTime() >= now.getTime())
    return upcoming?.date ?? items[0]?.date ?? now
  })

  const dayCampaigns = useMemo(() => {
    if (!selected) return []
    return items
      .filter((item) => sameDay(item.date, selected))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [items, selected])

  // DayButton que añade un punto bajo el número en los días con campañas.
  const DayButton = useMemo(() => {
    function DayButtonWithDot(
      props: React.ComponentProps<typeof CalendarDayButton>,
    ) {
      const has = daysWithCampaigns.has(dayKey(props.day.date))
      return (
        <CalendarDayButton {...props}>
          {props.children}
          {has && (
            <span className="bg-primary mx-auto size-1 rounded-full" aria-hidden />
          )}
        </CalendarDayButton>
      )
    }
    return DayButtonWithDot
  }, [daysWithCampaigns])

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
      <Card className="w-fit">
        <CardContent className="p-2">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={setSelected}
            components={{ DayButton }}
            className="p-0"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="size-5" />
            {selected
              ? selected.toLocaleDateString('es-CO', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
              : 'Selecciona un día'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {dayCampaigns.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No hay campañas programadas para este día.
            </div>
          ) : (
            dayCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border p-4"
              >
                <div className="space-y-1">
                  <p className="font-medium">{campaign.nombre}</p>
                  <p className="text-sm text-muted-foreground">
                    {campaign.template?.nombre ?? 'Sin plantilla'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge variant="outline" className="gap-1">
                      <CalendarClock className="size-3" />
                      {formatTime(campaign.date)}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Users className="size-3" />
                      {campaign.totalContacts.toLocaleString('es-CO')}
                    </Badge>
                    {campaign.refreshOnSend && (
                      <Badge variant="secondary" className="gap-1">
                        <RefreshCw className="size-3" />
                        Base del día
                      </Badge>
                    )}
                  </div>
                </div>
                <Link href={`/campaigns/${campaign.id}`}>
                  <Button size="sm" variant="ghost" className="gap-2">
                    <Eye className="size-4" />
                    Ver
                  </Button>
                </Link>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
