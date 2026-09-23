import Link from 'next/link'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { label, RESULTADOS_ACCION, TIPOS_ACCION } from '@/lib/bot/constants'
import type { ClienteBotFila } from '@/lib/bot/queries'
import { DeltaScore, EstadoConvBadge, EtapaBadge, MotivoDerivacionBadge, PruebaBadge, ScoreBadge } from './badges'
import { AsignarAsesor } from './asignar-asesor'
import { ClienteAccionesFila } from './cliente-panel'
import { fechaCorta, fechaHora, telefonoLegible, textoDiasRestantes, textoEstadoBot } from './formato'

type Props = {
  clientes: ClienteBotFila[]
  // Ruta base de la ficha: '/asesor/clientes' o '/bot/clientes'.
  hrefBase: string
  mostrarAsesor?: boolean
  // Solo admin: permite asignar/reasignar el asesor desde la misma tabla.
  asesores?: Array<{ id: string; nombre: string }>
}

// Resultados de gestión que dejan al cliente pendiente de otro intento.
const RESULTADOS_PENDIENTES = new Set(['NO_CONTESTO', 'SEGUIMIENTO'])

export function ClientesTable({ clientes, hrefBase, mostrarAsesor = false, asesores }: Props) {
  if (clientes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
        No hay clientes con estos filtros.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            {mostrarAsesor && <TableHead>Asesor</TableHead>}
            <TableHead>Etapa</TableHead>
            <TableHead>Ventana</TableHead>
            <TableHead>Score del bot</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Temas</TableHead>
            <TableHead>Gestión del asesor</TableHead>
            <TableHead>Última respuesta</TableHead>
            {/* Fija a la derecha: la tabla es ancha y los botones tienen que verse sin hacer scroll. */}
            <TableHead className="sticky right-0 bg-card text-right shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)]">
              Opciones
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientes.map((c) => {
            const bot = textoEstadoBot(c.botPausadoHasta)
            return (
              <TableRow key={c.etapaUuid}>
                <TableCell>
                  <Link href={`${hrefBase}/${c.etapaUuid}`} className="block font-medium text-primary hover:underline">
                    {c.nombre || 'Sin nombre'}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {telefonoLegible(c.telefono)} · {c.codigos.join(', ') || 'sin contrato'}
                  </span>
                  {c.esPrueba && (
                    <span className="ml-2">
                      <PruebaBadge />
                    </span>
                  )}
                </TableCell>
                {mostrarAsesor && (
                  <TableCell className="text-sm">
                    {asesores ? (
                      <AsignarAsesor etapaUuid={c.etapaUuid} asesorId={c.asesorId} asesores={asesores} />
                    ) : (
                      c.asesorNombre ?? <span className="text-muted-foreground">Sin asignar</span>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  <EtapaBadge etapa={c.etapa} />
                  {bot.alerta && <div className="mt-1 text-xs text-amber-700">{bot.texto}</div>}
                </TableCell>
                <TableCell className="text-sm">
                  {fechaCorta(c.ventanaFin)}
                  <div
                    className={cn(
                      'text-xs',
                      c.diasRestantes !== null && c.diasRestantes <= 3 ? 'font-semibold text-amber-700' : 'text-muted-foreground',
                    )}
                  >
                    {textoDiasRestantes(c.diasRestantes)}
                  </div>
                </TableCell>
                <TableCell>
                  <ScoreBadge score={c.score} motivoPrincipal={c.motivoPrincipal} />
                  <div className="mt-1">
                    <DeltaScore delta={c.deltaScore} />
                  </div>
                </TableCell>
                <TableCell>
                  <EstadoConvBadge estado={c.estadoConversacional} />
                </TableCell>
                <TableCell className="text-sm">
                  {c.motivoPrincipal ? (
                    <span className={c.motivoPrincipal === 'retiro' ? 'font-semibold text-red-600' : ''}>
                      {label(c.motivoPrincipal)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {c.nAbiertas > 0 ? (
                    <span className="font-medium">{c.nAbiertas} abiertos</span>
                  ) : (
                    <span className="text-muted-foreground">sin temas</span>
                  )}
                  {c.derivadaPendiente && (
                    <div className="mt-1 flex items-center gap-1">
                      <MotivoDerivacionBadge motivo={c.motivoDerivacion} />
                      <span className="text-xs text-muted-foreground">derivado</span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {c.accionResultado ? (
                    <>
                      <div
                        className={cn(
                          'font-medium',
                          RESULTADOS_PENDIENTES.has(c.accionResultado) ? 'text-amber-700' : 'text-foreground',
                        )}
                      >
                        {RESULTADOS_ACCION.find((r) => r.value === c.accionResultado)?.label ?? c.accionResultado}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {TIPOS_ACCION.find((t) => t.value === c.accionTipo)?.label ?? c.accionTipo} ·{' '}
                        {fechaHora(c.accionAt)}
                        {c.totalAcciones > 1 && ` · ${c.totalAcciones} gestiones`}
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Sin gestión</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">{fechaHora(c.ultimaRespuesta)}</TableCell>
                <TableCell className="sticky right-0 bg-card shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)]">
                  <ClienteAccionesFila etapaUuid={c.etapaUuid} nombre={c.nombre} hrefBase={hrefBase} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
