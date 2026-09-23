import { redirect } from 'next/navigation'

import { AsesorSidebar } from '@/components/layout/asesor-sidebar'
import { Navbar } from '@/components/layout/navbar'
import { getSesion } from '@/lib/auth/server'

export const metadata = { title: 'SAYASEND · Asesor' }

// Área del asesor: mismo navbar y menú lateral que el admin, pero con sus
// propias opciones (tareas y clientes).
export default async function AsesorLayout({ children }: { children: React.ReactNode }) {
  const sesion = await getSesion()
  if (!sesion) redirect('/login')

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <AsesorSidebar />
        <main className="flex-1 overflow-auto bg-background p-8">{children}</main>
      </div>
    </div>
  )
}
