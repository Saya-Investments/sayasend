import { redirect } from 'next/navigation'

import { AppLayout } from '@/components/layout/app-layout'
import { UsuariosClient } from '@/components/usuarios/usuarios-client'
import { getSesion } from '@/lib/auth/server'
import { SELECT_USUARIO, serializarUsuario } from '@/lib/auth/usuarios'
import { prisma } from '@/lib/prisma'

export default async function UsuariosPage() {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'admin') redirect('/login')

  const usuarios = await prisma.crmUsuario.findMany({
    select: SELECT_USUARIO,
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
  })

  return (
    <AppLayout>
      <div className="space-y-6 p-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Usuarios</h1>
          <p className="text-muted-foreground">
            Los usuarios nuevos entran con su correo y definen su contraseña en el primer ingreso.
          </p>
        </div>
        <UsuariosClient usuarios={usuarios.map(serializarUsuario)} miId={sesion.sub} />
      </div>
    </AppLayout>
  )
}
