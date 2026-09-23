'use client'

import { useEffect, useState } from 'react'

import { UserMenu } from './user-menu'

// El navbar del admin también se renderiza dentro de páginas cliente, así que
// el usuario se pide a /api/auth/me en vez de leer la cookie en el servidor.
export function NavbarUser() {
  const [usuario, setUsuario] = useState<{ nombre: string; rol: string } | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((json) => json.success && setUsuario(json.data))
      .catch(() => {})
  }, [])

  if (!usuario) return null
  return <UserMenu nombre={usuario.nombre} rol={usuario.rol} />
}
