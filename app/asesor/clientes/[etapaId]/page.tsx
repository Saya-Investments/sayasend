import { notFound, redirect } from 'next/navigation'

import { FichaCliente } from '@/components/bot/ficha-cliente'
import { getSesion } from '@/lib/auth/server'
import { puedeVerEtapa } from '@/lib/bot/queries'

type Props = { params: Promise<{ etapaId: string }> }

export default async function AsesorFichaPage({ params }: Props) {
  const sesion = await getSesion()
  if (!sesion) redirect('/login')
  const { etapaId } = await params

  // Un asesor solo abre fichas de clientes asignados a él.
  if (!/^[0-9a-f-]{36}$/i.test(etapaId) || !(await puedeVerEtapa(sesion, etapaId))) notFound()

  return <FichaCliente etapaUuid={etapaId} volverHref="/asesor" volverLabel="Volver a mi bandeja" />
}
