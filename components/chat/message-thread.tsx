'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'
import { Check, CheckCheck, AlertTriangle, Clock } from 'lucide-react'

import type { Conversation } from './conversations-list'
import { MessageInput } from './message-input'

const POLL_MS = 5000

type ChatMessage = {
  id: string
  wamid: string | null
  direction: 'inbound' | 'outbound'
  phone: string
  messageType: string | null
  textBody: string | null
  templateName: string | null
  createdAt: string
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | null
}

function StatusIcon({ status }: { status: ChatMessage['status'] }) {
  if (status === 'failed')
    return <AlertTriangle className="w-3 h-3 text-red-500" />
  if (status === 'read')
    return <CheckCheck className="w-3 h-3 text-blue-500" />
  if (status === 'delivered')
    return <CheckCheck className="w-3 h-3 text-muted-foreground" />
  if (status === 'sent')
    return <Check className="w-3 h-3 text-muted-foreground" />
  return <Clock className="w-3 h-3 text-muted-foreground" />
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Props = {
  conversation: Conversation | null
  onMessageSent: () => void
}

export function MessageThread({ conversation, onMessageSent }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const phone = conversation?.phone ?? null

  const fetchMessages = useCallback(async () => {
    if (!phone) return
    try {
      const res = await fetch(
        `/api/chat/conversations/${encodeURIComponent(phone)}/messages`,
        { cache: 'no-store' },
      )
      const json = await res.json()
      if (json.success) setMessages(json.data ?? [])
    } catch (e) {
      console.error('[chat] fetchMessages:', e)
    } finally {
      setLoading(false)
    }
  }, [phone])

  useEffect(() => {
    if (!phone) {
      setMessages([])
      return
    }
    setLoading(true)
    fetchMessages()
    const id = setInterval(fetchMessages, POLL_MS)
    return () => clearInterval(id)
  }, [phone, fetchMessages])

  // Scroll al fondo cuando llegan nuevos mensajes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Selecciona una conversación
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-3 bg-card">
        <h3 className="font-semibold">
          {conversation.cliente_nombre || conversation.phone}
        </h3>
        <p className="text-xs text-muted-foreground">
          {conversation.phone}
          {' · '}
          {conversation.window_open ? (
            <span className="text-green-600">Ventana abierta (24h)</span>
          ) : (
            <span className="text-amber-600">
              Ventana cerrada — solo templates
            </span>
          )}
        </p>
      </div>

      {/* Thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading && messages.length === 0 ? (
          <div className="text-sm text-muted-foreground">Cargando...</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Aún no hay mensajes en esta conversación.
          </div>
        ) : (
          messages.map((m) => {
            const isOut = m.direction === 'outbound'
            const isTemplate = m.messageType === 'template'
            return (
              <div
                key={m.id}
                className={cn(
                  'flex',
                  isOut ? 'justify-end' : 'justify-start',
                )}
              >
                <div
                  className={cn(
                    'max-w-[70%] rounded-lg px-3 py-2 text-sm',
                    isOut
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground',
                  )}
                >
                  {isTemplate && (
                    <div className="text-xs opacity-70 mb-1">
                      📨 Template: {m.templateName}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words">
                    {m.textBody || '(sin texto)'}
                  </div>
                  <div
                    className={cn(
                      'flex items-center gap-1 justify-end mt-1 text-[10px]',
                      isOut ? 'text-primary-foreground/70' : 'text-muted-foreground',
                    )}
                  >
                    <span>{formatTime(m.createdAt)}</span>
                    {isOut && <StatusIcon status={m.status} />}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Input */}
      <MessageInput
        phone={conversation.phone}
        windowOpen={conversation.window_open}
        onSent={() => {
          fetchMessages()
          onMessageSent()
        }}
      />
    </div>
  )
}
