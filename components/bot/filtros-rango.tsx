'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays, FilterX, SlidersHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const TODOS = '__todos__'

export type OpcionSelect = { value: string; label: string }

type Props = {
  // Selects extra (asesor, etapa…) además del rango de fechas.
  selects?: Array<{ nombre: string; etiqueta: string; placeholder: string; opciones: OpcionSelect[] }>
}

// Filtros que viven en la URL: los lee la página (server component).
export function FiltrosRango({ selects = [] }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const desde = params.get('desde') ?? ''
  const hasta = params.get('hasta') ?? ''

  function set(nombre: string, valor: string | null) {
    const next = new URLSearchParams(params.toString())
    if (valor) next.set(nombre, valor)
    else next.delete(nombre)
    router.replace(`${pathname}?${next.toString()}`)
  }

  const activos: string[] = []
  if (desde) activos.push(`Desde: ${desde}`)
  if (hasta) activos.push(`Hasta: ${hasta}`)
  for (const s of selects) {
    const v = params.get(s.nombre)
    if (v) activos.push(`${s.etiqueta}: ${s.opciones.find((o) => o.value === v)?.label ?? v}`)
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        Filtros
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-44">
          <Label htmlFor="f-desde" className="mb-1.5 block text-xs text-muted-foreground">
            Desde
          </Label>
          <Input
            id="f-desde"
            type="date"
            value={desde}
            max={hasta || undefined}
            onChange={(e) => set('desde', e.target.value || null)}
          />
        </div>
        <div className="w-44">
          <Label htmlFor="f-hasta" className="mb-1.5 block text-xs text-muted-foreground">
            Hasta
          </Label>
          <Input
            id="f-hasta"
            type="date"
            value={hasta}
            min={desde || undefined}
            onChange={(e) => set('hasta', e.target.value || null)}
          />
        </div>

        {selects.map((s) => (
          <div key={s.nombre} className="w-52">
            <Label className="mb-1.5 block text-xs text-muted-foreground">{s.etiqueta}</Label>
            <Select
              value={params.get(s.nombre) ?? TODOS}
              onValueChange={(v) => set(s.nombre, v === TODOS ? null : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>{s.placeholder}</SelectItem>
                {s.opciones.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}

        {activos.length > 0 && (
          <Button variant="outline" onClick={() => router.replace(pathname)} className="mb-0.5">
            <FilterX className="mr-1 h-4 w-4" />
            Limpiar filtros
          </Button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" />
        {activos.length === 0 ? (
          <span>Sin filtros: se muestra todo el histórico.</span>
        ) : (
          activos.map((a) => (
            <span key={a} className="rounded-full border border-border bg-muted px-2 py-0.5 font-medium text-foreground">
              {a}
            </span>
          ))
        )}
      </div>
    </div>
  )
}
