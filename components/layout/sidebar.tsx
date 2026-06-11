'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Mail, Send, MessageCircle, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const pathname = usePathname()

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
    <div className="w-64 border-r border-border bg-card min-h-screen">
      <div className="p-6 space-y-4">
        {items.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname.startsWith(item.href) &&
            !(item.excludeHref && pathname.startsWith(item.excludeHref))
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              )}
            >
              <Icon className="w-5 h-5" />
              {item.title}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
