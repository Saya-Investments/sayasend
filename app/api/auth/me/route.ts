import { NextResponse } from 'next/server'

import { getSesion } from '@/lib/auth/server'

export const runtime = 'nodejs'

export async function GET() {
  const sesion = await getSesion()
  if (!sesion) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
  }
  return NextResponse.json({
    success: true,
    data: { id: sesion.sub, nombre: sesion.nombre, email: sesion.email, rol: sesion.rol },
  })
}
