import { notFound, redirect } from 'next/navigation'

import { AppLayout } from '@/components/layout/app-layout'
import { FichaCliente } from '@/components/bot/ficha-cliente'
import { getSesion } from '@/lib/auth/server'
import { prisma } from '@/lib/prisma'

type Props = { params: Promise<{ etapaId: string }> }

export default async function BotFichaAdminPage({ params }: Props) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'admin') redirect('/login')
  const { etapaId } = await params

  if (!/^[0-9a-f-]{36}$/i.test(etapaId)) notFound()
  const existe = await prisma.edu_etapa_cliente.findUnique({
    where: { etapa_uuid: etapaId },
    select: { etapa_uuid: true },
  })
  if (!existe) notFound()

  return (
    <AppLayout>
      <div className="p-8">
        <FichaCliente etapaUuid={etapaId} volverHref="/bot" volverLabel="Volver al Bot Educador" />
      </div>
    </AppLayout>
  )
}
