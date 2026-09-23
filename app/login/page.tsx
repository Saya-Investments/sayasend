'use client'

import { Suspense, useState } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Modo = 'login' | 'setup'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [modo, setModo] = useState<Modo>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function entrar(redirectTo: string) {
    const next = searchParams.get('next')
    // Solo rutas internas: evita redirecciones abiertas a otros dominios.
    const destino = next && next.startsWith('/') && !next.startsWith('//') ? next : redirectTo
    router.replace(destino)
    router.refresh()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (modo === 'setup' && password !== confirmacion) {
      setError('Las contraseñas no coinciden')
      return
    }

    setCargando(true)
    try {
      const res = await fetch(modo === 'login' ? '/api/auth/login' : '/api/auth/setup-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error ?? 'Ocurrió un error al iniciar sesión')
        return
      }
      if (json.data?.setupRequired) {
        setModo('setup')
        setPassword('')
        setConfirmacion('')
        return
      }
      await entrar(json.data.redirectTo)
    } catch {
      setError('Ocurrió un error al iniciar sesión')
    } finally {
      setCargando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl border border-border bg-card p-10 shadow-lg">
      <div className="mb-6 flex items-center justify-center gap-3">
        <Image src="/logo-saya.png" alt="SAYA" width={48} height={48} priority />
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-primary">SAYASEND</span>
          <span className="text-xs text-muted-foreground">Campaign Manager</span>
        </div>
      </div>

      <h2 className="mb-2 text-center text-2xl font-bold text-foreground">
        {modo === 'login' ? 'Bienvenido de nuevo' : 'Crea tu contraseña'}
      </h2>
      <p className="mb-6 text-center text-sm text-muted-foreground">
        {modo === 'login'
          ? 'Inicia sesión para acceder a la plataforma'
          : 'Es tu primer ingreso: define la contraseña con la que vas a entrar'}
      </p>

      {error && <p className="mb-4 text-center text-sm font-semibold text-destructive">{error}</p>}

      <div className="mb-5">
        <Label htmlFor="email" className="mb-1.5 block">
          Usuario
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="tu.correo@sayainvestments.co"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          readOnly={modo === 'setup'}
          required
        />
      </div>

      <div className={modo === 'setup' ? 'mb-5' : 'mb-6'}>
        <Label htmlFor="password" className="mb-1.5 block">
          {modo === 'login' ? 'Contraseña' : 'Nueva contraseña'}
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
          placeholder="••••••••"
          minLength={modo === 'setup' ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {modo === 'setup' && (
        <div className="mb-6">
          <Label htmlFor="confirmacion" className="mb-1.5 block">
            Confirma la contraseña
          </Label>
          <Input
            id="confirmacion"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            required
            />
          <p className="mt-1 text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
        </div>
      )}

      <Button type="submit" disabled={cargando} className="w-full">
        {cargando ? 'Ingresando…' : modo === 'login' ? 'Iniciar sesión' : 'Guardar e ingresar'}
      </Button>

      {modo === 'setup' && (
        <Button
          type="button"
          variant="link"
          onClick={() => {
            setModo('login')
            setError('')
          }}
          className="mt-2 w-full"
        >
          Volver
        </Button>
      )}
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  )
}
