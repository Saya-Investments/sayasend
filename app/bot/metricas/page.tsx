import { redirect } from 'next/navigation'

import { AppLayout } from '@/components/layout/app-layout'
import { BotAdminTabs } from '@/components/bot/bot-admin-tabs'
import { getSesion } from '@/lib/auth/server'
import { metricasPiloto } from '@/lib/bot/queries'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// Métricas del piloto: cómo va el score de las etapas en curso y cómo va la
// atención de las tareas. Excluyen los clientes de prueba.
export default async function BotMetricasPage() {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'admin') redirect('/login')

  const { etapas: e, derivaciones: d } = await metricasPiloto()
  const pct = (n: number) => (e.total ? `${Math.round((n / e.total) * 100)}%` : '—')

  return (
    <AppLayout>
      <div className="space-y-6 p-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Métricas del piloto</h1>
          <p className="text-muted-foreground">
            Etapas en curso y atención de tareas. No cuentan los clientes de prueba.
          </p>
        </div>
        <BotAdminTabs />

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">Score de las etapas en curso</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
            <Metrica titulo="Etapas en curso" valor={e.total} detalle={`${e.pre} pre · ${e.adm} admisión`} />
            <Metrica titulo="Score promedio" valor={e.score_promedio} detalle="0 a 100, del bot" />
            <Metrica titulo="En riesgo (0–29)" valor={e.riesgo} detalle={pct(e.riesgo)} alerta={e.riesgo > 0} />
            <Metrica titulo="Inconformes (30–49)" valor={e.inconforme} detalle={pct(e.inconforme)} />
            <Metrica titulo="Neutros (50–69)" valor={e.neutro} detalle={pct(e.neutro)} />
            <Metrica titulo="Conformes (70–100)" valor={e.conforme} detalle={pct(e.conforme)} />
            <Metrica titulo="Retiros" valor={e.retiros} detalle="motivo principal" alerta={e.retiros > 0} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {e.sin_interaccion} etapas todavía sin interacción. El score mide lo que el bot logró por sí solo: las
            gestiones del asesor no lo suben.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">Atención de las tareas</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <Metrica titulo="Pendientes" valor={d.pendientes} detalle="por atender hoy" />
            <Metrica titulo="Retiros pendientes" valor={d.retiros} detalle="van primero" alerta={d.retiros > 0} />
            <Metrica titulo="Agendadas" valor={d.agendadas} detalle="vuelven en su fecha" />
            <Metrica
              titulo="Sin asignar"
              valor={d.sin_asignar}
              detalle="nadie las ve todavía"
              alerta={d.sin_asignar > 0}
            />
            <Metrica titulo="Atendidas (7 días)" valor={d.atendidas_7d} detalle="cerradas por asesores" />
          </div>
        </section>
      </div>
    </AppLayout>
  )
}

function Metrica({
  titulo,
  valor,
  detalle,
  alerta = false,
}: {
  titulo: string
  valor: number
  detalle?: string
  alerta?: boolean
}) {
  return (
    <div className={cn('rounded-lg border bg-card p-4', alerta ? 'border-red-300' : 'border-border')}>
      <div className="text-xs text-muted-foreground">{titulo}</div>
      <div className={cn('text-2xl font-bold', alerta ? 'text-red-600' : 'text-foreground')}>{valor}</div>
      {detalle && <div className="text-xs text-muted-foreground">{detalle}</div>}
    </div>
  )
}
