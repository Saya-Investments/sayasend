'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ClipboardList, LogOut, Users } from 'lucide-react'

import { cn } from '@/lib/utils'

const ITEMS = [
  { title: 'Tareas', href: '/asesor', icon: ClipboardList, exacto: true },
  { title: 'Clientes', href: '/asesor/clientes', icon: Users, exacto: false },
]

// Menú lateral del asesor, con el mismo formato que el del admin.
export function AsesorSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function salir() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
    router.refresh()
  }

  return (
    <div className="flex w-64 shrink-0 flex-col justify-between border-r border-border bg-card">
      <div className="space-y-4 p-6">
        {ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = item.exacto ? pathname === item.href : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-4 py-3 font-medium transition-colors',
                isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
              )}
            >
              <Icon className="h-5 w-5" />
              {item.title}
            </Link>
          )
        })}
      </div>

      <button
        type="button"
        onClick={salir}
        className="m-6 flex items-center gap-3 rounded-lg px-4 py-3 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <LogOut className="h-5 w-5" />
        Cerrar sesión
      </button>
    </div>
  )
}
