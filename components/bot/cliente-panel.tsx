'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, ExternalLink, FileText, MessageCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { DetalleCliente } from '@/lib/bot/queries'
import { EtapaBadge, ScoreBadge } from './badges'
import { DetalleBloques, GestionesBloque } from './detalle-cliente'
import { usePolling } from './auto-refresh'
import { FichaChat } from './ficha-chat'
import { telefonoLegible } from './formato'

type Pestana = 'detalle' | 'conversacion' | 'gestiones'

type Props = {
  etapaUuid: string
  nombre: string
  // Ruta de la ficha completa: '/asesor/clientes' o '/bot/clientes'.
  hrefBase: string
}

// Botones de la fila de la lista: cada uno abre el panel lateral en su pestaña.
export function ClienteAccionesFila({ etapaUuid, nombre, hrefBase }: Props) {
  const [pestana, setPestana] = useState<Pestana | null>(null)

  const botones: Array<{ key: Pestana; titulo: string; icon: typeof FileText }> = [
    { key: 'detalle', titulo: 'Detalle del cliente', icon: FileText },
    { key: 'conversacion', titulo: 'Conversación', icon: MessageCircle },
    { key: 'gestiones', titulo: 'Gestiones', icon: ClipboardList },
  ]

  return (
    <>
      <div className="flex justify-end gap-1">
        {botones.map((b) => {
          const Icon = b.icon
          return (
            <Button
              key={b.key}
              variant="ghost"
              size="icon"
              title={b.titulo}
              aria-label={b.titulo}
              onClick={() => setPestana(b.key)}
              className="h-8 w-8 text-muted-foreground hover:text-primary"
            >
              <Icon className="h-4 w-4" />
            </Button>
          )
        })}
      </div>
      <Sheet open={pestana !== null} onOpenChange={(o) => !o && setPestana(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl">
          {pestana && (
            <ClientePanel
              etapaUuid={etapaUuid}
              nombre={nombre}
              hrefBase={hrefBase}
              pestana={pestana}
              onPestana={setPestana}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

function ClientePanel({
  etapaUuid,
  nombre,
  hrefBase,
  pestana,
  onPestana,
}: Props & { pestana: Pestana; onPestana: (p: Pestana) => void }) {
  const [detalle, setDetalle] = useState<DetalleCliente | null>(null)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/bot/clientes/${etapaUuid}`, { cache: 'no-store' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setDetalle(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el cliente')
    }
  }, [etapaUuid])

  useEffect(() => {
    cargar()
  }, [cargar])

  // El bot sigue conversando mientras el asesor mira la ficha: se recarga sola.
  usePolling(cargar, 15_000)

  const abiertos = detalle?.incidencias.filter((i) => i.derivadaEn && !i.atendidaEn).length ?? 0

  return (
    <>
      <SheetHeader className="border-b border-border p-6">
        <div className="flex items-start justify-between gap-4 pr-8">
          <div className="space-y-1.5">
            <SheetTitle className="text-xl">{nombre || 'Sin nombre'}</SheetTitle>
            <SheetDescription asChild>
              <div className="flex flex-wrap items-center gap-2">
                {detalle && (
                  <>
                    <span>{telefonoLegible(detalle.cliente.telefono)}</span>
                    <ScoreBadge
                      score={detalle.etapaActual.scoreActual}
                      motivoPrincipal={detalle.etapaActual.motivoPrincipal}
                    />
                    <EtapaBadge etapa={detalle.etapaActual.etapa} ciclo={detalle.etapaActual.ciclo} />
                  </>
                )}
              </div>
            </SheetDescription>
          </div>
          <Link
            href={`${hrefBase}/${etapaUuid}`}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Ficha completa
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </SheetHeader>

      <Tabs value={pestana} onValueChange={(v) => onPestana(v as Pestana)} className="p-6">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="detalle">Detalle{abiertos > 0 ? ` (${abiertos})` : ''}</TabsTrigger>
          <TabsTrigger value="conversacion">Conversación</TabsTrigger>
          <TabsTrigger value="gestiones">Gestiones{detalle ? ` (${detalle.acciones.length})` : ''}</TabsTrigger>
        </TabsList>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {!detalle && !error && <p className="text-sm text-muted-foreground">Cargando…</p>}

        {detalle && (
          <>
            <TabsContent value="detalle">
              <DetalleBloques d={detalle} onCambio={cargar} />
            </TabsContent>
            <TabsContent value="conversacion">
              <FichaChat etapaUuid={etapaUuid} />
            </TabsContent>
            <TabsContent value="gestiones">
              <GestionesBloque d={detalle} onCambio={cargar} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </>
  )
}
