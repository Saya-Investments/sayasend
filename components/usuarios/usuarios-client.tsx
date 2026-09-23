'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { KeyRound, UserPlus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
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
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { UsuarioCrm } from '@/lib/auth/usuarios'

async function enviar(url: string, method: 'POST' | 'PATCH', body: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'Ocurrió un error')
  return json
}

function fecha(iso: string | null) {
  if (!iso) return 'Nunca'
  return new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' })
}

export function UsuariosClient({ usuarios, miId }: { usuarios: UsuarioCrm[]; miId: string }) {
  const router = useRouter()

  async function actualizar(id: string, body: Record<string, unknown>, ok: string) {
    try {
      await enviar(`/api/usuarios/${id}`, 'PATCH', body)
      toast.success(ok)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <NuevoUsuarioDialog onCreado={() => router.refresh()} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Último ingreso</TableHead>
              <TableHead>Activo</TableHead>
              <TableHead className="text-right">Contraseña</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((u) => {
              const yo = u.id === miId
              return (
                <TableRow key={u.id} className={u.activo ? '' : 'opacity-60'}>
                  <TableCell className="font-medium">
                    {u.nombre}
                    {yo && <span className="ml-2 text-xs text-muted-foreground">(tú)</span>}
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Select
                      value={u.rol}
                      disabled={yo}
                      onValueChange={(rol) => actualizar(u.id, { rol }, 'Rol actualizado')}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asesor">Asesor</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm">{fecha(u.ultimoLogin)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={u.activo}
                      disabled={yo}
                      onCheckedChange={(activo) =>
                        actualizar(u.id, { activo }, activo ? 'Usuario activado' : 'Usuario desactivado')
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {u.pendienteContrasena ? (
                      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                        Pendiente de primer ingreso
                      </Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`¿Resetear la contraseña de ${u.nombre}? Tendrá que crear una nueva al entrar.`)) {
                            actualizar(u.id, { resetPassword: true }, 'Contraseña reseteada')
                          }
                        }}
                      >
                        <KeyRound className="mr-1 h-4 w-4" />
                        Resetear
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function NuevoUsuarioDialog({ onCreado }: { onCreado: () => void }) {
  const [open, setOpen] = useState(false)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState('asesor')
  const [guardando, setGuardando] = useState(false)

  async function crear() {
    setGuardando(true)
    try {
      await enviar('/api/usuarios', 'POST', { nombre, email, rol })
      toast.success('Usuario creado: ya puede entrar con su correo y definir su contraseña')
      setOpen(false)
      setNombre('')
      setEmail('')
      setRol('asesor')
      onCreado()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-1 h-4 w-4" />
          Nuevo usuario
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
          <DialogDescription>
            En su primer ingreso el usuario escribe su correo y define la contraseña.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="u-nombre">Nombre</Label>
            <Input id="u-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-email">Correo</Label>
            <Input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <Select value={rol} onValueChange={setRol}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asesor">Asesor — solo ve los clientes que le asignan</SelectItem>
                <SelectItem value="admin">Admin — ve todo el CRM</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={crear} disabled={guardando || !nombre.trim() || !email.trim()}>
            {guardando ? 'Creando…' : 'Crear usuario'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
