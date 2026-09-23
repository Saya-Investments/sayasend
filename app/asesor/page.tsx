import { redirect } from 'next/navigation'

import { CentroTareas } from '@/components/bot/centro-tareas'
import { AutoRefresh } from '@/components/bot/auto-refresh'
import { getSesion } from '@/lib/auth/server'
import { resumenTareas } from '@/lib/bot/queries'

export const dynamic = 'force-dynamic'

// Centro de tareas del asesor. Cada caja lleva a la tabla de clientes filtrada
// por ese tipo de tarea, que es donde se atiende al cliente.
export default async function AsesorTareasPage() {
  const sesion = await getSesion()
  if (!sesion) redirect('/login')

  const resumen = await resumenTareas(sesion)
  const fecha = new Date().toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <CentroTareas resumen={resumen} hrefBase="/asesor/clientes" fecha={fecha} />
      <p className="text-sm text-muted-foreground">
        Entra a una caja para ver los clientes con ese tipo de tarea pendiente. Los retiros son los primeros que hay
        que atender.
      </p>
    </div>
  )
}
