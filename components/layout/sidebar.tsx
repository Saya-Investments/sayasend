'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  CalendarDays,
  Mail,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'sayasend-sidebar-collapsed'

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === 'true')
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current
      window.localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }

  const items = [
    {
      title: 'Plantillas',
      href: '/templates',
      icon: Mail,
    },
    {
      title: 'Campañas',
      href: '/campaigns',
      icon: Send,
      // No marcar "Campañas" como activa cuando estamos en el calendario.
      excludeHref: '/campaigns/calendar',
    },
    {
      title: 'Calendario',
      href: '/campaigns/calendar',
      icon: CalendarDays,
    },
    {
      title: 'Chat',
      href: '/chat',
      icon: MessageCircle,
    },
  ]

  return (
    <aside
      className={cn(
        'hidden shrink-0 border-r border-border bg-card transition-[width] duration-200 md:flex md:flex-col',
        collapsed ? 'w-20' : 'w-64',
      )}
    >
      <div className={cn('flex-1 space-y-2', collapsed ? 'p-3' : 'p-6')}>
        {items.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname.startsWith(item.href) &&
            !(item.excludeHref && pathname.startsWith(item.excludeHref))
          
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.title : undefined}
              className={cn(
                'flex min-h-11 items-center rounded-lg font-medium transition-colors',
                collapsed ? 'justify-center px-3 py-3' : 'gap-3 px-4 py-3',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              )}
            >
              <Icon className="size-5 shrink-0" />
              <span className={cn(collapsed && 'sr-only')}>{item.title}</span>
            </Link>
          )
        })}
      </div>
      <div className={cn('border-t border-border', collapsed ? 'p-3' : 'p-4')}>
        <Button
          type="button"
          variant="ghost"
          onClick={toggleCollapsed}
          title={collapsed ? 'Expandir menú' : 'Contraer menú'}
          aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
          className={cn('min-h-11', collapsed ? 'w-full px-0' : 'w-full justify-start gap-3')}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-5" />
          ) : (
            <>
              <PanelLeftClose className="size-5" />
              Contraer menú
            </>
          )}
        </Button>
      </div>
    </aside>
  )
}
