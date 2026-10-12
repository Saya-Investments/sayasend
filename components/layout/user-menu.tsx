'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export function UserMenu({ nombre, rol }: { nombre: string; rol: string }) {
  const router = useRouter()

  async function salir() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right leading-tight sm:block">
        <div className="text-sm font-semibold text-foreground">{nombre}</div>
        <div className="text-xs capitalize text-muted-foreground">{rol}</div>
      </div>
      <button
        type="button"
        onClick={salir}
        title="Cerrar sesión"
        className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
      >
        <LogOut className="h-5 w-5" />
      </button>
    </div>
  )
}
