'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, ClipboardPlus, PauseCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  MAX_NO_CONTESTO,
  RESULTADOS_ACCION,
  RESULTADOS_NO_CIERRAN,
  RESULTADOS_PELIGROSOS,
  TIPOS_ACCION,
} from '@/lib/bot/constants'
import type { ResultadoBot } from '@/lib/bot/bot-api'

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({ success: false, error: `Error ${res.status}` }))
  if (!json.success) throw new Error(json.error ?? 'Ocurrió un error')
  return json
}

function etiqueta(r: ResultadoBot) {
  return r.etiqueta ?? r.label ?? r.clave
}

// ---------------------------------------------------------------------------

type CerrarProps = {
  incidenciaUuid: string
  categoria: string
  intentosContacto: number
  onDone?: () => void
}

// Marca el resultado de una incidencia derivada. Los resultados los define el
// bot (GET /bot/resultados): el CRM no los hardcodea.
export function CerrarGestionDialog({ incidenciaUuid, categoria, intentosContacto, onDone }: CerrarProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [resultados, setResultados] = useState<ResultadoBot[] | null>(null)
  const [errorCarga, setErrorCarga] = useState('')
  const [clave, setClave] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [agendadaPara, setAgendadaPara] = useState('')
  const [confirmado, setConfirmado] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open || resultados) return
    fetch('/api/bot/resultados')
      .then((r) => r.json())
      .then((json) => (json.success ? setResultados(json.data) : setErrorCarga(json.error)))
      .catch(() => setErrorCarga('No se pudo consultar los resultados al bot'))
  }, [open, resultados])

  const elegido = resultados?.find((r) => r.clave === clave)
  const exigeFecha = clave === 'SEGUIMIENTO' || elegido?.requiere_fecha
  const peligroso = RESULTADOS_PELIGROSOS.has(clave)
  const restantes = MAX_NO_CONTESTO - intentosContacto

  async function guardar() {
    setGuardando(true)
    try {
      await postJson(`/api/bot/incidencias/${incidenciaUuid}/cerrar`, {
        resultado: clave,
        observaciones,
        agendadaPara: agendadaPara ? new Date(agendadaPara).toISOString() : undefined,
      })
      toast.success('Gestión registrada en el bot')
      setOpen(false)
      setClave('')
      setObservaciones('')
      setAgendadaPara('')
      setConfirmado(false)
      onDone?.()
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo registrar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <CheckCircle2 className="mr-1 h-4 w-4" />
          Marcar resultado
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Resultado de la gestión</DialogTitle>
          <DialogDescription>
            Tema: {categoria.replace(/_/g, ' ')}. &quot;Resuelta&quot; es sobre la necesidad del cliente, no sobre la
            llamada. El score no sube: mide lo que logró el bot por sí solo.
          </DialogDescription>
        </DialogHeader>

        {errorCarga && <p className="text-sm text-destructive">{errorCarga}</p>}
        {!resultados && !errorCarga && <p className="text-sm text-muted-foreground">Consultando al bot…</p>}

        {resultados && (
          <div className="grid gap-2">
            {resultados.map((r) => (
              <button
                key={r.clave}
                type="button"
                onClick={() => {
                  setClave(r.clave)
                  setConfirmado(false)
                }}
                className={cn(
                  'rounded-md border px-3 py-2 text-left transition-colors',
                  clave === r.clave ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted',
                  RESULTADOS_PELIGROSOS.has(r.clave) && clave === r.clave && 'border-red-500 bg-red-50',
                )}
              >
                <div className="text-sm font-medium">{etiqueta(r)}</div>
                {(r.ayuda || r.descripcion || r.efecto) && (
                  <div className="text-xs text-muted-foreground">{r.ayuda ?? r.descripcion ?? r.efecto}</div>
                )}
              </button>
            ))}
          </div>
        )}

        {RESULTADOS_NO_CIERRAN.has(clave) && (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            El tema sigue en tu bandeja.
            {clave === 'NO_CONTESTO' &&
              ` Llevas ${intentosContacto} intento(s) de contacto: al llegar a ${MAX_NO_CONTESTO} se cierra solo como abandonado` +
                (restantes > 0 ? ` (te quedan ${restantes}).` : '.')}
          </p>
        )}

        {exigeFecha && (
          <div className="space-y-1.5">
            <Label htmlFor="agendada">¿Cuándo lo retomas?</Label>
            <Input
              id="agendada"
              type="datetime-local"
              value={agendadaPara}
              onChange={(e) => setAgendadaPara(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Hasta esa fecha el tema no aparece en la bandeja.</p>
          </div>
        )}

        {peligroso && (
          <label className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              {clave === 'RETIRO'
                ? 'Confirmo el retiro: se cierra la etapa del cliente.'
                : 'Confirmo que el número está equivocado: el cliente sale del bot (opt-out).'}
            </span>
          </label>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="obs-gestion">Observaciones</Label>
          <Textarea
            id="obs-gestion"
            rows={3}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Qué hablaste con el cliente y cómo quedó"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={guardar}
            disabled={!clave || guardando || (exigeFecha && !agendadaPara) || (peligroso && !confirmado)}
          >
            {guardando ? 'Guardando…' : 'Guardar resultado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------

export function RegistrarAccionDialog({
  etapaUuid,
  incidenciaUuid,
  onDone,
}: {
  etapaUuid: string
  incidenciaUuid: string | null
  onDone?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [tipo, setTipo] = useState('LLAMADA')
  const [resultado, setResultado] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [minutos, setMinutos] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setGuardando(true)
    try {
      await postJson(`/api/bot/clientes/${etapaUuid}/acciones`, {
        tipo,
        resultado,
        observaciones,
        duracionSeg: tipo === 'LLAMADA' && minutos ? Number(minutos) * 60 : null,
        incidenciaUuid,
      })
      toast.success('Gestión registrada')
      setOpen(false)
      setTipo('LLAMADA')
      setResultado('')
      setObservaciones('')
      setMinutos('')
      onDone?.()
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo registrar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ClipboardPlus className="mr-1 h-4 w-4" />
          Registrar gestión
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar gestión</DialogTitle>
          <DialogDescription>
            Queda en el historial del CRM y no le avisa al bot. Para cerrar el tema en el bot usa &quot;Marcar
            resultado&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_ACCION.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Resultado</Label>
            <Select value={resultado} onValueChange={setResultado}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elegir" />
              </SelectTrigger>
              <SelectContent>
                {RESULTADOS_ACCION.map((r) => (
                  <SelectItem key={r.value} value={r.value} title={r.ayuda}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {tipo === 'LLAMADA' && (
          <div className="space-y-1.5">
            <Label htmlFor="minutos">Duración (minutos)</Label>
            <Input id="minutos" type="number" min={0} value={minutos} onChange={(e) => setMinutos(e.target.value)} />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="obs">Observaciones</Label>
          <Textarea id="obs" rows={3} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!resultado || guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------

// Tomar la conversación: el bot se calla mientras el asesor atiende.
export function PausarBotButton({ etapaUuid, onDone }: { etapaUuid: string; onDone?: () => void }) {
  const router = useRouter()
  const [guardando, setGuardando] = useState(false)

  async function pausar() {
    setGuardando(true)
    try {
      await postJson(`/api/bot/clientes/${etapaUuid}/pausa`, { horas: 24 })
      toast.success('El bot no le escribirá por 24 horas')
      onDone?.()
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo pausar el bot')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={pausar} disabled={guardando}>
      <PauseCircle className="mr-1 h-4 w-4" />
      Tomar la conversación (24 h)
    </Button>
  )
}
