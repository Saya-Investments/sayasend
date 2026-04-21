import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { sendTemplateMessage } from '@/lib/meta-message-service'

export const runtime = 'nodejs'

function normalizePhoneWithPlus(raw: string): string {
  const digits = String(raw || '').replace(/[^0-9]/g, '')
  return digits ? `+${digits}` : ''
}

// POST /api/chat/conversations/[phone]/template
// Body: { templateName, templateLang?, params?: string[] }
// Envía un template aprobado. Funciona siempre (no requiere ventana abierta).
export async function POST(
  request: NextRequest,
  { params: routeParams }: { params: Promise<{ phone: string }> },
) {
  try {
    const { phone: rawPhone } = await routeParams
    const phone = normalizePhoneWithPlus(rawPhone)
    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'phone inválido' },
        { status: 400 },
      )
    }

    const body = (await request.json()) as {
      templateName?: string
      templateLang?: string
      params?: string[]
    }
    const templateName = (body.templateName ?? '').trim()
    if (!templateName) {
      return NextResponse.json(
        { success: false, error: 'templateName es requerido' },
        { status: 400 },
      )
    }
    const bodyParams = Array.isArray(body.params) ? body.params.map(String) : []

    // Resolver idioma: si no vino en el body, consultar la BD
    let templateLang = (body.templateLang ?? '').trim()
    if (!templateLang) {
      const tpl = await prisma.template.findFirst({
        where: { nombre: templateName },
        select: { idioma: true },
      })
      templateLang = tpl?.idioma ?? 'es'
    }

    const { wamid } = await sendTemplateMessage(
      phone,
      templateName,
      templateLang,
      bodyParams,
    )
    if (!wamid) {
      return NextResponse.json(
        { success: false, error: 'Meta no devolvió wamid' },
        { status: 502 },
      )
    }

    const cliente = await prisma.cliente.findFirst({
      where: { telefono: { contains: phone.replace(/[^0-9]/g, '') } },
      select: { id: true },
    })

    // Texto "renderizado" aproximado: sólo guardamos el body con los params
    // sustituidos 1→{{1}}, 2→{{2}}, etc. Útil para mostrar en el thread.
    // Si queremos algo más fiel, hacemos lookup del template.contenido y
    // reemplazamos. Por ahora simple:
    const previewText = bodyParams.length
      ? `[template:${templateName}] ${bodyParams.join(' | ')}`
      : `[template:${templateName}]`

    const created = await prisma.chatMessage.create({
      data: {
        wamid,
        direction: 'outbound',
        phone,
        clienteId: cliente?.id ?? null,
        messageType: 'template',
        textBody: previewText,
        templateName,
        templateParams: bodyParams.length
          ? (bodyParams as unknown as object)
          : undefined,
        status: 'sent',
      },
    })

    return NextResponse.json({
      success: true,
      data: { ...created, id: created.id.toString() },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const httpStatus = (error as { httpStatus?: number }).httpStatus ?? 500
    return NextResponse.json(
      { success: false, error: message },
      { status: httpStatus },
    )
  }
}
