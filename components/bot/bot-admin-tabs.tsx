'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

const TABS = [
  { href: '/bot', label: 'Tareas', exacto: true },
  { href: '/bot/clientes', label: 'Clientes del bot', exacto: false },
  { href: '/bot/metricas', label: 'Métricas', exacto: false },
]

export function BotAdminTabs() {
  const pathname = usePathname()
  return (
    <div className="flex gap-1 border-b border-border">
      {TABS.map((t) => {
        const activo = t.exacto ? pathname === t.href : pathname.startsWith(t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              activo ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
