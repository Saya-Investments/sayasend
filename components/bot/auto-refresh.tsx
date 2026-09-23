'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// Cada cuánto se vuelve a pedir la data cuando la pestaña está a la vista.
const INTERVALO_MS = 20_000

/**
 * Repite `accion` cada `ms`, pero solo mientras la pestaña está visible, y la
 * ejecuta al volver a ella. Así una pantalla abierta toda la tarde no consulta
 * la base de fondo ni se queda con datos viejos al retomarla.
 */
export function usePolling(accion: () => void, ms: number = INTERVALO_MS) {
  const ref = useRef(accion)
  ref.current = accion

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null

    const arrancar = () => {
      if (timer) return
      timer = setInterval(() => ref.current(), ms)
    }
    const parar = () => {
      if (!timer) return
      clearInterval(timer)
      timer = null
    }
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') {
        ref.current()
        arrancar()
      } else {
        parar()
      }
    }

    if (document.visibilityState === 'visible') arrancar()
    document.addEventListener('visibilitychange', alCambiarVisibilidad)
    return () => {
      parar()
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
    }
  }, [ms])
}

/**
 * Mantiene al día una pantalla renderizada en el servidor (listas y tablas).
 * `router.refresh()` vuelve a pedir el server component sin recargar la página,
 * así que no se pierde el scroll ni lo que haya abierto el usuario.
 */
export function AutoRefresh({ segundos = 20 }: { segundos?: number }) {
  const router = useRouter()
  usePolling(() => router.refresh(), segundos * 1000)
  return null
}
