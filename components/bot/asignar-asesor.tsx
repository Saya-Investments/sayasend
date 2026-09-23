'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Props = {
  etapaUuid: string
  asesorId: string | null
  asesores: Array<{ id: string; nombre: string }>
}

// Solo admin: elige qué asesor atiende al cliente. La asignación es por etapa,
// y con ella el asesor ve al cliente y todas sus tareas.
export function AsignarAsesor({ etapaUuid, asesorId, asesores }: Props) {
  const router = useRouter()
  const [guardando, setGuardando] = useState(false)

  async function asignar(idAsesor: string) {
    setGuardando(true)
    try {
      const res = await fetch(`/api/bot/clientes/${etapaUuid}/asignar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idAsesor }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success('Asesor asignado')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo asignar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Select value={asesorId ?? undefined} onValueChange={asignar} disabled={guardando}>
      <SelectTrigger className={asesorId ? 'w-40' : 'w-40 border-amber-400 bg-amber-50'}>
        <SelectValue placeholder="Asignar" />
      </SelectTrigger>
      <SelectContent>
        {asesores.length === 0 && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">Crea asesores en Usuarios</div>
        )}
        {asesores.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
