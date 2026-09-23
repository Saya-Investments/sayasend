import { redirect } from 'next/navigation'

import { AppLayout } from '@/components/layout/app-layout'
import { BotAdminTabs } from '@/components/bot/bot-admin-tabs'
import { CentroTareas } from '@/components/bot/centro-tareas'
import { getSesion } from '@/lib/auth/server'
import { resumenTareas } from '@/lib/bot/queries'

export const dynamic = 'force-dynamic'

// Centro de tareas del admin: las tareas de todos los clientes del piloto.
// Cada caja lleva a la tabla de clientes filtrada por ese tipo.
export default async function BotAdminPage() {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'admin') redirect('/login')

  const resumen = await resumenTareas(sesion)
  const fecha = new Date().toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <AppLayout>
      <div className="space-y-6 p-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Bot Educador</h1>
          <p className="text-muted-foreground">
            Tareas de todos los clientes del piloto. Entra a una caja para ver esos clientes y asignarles un asesor.
          </p>
        </div>
        <BotAdminTabs />

        <CentroTareas
          resumen={resumen}
          hrefBase="/bot/clientes"
          fecha={fecha}
          subtitulo="Temas que el bot derivó, de todos los clientes"
        />
      </div>
    </AppLayout>
  )
}
