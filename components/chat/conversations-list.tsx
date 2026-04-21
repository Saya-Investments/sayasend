'use client'

import { cn } from '@/lib/utils'
import { MessageCircle } from 'lucide-react'

export type Conversation = {
  phone: string
  last_message_at: string
  last_direction: 'inbound' | 'outbound'
  last_text: string | null
  last_type: string | null
  cliente_id: string | null
  cliente_nombre: string | null
  last_inbound_at: string | null
  window_open: boolean
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diffMs / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}

type Props = {
  conversations: Conversation[]
  selectedPhone: string | null
  onSelect: (phone: string) => void
  loading: boolean
}

export function ConversationsList({
  conversations,
  selectedPhone,
  onSelect,
  loading,
}: Props) {
  return (
    <div className="w-80 border-r border-border bg-card flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-lg">Conversaciones</h2>
        <p className="text-xs text-muted-foreground">
          {conversations.length} contactos
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">Cargando...</div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            No hay conversaciones todavía.
          </div>
        ) : (
          conversations.map((c) => {
            const active = c.phone === selectedPhone
            const title = c.cliente_nombre || c.phone
            const preview =
              c.last_type === 'template'
                ? '📨 Plantilla enviada'
                : c.last_text || '(sin texto)'
            return (
              <button
                key={c.phone}
                onClick={() => onSelect(c.phone)}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-border hover:bg-muted transition-colors',
                  active && 'bg-muted',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageCircle
                      className={cn(
                        'w-4 h-4 shrink-0',
                        c.window_open ? 'text-green-600' : 'text-muted-foreground',
                      )}
                    />
                    <span className="font-medium truncate">{title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatRelative(c.last_message_at)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-1 pl-6">
                  {c.last_direction === 'outbound' ? 'Tú: ' : ''}
                  {preview}
                </p>
                {c.cliente_nombre && (
                  <p className="text-[11px] text-muted-foreground pl-6">
                    {c.phone}
                  </p>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
