import { TEMP_HASH } from '@/lib/auth/login'

export const SELECT_USUARIO = {
  id: true,
  email: true,
  nombre: true,
  rol: true,
  activo: true,
  ultimoLogin: true,
  createdAt: true,
  passwordHash: true,
} as const

// Nunca sale el hash: solo si todavía tiene el cambio de contraseña pendiente.
export function serializarUsuario(u: {
  id: string
  email: string
  nombre: string
  rol: string
  activo: boolean
  ultimoLogin: Date | null
  createdAt: Date
  passwordHash: string
}) {
  const { passwordHash, ...resto } = u
  return {
    ...resto,
    ultimoLogin: resto.ultimoLogin?.toISOString() ?? null,
    createdAt: resto.createdAt.toISOString(),
    pendienteContrasena: passwordHash === TEMP_HASH,
  }
}

export type UsuarioCrm = ReturnType<typeof serializarUsuario>
