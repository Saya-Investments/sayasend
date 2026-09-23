import { redirect } from 'next/navigation'

import { AppLayout } from '@/components/layout/app-layout'
import { BotAdminTabs } from '@/components/bot/bot-admin-tabs'
import { ClientesTable } from '@/components/bot/clientes-table'
import { FiltrosClientes } from '@/components/bot/filtros-clientes'
import { AutoRefresh } from '@/components/bot/auto-refresh'
import { getSesion } from '@/lib/auth/server'
import { listarAsesoresActivos } from '@/lib/bot/asesores'
import { filtrosDesdeParams, type ParamsClientes } from '@/lib/bot/filtros'
import { OTRO_TIPO, TIPOS_TAREA } from '@/lib/bot/constants'
import { listarClientesBot } from '@/lib/bot/queries'

type Props = { searchParams: Promise<ParamsClientes> }

export default async function BotClientesAdminPage({ searchParams }: Props) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'admin') redirect('/login')

  const params = await searchParams
  const [clientes, asesores] = await Promise.all([
    listarClientesBot(sesion, filtrosDesdeParams(params)),
    listarAsesoresActivos(),
  ])
  const caja = [...TIPOS_TAREA, OTRO_TIPO].find((t) => t.tipo === params.tipo?.toUpperCase())

  return (
    <AppLayout>
      <div className="space-y-6 p-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {caja ? `Clientes con tarea de ${caja.label.toLowerCase()}` : 'Clientes del bot'}
          </h1>
          <p className="text-muted-foreground">
            {caja ? `${caja.ayuda} · ${clientes.length} clientes` : `Todos los clientes con una etapa en curso (${clientes.length}).`}
          </p>
        </div>
        <BotAdminTabs />
        <AutoRefresh />
        <FiltrosClientes asesores={asesores} />
        <ClientesTable clientes={clientes} hrefBase="/bot/clientes" mostrarAsesor asesores={asesores} />
      </div>
    </AppLayout>
  )
}
