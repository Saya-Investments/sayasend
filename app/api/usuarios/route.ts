import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { requireSesion, respuestaError } from '@/lib/auth/server'
import { normalizarEmail } from '@/lib/auth/login'
import { SELECT_USUARIO, serializarUsuario } from '@/lib/auth/usuarios'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await requireSesion('admin')
    const usuarios = await prisma.crmUsuario.findMany({
      select: SELECT_USUARIO,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    })
    return NextResponse.json({ success: true, data: usuarios.map(serializarUsuario) })
  } catch (error) {
    return respuestaError(error)
  }
}

// POST /api/usuarios  { email, nombre, rol }
// Se crea con temp_hash: el usuario fija su contraseña en el primer ingreso.
export async function POST(request: NextRequest) {
  try {
    await requireSesion('admin')
    const body = (await request.json()) as { email?: string; nombre?: string; rol?: string }
    const email = normalizarEmail(body.email)
    const nombre = (body.nombre ?? '').trim()
    const rol = body.rol === 'admin' ? 'admin' : 'asesor'

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !nombre) {
      return NextResponse.json({ success: false, error: 'Nombre y correo válidos son obligatorios' }, { status: 400 })
    }
    if (await prisma.crmUsuario.findUnique({ where: { email }, select: { id: true } })) {
      return NextResponse.json({ success: false, error: 'Ya existe un usuario con ese correo' }, { status: 409 })
    }

    const usuario = await prisma.crmUsuario.create({ data: { email, nombre, rol }, select: SELECT_USUARIO })
    return NextResponse.json({ success: true, data: serializarUsuario(usuario) })
  } catch (error) {
    return respuestaError(error)
  }
}
