import { redirect } from 'next/navigation'

import { ClientesTable } from '@/components/bot/clientes-table'
import { FiltrosClientes } from '@/components/bot/filtros-clientes'
import { AutoRefresh } from '@/components/bot/auto-refresh'
import { getSesion } from '@/lib/auth/server'
import { listarClientesBot } from '@/lib/bot/queries'
import { filtrosDesdeParams, type ParamsClientes } from '@/lib/bot/filtros'
import { OTRO_TIPO, TIPOS_TAREA } from '@/lib/bot/constants'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<ParamsClientes> }

export default async function AsesorClientesPage({ searchParams }: Props) {
  const sesion = await getSesion()
  if (!sesion) redirect('/login')

  const params = await searchParams
  const clientes = await listarClientesBot(sesion, filtrosDesdeParams(params))
  const caja = [...TIPOS_TAREA, OTRO_TIPO].find((t) => t.tipo === params.tipo?.toUpperCase())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {caja ? `Clientes con tarea de ${caja.label.toLowerCase()}` : 'Mis clientes'}
        </h1>
        <p className="text-muted-foreground">
          {caja
            ? `${caja.ayuda}. Abre el cliente para ver su conversación, registrar tu gestión y marcar el resultado.`
            : 'Clientes que tienes asignados, con su etapa en curso. Los retiros y los scores más bajos van primero.'}
        </p>
      </div>
      <AutoRefresh />
      <FiltrosClientes />
      <ClientesTable clientes={clientes} hrefBase="/asesor/clientes" />
    </div>
  )
}
