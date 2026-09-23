'use client'

import { cn } from '@/lib/utils'
import { label, MOTIVO_DERIVACION_LABEL, MOTIVO_SCORE_LABEL } from '@/lib/bot/constants'
import type { DetalleCliente } from '@/lib/bot/queries'
import {
  CategoriaBadge,
  DeltaScore,
  EstadoConvBadge,
  EstadoEtapaBadge,
  EstadoIncidenciaBadge,
  EtapaBadge,
  MotivoDerivacionBadge,
  ScoreBadge,
} from './badges'
import { CerrarGestionDialog, PausarBotButton, RegistrarAccionDialog } from './gestiones'
import { fechaCorta, fechaHora, telefonoLegible, textoDiasRestantes, textoEspera, textoEstadoBot } from './formato'
import { RESULTADOS_ACCION, TIPOS_ACCION } from '@/lib/bot/constants'

export function Seccion({ titulo, children, accion }: { titulo: string; children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
        {accion}
      </div>
      {children}
    </section>
  )
}

export function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{titulo}</div>
      <div className="text-sm font-medium text-foreground">{children}</div>
    </div>
  )
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

// ---------------------------------------------------------------------------

export function DetalleBloques({ d, onCambio }: { d: DetalleCliente; onCambio: () => void }) {
  const e = d.etapaActual
  const bot = textoEstadoBot(e.botPausadoHasta, d.cliente.optOut)
  const dias =
    e.ventanaFin === null
      ? null
      : Math.round((Date.parse(`${e.ventanaFin}T00:00:00Z`) - Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)) / 86_400_000)

  return (
    <div className="space-y-8">
      <Seccion titulo="Datos del cliente">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Dato titulo="DNI">{d.cliente.dni}</Dato>
          <Dato titulo="Teléfono">{telefonoLegible(d.cliente.telefono)}</Dato>
          <Dato titulo="Otro teléfono">{d.cliente.telefono3 ? telefonoLegible(d.cliente.telefono3) : '—'}</Dato>
          {/* El score es de todos los contratos que cubre la etapa, no de uno solo. */}
          <Dato titulo="Contratos que cubre la etapa">
            {(e.codigos.length > 0 ? e.codigos : d.cliente.codigoAsociado.split(',')).join(', ')}
          </Dato>
          <Dato titulo="Inscripción">{fechaCorta(d.cliente.fechaInscripcion)}</Dato>
          <Dato titulo="1.ª asamblea">{fechaCorta(d.cliente.fecha1raAsamblea)}</Dato>
          <Dato titulo="Asesor">{d.asesor?.nombre ?? 'Sin asignar'}</Dato>
          <Dato titulo="Bot">
            <span className={bot.alerta ? 'text-amber-700' : ''}>{bot.texto}</span>
          </Dato>
        </div>
      </Seccion>

      <Seccion
        titulo="Etapa en curso"
        accion={e.estadoEtapa === 'EN_CURSO' ? <PausarBotButton etapaUuid={d.etapaUuid} onDone={onCambio} /> : undefined}
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Dato titulo="Etapa">
            <EtapaBadge etapa={e.etapa} ciclo={e.ciclo} />
          </Dato>
          <Dato titulo="Estado de la etapa">
            <EstadoEtapaBadge estado={e.estadoEtapa} />
          </Dato>
          <Dato titulo="Ventana">
            {fechaCorta(e.ventanaInicio)} → {fechaCorta(e.ventanaFin)}
            <span className="block text-xs font-normal text-muted-foreground">{textoDiasRestantes(dias)}</span>
          </Dato>
          <Dato titulo="Score del bot">
            <span className="flex items-center gap-2">
              <ScoreBadge score={e.scoreActual} motivoPrincipal={e.motivoPrincipal} />
              <DeltaScore delta={Number((e.scoreActual - e.scoreInicio).toFixed(2))} />
            </span>
          </Dato>
          <Dato titulo="Estado conversacional">
            <EstadoConvBadge estado={e.estadoConversacional} />
          </Dato>
          <Dato titulo="Motivo principal">
            {e.motivoPrincipal ? (
              <span className={e.motivoPrincipal === 'retiro' ? 'font-semibold text-red-600' : ''}>
                {label(e.motivoPrincipal)}
              </span>
            ) : (
              '—'
            )}
          </Dato>
          <Dato titulo="Última respuesta">{fechaHora(e.ultimaRespuesta)}</Dato>
          <Dato titulo="Riesgo del modelo">{e.riesgo ? label(e.riesgo) : '—'}</Dato>
        </div>
        <p className="rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
          El score mide lo que el bot logró por sí solo: una gestión tuya no lo sube, aunque el tema quede resuelto.
          Lo que sí cambia es el estado del tema y el del cliente.
        </p>
      </Seccion>

      <Seccion titulo={`Temas del cliente (${d.incidencias.length})`}>
        {d.incidencias.length === 0 ? (
          <Vacio>El cliente todavía no trajo ningún tema.</Vacio>
        ) : (
          <div className="space-y-2">
            {d.incidencias.map((i) => {
              const pendiente = !!i.derivadaEn && !i.atendidaEn
              const espera = textoEspera(i.derivadaEn)
              return (
                <div
                  key={i.incidenciaUuid}
                  className={cn(
                    'flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center md:justify-between',
                    pendiente ? 'border-primary/40' : 'border-border bg-muted/30',
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CategoriaBadge categoria={i.categoria} />
                      <EstadoIncidenciaBadge estado={i.estado} />
                      {i.motivoDerivacion && <MotivoDerivacionBadge motivo={i.motivoDerivacion} />}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Abierto {fechaHora(i.abiertaEn)} · {i.intentosBot} intentos del bot
                      {i.insistencias > 0 && ` · ${i.insistencias} insistencias`}
                      {i.derivadaEn && ` · derivado ${fechaHora(i.derivadaEn)}`}
                    </div>
                    {i.motivoDerivacion && (
                      <div className="text-xs text-muted-foreground">
                        {MOTIVO_DERIVACION_LABEL[i.motivoDerivacion]?.ayuda}
                      </div>
                    )}
                    {pendiente && (
                      <div className={cn('text-xs', espera.vencido ? 'font-semibold text-red-600' : 'text-muted-foreground')}>
                        {espera.texto}
                        {i.intentosContacto > 0 && ` · ${i.intentosContacto} intentos de contacto`}
                        {i.agendadaPara && ` · retomar ${fechaHora(i.agendadaPara)}`}
                      </div>
                    )}
                    {i.atendidaEn && (
                      <div className="text-xs text-muted-foreground">
                        Atendido {fechaHora(i.atendidaEn)} ·{' '}
                        <span className="font-medium text-foreground">{label(i.resultado)}</span>
                        {i.asesor && ` · ${i.asesor}`}
                        {i.observaciones && <> — “{i.observaciones}”</>}
                      </div>
                    )}
                  </div>
                  {pendiente && (
                    <CerrarGestionDialog
                      incidenciaUuid={i.incidenciaUuid}
                      categoria={i.categoria}
                      intentosContacto={i.intentosContacto}
                      onDone={onCambio}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Seccion>

      <Seccion titulo="Por qué el score es el que es">
        {d.ledger.length === 0 ? (
          <Vacio>Sin movimientos todavía.</Vacio>
        ) : (
          <ol className="space-y-1.5">
            {d.ledger.map((s) => (
              <li key={s.eventoId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="font-medium">{MOTIVO_SCORE_LABEL[s.motivo] ?? label(s.motivo)}</span>
                  {s.grupo && <span className="text-xs text-muted-foreground">{s.grupo.replace(/_/g, ' ')}</span>}
                </span>
                <span className="flex items-center gap-3 font-mono text-xs">
                  <span className={cn(s.puntos > 0 ? 'text-emerald-700' : s.puntos < 0 ? 'text-red-600' : 'text-muted-foreground')}>
                    {s.puntos > 0 ? '+' : ''}
                    {s.puntos.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">
                    {s.scoreAntes.toFixed(2)} → {s.scoreDespues.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">{fechaHora(s.ocurridoEn)}</span>
                </span>
                {s.nota && <span className="w-full text-xs italic text-muted-foreground">{s.nota}</span>}
              </li>
            ))}
          </ol>
        )}
      </Seccion>

      {d.historialEtapas.length > 1 && (
        <Seccion titulo="Recorrido del cliente">
          <p className="text-xs text-muted-foreground">
            El score no se reinicia: cada etapa arranca donde cerró la anterior.
          </p>
          <ol className="space-y-1.5">
            {d.historialEtapas.map((h) => (
              <li
                key={h.etapaUuid}
                className={cn('flex flex-wrap items-center justify-between gap-2 text-sm', h.esActual && 'font-medium')}
              >
                <span className="flex items-center gap-2">
                  <EtapaBadge etapa={h.etapa} ciclo={h.ciclo} />
                  <EstadoEtapaBadge estado={h.estadoEtapa} />
                  {h.esActual && <span className="text-xs text-primary">actual</span>}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {h.scoreInicio.toFixed(2)} → {h.scoreActual.toFixed(2)} · {fechaCorta(h.ventanaInicio)} a{' '}
                  {fechaCorta(h.ventanaFin)}
                </span>
              </li>
            ))}
          </ol>
        </Seccion>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

export function GestionesBloque({ d, onCambio }: { d: DetalleCliente; onCambio: () => void }) {
  const derivadaPendiente = d.incidencias.find((i) => i.derivadaEn && !i.atendidaEn)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Llamadas, WhatsApp y notas. Registrar una gestión no cambia el estado del tema en el bot.
        </p>
        {d.enCurso && (
          <RegistrarAccionDialog
            etapaUuid={d.etapaUuid}
            incidenciaUuid={derivadaPendiente?.incidenciaUuid ?? null}
            onDone={onCambio}
          />
        )}
      </div>

      {derivadaPendiente && (
        <div className="flex flex-col gap-2 rounded-md border border-primary/40 p-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <CategoriaBadge categoria={derivadaPendiente.categoria} />
              <MotivoDerivacionBadge motivo={derivadaPendiente.motivoDerivacion} />
            </div>
            <p className="text-xs text-muted-foreground">
              Cuando termines, marca el resultado para sacarlo de la bandeja.
            </p>
          </div>
          <CerrarGestionDialog
            incidenciaUuid={derivadaPendiente.incidenciaUuid}
            categoria={derivadaPendiente.categoria}
            intentosContacto={derivadaPendiente.intentosContacto}
            onDone={onCambio}
          />
        </div>
      )}

      {d.acciones.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Todavía no se registraron gestiones.
        </div>
      ) : (
        <ul className="space-y-3">
          {d.acciones.map((a) => (
            <li key={a.id} className="rounded-md border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {TIPOS_ACCION.find((t) => t.value === a.tipo)?.label ?? a.tipo} ·{' '}
                  {RESULTADOS_ACCION.find((r) => r.value === a.resultado)?.label ?? a.resultado}
                </span>
                <span className="text-xs text-muted-foreground">{fechaHora(a.createdAt)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {a.usuario}
                {a.duracionSeg ? ` · ${Math.round(a.duracionSeg / 60)} min` : ''}
              </div>
              {a.observaciones && <p className="mt-1 whitespace-pre-wrap text-foreground/80">{a.observaciones}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
