'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Bot, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { MensajeBot } from '@/lib/bot/queries'
import { fechaHora } from './formato'

const POLL_MS = 5000

const ORIGEN_LABEL: Record<string, string> = { BOT: 'Bot', CRM: 'Asesor', CAMPANA: 'Campaña' }

export function FichaChat({ etapaUuid }: { etapaUuid: string }) {
  const [mensajes, setMensajes] = useState<MensajeBot[]>([])
  const [ventanaAbierta, setVentanaAbierta] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/bot/clientes/${etapaUuid}/mensajes`, { cache: 'no-store' })
      const json = await res.json()
      if (json.success) {
        setMensajes(json.data.mensajes)
        setVentanaAbierta(json.data.ventanaAbierta)
      }
    } finally {
      setCargando(false)
    }
  }, [etapaUuid])

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, POLL_MS)
    return () => clearInterval(t)
  }, [cargar])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [mensajes.length])

  async function enviar() {
    const body = texto.trim()
    if (!body) return
    setEnviando(true)
    try {
      const res = await fetch(`/api/bot/clientes/${etapaUuid}/mensajes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setTexto('')
      await cargar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo enviar')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex h-[560px] flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-muted/40 p-4">
        {cargando && <p className="text-center text-sm text-muted-foreground">Cargando conversación…</p>}
        {!cargando && mensajes.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">Todavía no hay mensajes con este cliente.</p>
        )}
        {mensajes.map((m) => {
          const saliente = m.direction === 'outbound'
          const cuerpo =
            m.textBody || (m.templateName ? `[Plantilla: ${m.templateName}]` : `[${m.messageType ?? 'mensaje'}]`)
          return (
            <div key={m.id} className={cn('flex', saliente ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm',
                  saliente
                    ? m.origen === 'BOT'
                      ? 'bg-secondary text-secondary-foreground'
                      : 'bg-primary text-primary-foreground'
                    : 'bg-card text-card-foreground',
                )}
              >
                {saliente && m.origen && (
                  <div className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase opacity-70">
                    {m.origen === 'BOT' && <Bot className="h-3 w-3" />}
                    {ORIGEN_LABEL[m.origen] ?? m.origen}
                  </div>
                )}
                <p className="whitespace-pre-wrap break-words">{cuerpo}</p>
                {/* Qué entendió el bot de este mensaje del cliente. */}
                {!saliente && m.categoria && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="rounded-full border border-border px-1.5 py-0.5">
                      {m.categoria.replace(/_/g, ' ')}
                      {m.confianza !== null && ` · ${Math.round(m.confianza * 100)}%`}
                    </span>
                    {m.requiereRevision && <span className="font-semibold text-amber-700">revisar</span>}
                  </div>
                )}
                <div className="mt-1 text-right text-[10px] opacity-60">
                  {fechaHora(m.createdAt)}
                  {m.status === 'failed' && ' · falló'}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="border-t border-border p-3">
        {ventanaAbierta ? (
          <div className="flex gap-2">
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  enviar()
                }
              }}
              placeholder="Escribe al cliente…"
              rows={2}
              className="resize-none"
            />
            <Button onClick={enviar} disabled={enviando || !texto.trim()} className="self-end">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            La ventana de 24 h está cerrada: solo se puede escribir si el cliente envió un mensaje en las últimas 24
            horas. Mientras tanto, llámalo y registra la gestión.
          </p>
        )}
      </div>
    </div>
  )
}
