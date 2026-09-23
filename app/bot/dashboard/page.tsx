import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarCheck, Phone, TrendingUp, Users } from 'lucide-react'

import { AppLayout } from '@/components/layout/app-layout'
import { BotAdminTabs } from '@/components/bot/bot-admin-tabs'
import { BarrasEstados, LineaPorDia } from '@/components/bot/dashboard-charts'
import { FiltrosRango } from '@/components/bot/filtros-rango'
import { fechaHora } from '@/components/bot/formato'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AutoRefresh } from '@/components/bot/auto-refresh'
import { getSesion } from '@/lib/auth/server'
import { listarAsesoresActivos } from '@/lib/bot/asesores'
import { dashboardGestiones } from '@/lib/bot/queries'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ desde?: string; hasta?: string; asesor?: string }> }

// Reporte de lo que registran los asesores: qué resultado le ponen a cada
// gestión, con qué frecuencia y sobre cuántos clientes.
export default async function BotDashboardPage({ searchParams }: Props) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'admin') redirect('/login')

  const { desde, hasta, asesor } = await searchParams
  const [datos, asesores] = await Promise.all([
    dashboardGestiones({ desde, hasta }, { asesorId: asesor }),
    listarAsesoresActivos(),
  ])

  return (
    <AppLayout>
      <div className="space-y-6 p-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard de gestiones</h1>
          <p className="text-muted-foreground">
            Qué resultado le pone el asesor a cada tema que atiende. Son las gestiones registradas en el CRM, no los
            cierres en el bot.
          </p>
        </div>
        <BotAdminTabs />

        <AutoRefresh segundos={60} />
        <FiltrosRango
          selects={[
            {
              nombre: 'asesor',
              etiqueta: 'Asesor',
              placeholder: 'Todos los asesores',
              opciones: asesores.map((a) => ({ value: a.id, label: a.nombre })),
            },
          ]}
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Kpi titulo="Total gestiones" valor={datos.total} icono={<Phone className="h-5 w-5" />} />
          <Kpi titulo="Gestiones hoy" valor={datos.hoy} icono={<CalendarCheck className="h-5 w-5" />} />
          <Kpi
            titulo="Promedio por día"
            valor={datos.promedioDia}
            detalle="de los días con gestiones"
            icono={<TrendingUp className="h-5 w-5" />}
          />
          <Kpi
            titulo="Clientes gestionados"
            valor={datos.clientes}
            detalle={`${datos.asesoresActivos} asesores`}
            icono={<Users className="h-5 w-5" />}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel titulo="Estados de las gestiones" ayuda="El resultado que marcó el asesor">
            <BarrasEstados datos={datos.porResultado} />
          </Panel>
          <Panel titulo="Gestiones por día" ayuda="Cuánto se gestiona en el tiempo">
            <LineaPorDia datos={datos.porDia} />
          </Panel>
          <Panel titulo="Cómo contactó" ayuda="Llamada, WhatsApp o nota">
            <BarrasEstados datos={datos.porTipo} />
          </Panel>
          <Panel titulo="Gestiones por asesor" ayuda="Quién registró cuántas">
            <BarrasEstados datos={datos.porAsesor.map((a) => ({ label: a.asesor, total: a.total }))} />
          </Panel>
        </div>

        <Panel titulo="Últimas gestiones" ayuda="Las 25 más recientes del rango">
          {datos.ultimas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Todavía no hay gestiones registradas con estos filtros.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Asesor</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Observaciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.ultimas.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="whitespace-nowrap text-sm">{fechaHora(g.fecha)}</TableCell>
                      <TableCell className="text-sm">{g.asesor}</TableCell>
                      <TableCell className="text-sm">
                        <Link href={`/bot/clientes/${g.etapaUuid}`} className="font-medium text-primary hover:underline">
                          {g.cliente || 'Sin nombre'}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{g.tipo}</TableCell>
                      <TableCell className="text-sm font-medium">{g.resultado}</TableCell>
                      <TableCell className="max-w-sm text-sm text-muted-foreground">{g.observaciones ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>
      </div>
    </AppLayout>
  )
}

function Kpi({
  titulo,
  valor,
  detalle,
  icono,
}: {
  titulo: string
  valor: number
  detalle?: string
  icono: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card p-5">
      <div>
        <div className="text-xs text-muted-foreground">{titulo}</div>
        <div className="text-3xl font-bold text-foreground">{valor}</div>
        {detalle && <div className="text-xs text-muted-foreground">{detalle}</div>}
      </div>
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">{icono}</div>
    </div>
  )
}

function Panel({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4">
        <h2 className="font-semibold text-foreground">{titulo}</h2>
        {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
      </div>
      {children}
    </section>
  )
}
