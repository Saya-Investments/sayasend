import { redirect } from 'next/navigation'

import { AppLayout } from '@/components/layout/app-layout'
import { BotAdminTabs } from '@/components/bot/bot-admin-tabs'
import { CajasCategorias } from '@/components/bot/cajas-categorias'
import { FiltrosRango } from '@/components/bot/filtros-rango'
import { AutoRefresh } from '@/components/bot/auto-refresh'
import { getSesion } from '@/lib/auth/server'
import { ETAPA_LABEL } from '@/lib/bot/constants'
import { resumenCategorias } from '@/lib/bot/queries'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ desde?: string; hasta?: string; etapa?: string }> }

// Métricas del piloto: qué temas trae el cliente, por tipo y por categoría del
// bot. Excluyen los clientes de prueba.
export default async function BotMetricasPage({ searchParams }: Props) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'admin') redirect('/login')

  const { desde, hasta, etapa } = await searchParams
  const etapaValida = etapa && ETAPA_LABEL[etapa] ? etapa : undefined

  const resumen = await resumenCategorias({ desde, hasta }, { etapa: etapaValida })

  return (
    <AppLayout>
      <div className="space-y-6 p-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Métricas del piloto</h1>
          <p className="text-muted-foreground">
            Qué temas trae el cliente, por tipo y categoría. No cuentan los clientes de prueba.
          </p>
        </div>
        <BotAdminTabs />

        <AutoRefresh segundos={60} />
        <FiltrosRango
          selects={[
            {
              nombre: 'etapa',
              etiqueta: 'Etapa',
              placeholder: 'Todas las etapas',
              opciones: Object.entries(ETAPA_LABEL).map(([value, label]) => ({ value, label })),
            },
          ]}
        />

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Temas del cliente
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {resumen.total} en total
              {etapaValida ? ` · ${ETAPA_LABEL[etapaValida]}` : ''}
            </span>
          </h2>
          <CajasCategorias resumen={resumen} />
        </section>
      </div>
    </AppLayout>
  )
}
