import { NextRequest, NextResponse } from 'next/server'

import { hoyEnColombia, proximaAsamblea } from '@/lib/calendario-colombia'
import { sendPreadmisionEmail } from '@/lib/email'
import { correrBienvenidaPreadmision, type ModoCorrida } from '@/lib/preadmision-bienvenida'
import { excelSorteo, nombreExcelSorteo, type GrupoSorteo } from '@/lib/preadmision-excel'
import { MINIMO_PARA_SORTEAR } from '@/lib/sorteo-retadores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// A diferencia de los otros crons, este manda mensajes: sin CRON_SECRET
// configurado no corre, en vez de quedar abierto.
function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

// Vercel llama sin parámetros (= enviar). A mano: ?modo=simular no escribe nada
// y ?modo=borrador deja la campaña en borrador para revisarla antes de enviar.
function leerModo(request: NextRequest): ModoCorrida | null {
  const modo = request.nextUrl.searchParams.get('modo') ?? 'enviar'
  return modo === 'simular' || modo === 'borrador' || modo === 'enviar' ? modo : null
}

async function adjuntosDelSorteo(campaignId: string | null, campaignNombre: string | null) {
  if (!campaignId || !campaignNombre) return undefined

  const grupos: GrupoSorteo[] = ['RETADOR', 'CONVENCIONAL']
  return Promise.all(
    grupos.map(async (grupo) => ({
      filename: nombreExcelSorteo(campaignNombre, grupo),
      content: (await excelSorteo(campaignId, grupo)).buffer,
    })),
  )
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const modo = leerModo(request)
  if (!modo) {
    return NextResponse.json({ success: false, error: 'modo debe ser simular, borrador o enviar' }, { status: 400 })
  }

  try {
    const result = await correrBienvenidaPreadmision(modo)

    if (modo !== 'simular') {
      await adjuntosDelSorteo(result.campaignId, result.campaignNombre)
        .then((adjuntos) =>
          sendPreadmisionEmail({
            hoy: result.hoy,
            asamblea: result.asamblea,
            estado: result.estado,
            pendientes: result.pendientes,
            minimo: MINIMO_PARA_SORTEAR,
            retadores: result.retadores,
            convencional: result.convencional,
            excluidos: result.excluidos,
            campaignNombre: result.campaignNombre,
            adjuntos,
          }),
        )
        .catch((error) => console.error('[PreadmisionBienvenida] No se pudo enviar el correo:', error))
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (modo !== 'simular') {
      const hoy = hoyEnColombia()
      await sendPreadmisionEmail({
        hoy,
        asamblea: proximaAsamblea(hoy),
        estado: 'error',
        pendientes: 0,
        minimo: MINIMO_PARA_SORTEAR,
        retadores: [],
        convencional: [],
        excluidos: [],
        campaignNombre: null,
        error: message,
      }).catch((mailError) => console.error('[PreadmisionBienvenida] No se pudo enviar el correo:', mailError))
    }

    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
