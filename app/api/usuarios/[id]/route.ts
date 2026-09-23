import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { requireSesion, respuestaError } from '@/lib/auth/server'
import { TEMP_HASH } from '@/lib/auth/login'

export const runtime = 'nodejs'

// PATCH /api/usuarios/[id]  { nombre?, rol?, activo?, resetPassword? }
// resetPassword vuelve la contraseña a temp_hash: el usuario la define de nuevo
// en su próximo ingreso.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sesion = await requireSesion('admin')
    const { id } = await params
    const body = (await request.json()) as {
      nombre?: string
      rol?: string
      activo?: boolean
      resetPassword?: boolean
    }

    // Un admin no puede quitarse a sí mismo el acceso de admin.
    if (id === sesion.sub && (body.activo === false || (body.rol && body.rol !== 'admin'))) {
      return NextResponse.json(
        { success: false, error: 'No puedes desactivarte ni quitarte el rol de admin' },
        { status: 400 },
      )
    }

    const data: { nombre?: string; rol?: string; activo?: boolean; passwordHash?: string } = {}
    if (typeof body.nombre === 'string' && body.nombre.trim()) data.nombre = body.nombre.trim()
    if (body.rol === 'admin' || body.rol === 'asesor') data.rol = body.rol
    if (typeof body.activo === 'boolean') data.activo = body.activo
    if (body.resetPassword) data.passwordHash = TEMP_HASH

    const existe = await prisma.crmUsuario.findUnique({ where: { id }, select: { id: true } })
    if (!existe) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
    }
    await prisma.crmUsuario.update({ where: { id }, data })
    return NextResponse.json({ success: true })
  } catch (error) {
    return respuestaError(error)
  }
}
