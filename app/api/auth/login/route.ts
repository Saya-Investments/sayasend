import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

import { prisma } from '@/lib/prisma'
import { normalizarEmail, responderConSesion, TEMP_HASH } from '@/lib/auth/login'

export const runtime = 'nodejs'

// Sayasend es solo para admins: los asesores trabajan en el CRM Educador, que
// comparte la tabla crm_usuarios (mismo correo y contraseña).
function soloAdmins() {
  return NextResponse.json(
    { success: false, error: 'Tu acceso es por el CRM Educador: crmeducador.vercel.app' },
    { status: 403 },
  )
}

// POST /api/auth/login  { email, password }
// Si el usuario todavía no fijó contraseña responde { setupRequired: true }.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; password?: string }
    const email = normalizarEmail(body.email)
    const password = String(body.password ?? '')
    if (!email) {
      return NextResponse.json({ success: false, error: 'Ingresa tu usuario' }, { status: 400 })
    }

    const usuario = await prisma.crmUsuario.findUnique({ where: { email } })
    const credencialesInvalidas = NextResponse.json(
      { success: false, error: 'Usuario o contraseña incorrectos' },
      { status: 401 },
    )
    if (!usuario || !usuario.activo) return credencialesInvalidas

    if (usuario.passwordHash === TEMP_HASH) {
      if (usuario.rol !== 'admin') return soloAdmins()
      return NextResponse.json({ success: true, data: { setupRequired: true } })
    }

    if (!(await bcrypt.compare(password, usuario.passwordHash))) return credencialesInvalidas
    if (usuario.rol !== 'admin') return soloAdmins()

    return responderConSesion(usuario)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
