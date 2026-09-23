'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ETAPA_LABEL, OTRO_TIPO, RANGOS_SCORE, TIPOS_TAREA } from '@/lib/bot/constants'

const TODOS = '__todos__'

const RANGOS = [
  { value: 'riesgo', label: `En riesgo (0–29)` },
  { value: 'inconforme', label: 'Inconforme (30–49)' },
  { value: 'neutro', label: 'Neutro (50–69)' },
  { value: 'conforme', label: 'Conforme (70–100)' },
] satisfies Array<{ value: string; label: string }>

type Props = {
  // Solo admin: filtrar por asesor.
  asesores?: Array<{ id: string; nombre: string }>
}

// Los filtros viven en la URL para que la lista (server component) los lea.
export function FiltrosClientes({ asesores }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')

  function set(nombre: string, valor: string | null) {
    const next = new URLSearchParams(params.toString())
    if (valor) next.set(nombre, valor)
    else next.delete(nombre)
    router.replace(`${pathname}?${next.toString()}`)
  }

  // Búsqueda con un pequeño retardo para no navegar en cada tecla.
  useEffect(() => {
    const actual = params.get('q') ?? ''
    if (q === actual) return
    const t = setTimeout(() => set('q', q.trim() || null), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4">
      <div className="min-w-56 flex-1">
        <Label className="mb-1.5 block text-xs text-muted-foreground">Buscar</Label>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, teléfono o contrato" />
      </div>

      <div className="w-52">
        <Label className="mb-1.5 block text-xs text-muted-foreground">Score</Label>
        <Select value={params.get('score') ?? TODOS} onValueChange={(v) => set('score', v === TODOS ? null : v)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos</SelectItem>
            {RANGOS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-48">
        <Label className="mb-1.5 block text-xs text-muted-foreground">Tarea pendiente</Label>
        <Select value={params.get('tipo') ?? TODOS} onValueChange={(v) => set('tipo', v === TODOS ? null : v)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas</SelectItem>
            {[...TIPOS_TAREA, OTRO_TIPO].map((t) => (
              <SelectItem key={t.tipo} value={t.tipo}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-44">
        <Label className="mb-1.5 block text-xs text-muted-foreground">Etapa</Label>
        <Select value={params.get('etapa') ?? TODOS} onValueChange={(v) => set('etapa', v === TODOS ? null : v)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas</SelectItem>
            {Object.entries(ETAPA_LABEL).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {asesores && (
        <div className="w-48">
          <Label className="mb-1.5 block text-xs text-muted-foreground">Asesor</Label>
          <Select value={params.get('asesor') ?? TODOS} onValueChange={(v) => set('asesor', v === TODOS ? null : v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              <SelectItem value="sin">Sin asignar</SelectItem>
              {asesores.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center gap-2 pb-2">
        <Switch id="f-retiro" checked={params.get('retiro') === '1'} onCheckedChange={(v) => set('retiro', v ? '1' : null)} />
        <Label htmlFor="f-retiro">Solo retiros</Label>
      </div>
      <div className="flex items-center gap-2 pb-2">
        <Switch
          id="f-der"
          checked={params.get('derivadas') === '1'}
          onCheckedChange={(v) => set('derivadas', v ? '1' : null)}
        />
        <Label htmlFor="f-der">Con tema derivado</Label>
      </div>
      <p className="w-full text-xs text-muted-foreground">
        El score mide lo que logró el bot por sí solo: {RANGOS_SCORE[0].min}–{RANGOS_SCORE[0].max} en riesgo,{' '}
        {RANGOS_SCORE[3].min}–{RANGOS_SCORE[3].max} conforme. Una gestión del asesor no lo sube.
      </p>
    </div>
  )
}
