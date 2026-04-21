'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Send, FileText, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

type Template = {
  id: string
  nombre: string
  idioma: string | null
  categoria: string | null
  estadoMeta: string | null
  contenido: string | null
}

function countPlaceholders(text: string | null | undefined): number {
  if (!text) return 0
  const matches = text.match(/\{\{(\d+)\}\}/g) ?? []
  return new Set(matches).size
}

type Props = {
  phone: string
  windowOpen: boolean
  onSent: () => void
}

export function MessageInput({ phone, windowOpen, onSent }: Props) {
  const [mode, setMode] = useState<'text' | 'template'>(
    windowOpen ? 'text' : 'template',
  )

  // Si cambia la conversación y estaba en text pero la ventana está cerrada,
  // forzamos template.
  useEffect(() => {
    if (!windowOpen && mode === 'text') setMode('template')
  }, [windowOpen, mode])

  return (
    <div className="border-t border-border bg-card p-3">
      <div className="flex gap-2 mb-2">
        <Button
          variant={mode === 'text' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('text')}
          disabled={!windowOpen}
          title={!windowOpen ? 'Ventana 24h cerrada' : undefined}
        >
          <MessageSquare className="w-4 h-4 mr-1" />
          Mensaje libre
        </Button>
        <Button
          variant={mode === 'template' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('template')}
        >
          <FileText className="w-4 h-4 mr-1" />
          Template
        </Button>
      </div>

      {mode === 'text' ? (
        <FreeTextInput phone={phone} onSent={onSent} />
      ) : (
        <TemplateInput phone={phone} onSent={onSent} />
      )}
    </div>
  )
}

function FreeTextInput({
  phone,
  onSent,
}: {
  phone: string
  onSent: () => void
}) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (!text.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/chat/conversations/${encodeURIComponent(phone)}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        },
      )
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Error enviando')
      setText('')
      onSent()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-end">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Escribe un mensaje..."
          rows={2}
          className="resize-none"
        />
        <Button onClick={handleSend} disabled={!text.trim() || sending}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

function TemplateInput({
  phone,
  onSent,
}: {
  phone: string
  onSent: () => void
}) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [templateName, setTemplateName] = useState<string>('')
  const [params, setParams] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/templates')
        const json = await res.json()
        if (json.success) {
          const approved = (json.data ?? []).filter(
            (t: Template) => t.estadoMeta === 'APPROVED',
          )
          setTemplates(approved)
        }
      } catch (e) {
        console.error('[chat] load templates:', e)
      }
    })()
  }, [])

  const selected = templates.find((t) => t.nombre === templateName) ?? null
  const paramCount = countPlaceholders(selected?.contenido)

  // Ajusta el tamaño del array de params cuando cambie el template
  useEffect(() => {
    setParams(Array.from({ length: paramCount }, (_, i) => params[i] ?? ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateName, paramCount])

  async function handleSend() {
    if (!selected || sending) return
    if (params.some((p) => !p.trim())) {
      setError('Completa todos los parámetros de la plantilla')
      return
    }
    setSending(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/chat/conversations/${encodeURIComponent(phone)}/template`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateName: selected.nombre,
            templateLang: selected.idioma ?? undefined,
            params,
          }),
        },
      )
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Error enviando')
      setParams(Array.from({ length: paramCount }, () => ''))
      onSent()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-2">
      <Select value={templateName} onValueChange={setTemplateName}>
        <SelectTrigger>
          <SelectValue placeholder="Selecciona una plantilla..." />
        </SelectTrigger>
        <SelectContent>
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.nombre}>
              <span className="font-medium">{t.nombre}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {t.categoria} · {t.idioma}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selected && (
        <>
          {selected.contenido && (
            <div className="text-xs text-muted-foreground border rounded p-2 bg-muted whitespace-pre-wrap">
              {selected.contenido}
            </div>
          )}
          {paramCount > 0 && (
            <div className="space-y-1">
              {Array.from({ length: paramCount }).map((_, i) => (
                <Input
                  key={i}
                  value={params[i] ?? ''}
                  onChange={(e) => {
                    const next = [...params]
                    next[i] = e.target.value
                    setParams(next)
                  }}
                  placeholder={`{{${i + 1}}}`}
                  className={cn('text-sm')}
                />
              ))}
            </div>
          )}
          <Button
            onClick={handleSend}
            disabled={sending || params.some((p) => !p.trim())}
            className="w-full"
          >
            <Send className="w-4 h-4 mr-2" />
            {sending ? 'Enviando...' : 'Enviar template'}
          </Button>
        </>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
