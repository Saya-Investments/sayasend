'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DetalleCliente } from '@/lib/bot/queries'
import { EstadoConvBadge, EtapaBadge, ScoreBadge } from './badges'
import { DetalleBloques, GestionesBloque } from './detalle-cliente'
import { FichaChat } from './ficha-chat'
import { telefonoLegible } from './formato'

type Props = {
  etapaUuid: string
  volverHref: string
  volverLabel: string
}

// Ficha completa: los mismos bloques del panel lateral, a página entera y con
// la conversación al lado.
export function FichaCliente({ etapaUuid, volverHref, volverLabel }: Props) {
  const [d, setD] = useState<DetalleCliente | null>(null)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/bot/clientes/${etapaUuid}`, { cache: 'no-store' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setD(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el cliente')
    }
  }, [etapaUuid])

  useEffect(() => {
    cargar()
  }, [cargar])

  return (
    <div className="space-y-6">
      <Link href={volverHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        {volverLabel}
      </Link>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!d && !error && <p className="text-sm text-muted-foreground">Cargando…</p>}

      {d && (
        <>
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{d.cliente.nombre || 'Sin nombre'}</h1>
              <ScoreBadge score={d.etapaActual.scoreActual} motivoPrincipal={d.etapaActual.motivoPrincipal} />
              <EtapaBadge etapa={d.etapaActual.etapa} ciclo={d.etapaActual.ciclo} />
              <EstadoConvBadge estado={d.etapaActual.estadoConversacional} />
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {telefonoLegible(d.cliente.telefono)} · DNI {d.cliente.dni}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <div className="space-y-6 lg:col-span-3">
              <DetalleBloques d={d} onCambio={cargar} />
            </div>
            <div className="space-y-6 lg:col-span-2">
              <div>
                <h2 className="mb-3 text-base font-semibold text-foreground">Conversación</h2>
                <FichaChat etapaUuid={etapaUuid} />
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Gestiones del asesor</CardTitle>
                </CardHeader>
                <CardContent>
                  <GestionesBloque d={d} onCambio={cargar} />
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
