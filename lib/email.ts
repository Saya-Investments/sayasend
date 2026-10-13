import nodemailer from 'nodemailer'

const NOTIFICATION_RECIPIENTS = [
  'gabriela@sayainvestments.co',
  'david@sayainvestments.co',
  'daniel.castillo@sayainvestments.co',
  'yomira@sayainvestments.co',
]

function getTransporter() {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD

  if (!user || !pass) {
    throw new Error('Configura GMAIL_USER y GMAIL_APP_PASSWORD en las variables de entorno.')
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })
}

export type CampaignNotificationData = {
  campaignId: string
  campaignName: string
  totalContacts: number
  sent: number
  delivered: number
  read: number
  failed: number
  deliveryRate: number
  readRate: number
  failureRate: number
  finishedAt: Date
}

export async function sendCampaignCompletionEmail(data: CampaignNotificationData) {
  const transporter = getTransporter()
  const from = process.env.GMAIL_USER

  const fecha = data.finishedAt.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'long',
    timeStyle: 'short',
  })

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: #0f172a; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px;">Campaña completada</h1>
        <p style="color: #94a3b8; margin: 4px 0 0; font-size: 14px;">${fecha}</p>
      </div>

      <div style="border: 1px solid #e2e8f0; border-top: none; padding: 32px; border-radius: 0 0 8px 8px;">
        <h2 style="margin: 0 0 24px; font-size: 22px; color: #0f172a;">${data.campaignName}</h2>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="padding: 12px 16px; background: #f8fafc; border-radius: 6px; width: 50%;">
              <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Total contactos</div>
              <div style="font-size: 28px; font-weight: 700; color: #0f172a;">${data.totalContacts.toLocaleString('es-CO')}</div>
            </td>
            <td style="width: 4px;"></td>
            <td style="padding: 12px 16px; background: #f0fdf4; border-radius: 6px; width: 50%;">
              <div style="font-size: 12px; color: #16a34a; text-transform: uppercase; letter-spacing: 0.05em;">Enviados</div>
              <div style="font-size: 28px; font-weight: 700; color: #15803d;">${data.sent.toLocaleString('es-CO')}</div>
            </td>
          </tr>
        </table>

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px 16px; background: #eff6ff; border-radius: 6px; width: 32%;">
              <div style="font-size: 11px; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.05em;">Entregados</div>
              <div style="font-size: 22px; font-weight: 700; color: #1d4ed8;">${data.delivered.toLocaleString('es-CO')}</div>
              <div style="font-size: 13px; color: #3b82f6;">${data.deliveryRate.toFixed(1)}%</div>
            </td>
            <td style="width: 4px;"></td>
            <td style="padding: 10px 16px; background: #faf5ff; border-radius: 6px; width: 32%;">
              <div style="font-size: 11px; color: #9333ea; text-transform: uppercase; letter-spacing: 0.05em;">Leídos</div>
              <div style="font-size: 22px; font-weight: 700; color: #7e22ce;">${data.read.toLocaleString('es-CO')}</div>
              <div style="font-size: 13px; color: #9333ea;">${data.readRate.toFixed(1)}%</div>
            </td>
            <td style="width: 4px;"></td>
            <td style="padding: 10px 16px; background: #fff1f2; border-radius: 6px; width: 32%;">
              <div style="font-size: 11px; color: #e11d48; text-transform: uppercase; letter-spacing: 0.05em;">Fallidos</div>
              <div style="font-size: 22px; font-weight: 700; color: #be123c;">${data.failed.toLocaleString('es-CO')}</div>
              <div style="font-size: 13px; color: #e11d48;">${data.failureRate.toFixed(1)}%</div>
            </td>
          </tr>
        </table>

        <p style="margin: 24px 0 0; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          Sayasend · Motor de Envíos
        </p>
      </div>
    </div>
  `

  await transporter.sendMail({
    from: `"Sayasend" <${from}>`,
    to: NOTIFICATION_RECIPIENTS.join(', '),
    subject: `✅ Campaña completada: ${data.campaignName}`,
    html,
  })
}

export type CampaignFailureData = {
  campaignId: string
  campaignName: string
  reason: string
  failedAt: Date
}

export async function sendCampaignFailedEmail(data: CampaignFailureData) {
  const transporter = getTransporter()
  const from = process.env.GMAIL_USER

  const fecha = data.failedAt.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'long',
    timeStyle: 'short',
  })

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: #7f1d1d; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px;">Campaña fallida</h1>
        <p style="color: #fecaca; margin: 4px 0 0; font-size: 14px;">${fecha}</p>
      </div>

      <div style="border: 1px solid #e2e8f0; border-top: none; padding: 32px; border-radius: 0 0 8px 8px;">
        <h2 style="margin: 0 0 16px; font-size: 22px; color: #0f172a;">${data.campaignName}</h2>

        <div style="padding: 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px;">
          <div style="font-size: 12px; color: #b91c1c; text-transform: uppercase; letter-spacing: 0.05em;">Motivo</div>
          <div style="font-size: 15px; color: #7f1d1d; margin-top: 4px;">${data.reason}</div>
        </div>

        <p style="margin: 24px 0 0; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          Sayasend · Motor de Envíos
        </p>
      </div>
    </div>
  `

  await transporter.sendMail({
    from: `"Sayasend" <${from}>`,
    to: NOTIFICATION_RECIPIENTS.join(', '),
    subject: `⚠️ Campaña fallida: ${data.campaignName}`,
    html,
  })
}

// Resumen diario de la bienvenida de Pre-admisión (Bot Educador).
const PREADMISION_RECIPIENTS = ['yomira@sayainvestments.co']

export type PreadmisionEmailData = {
  hoy: string
  asamblea: string
  estado: 'esperando' | 'sorteado' | 'error'
  pendientes: number
  minimo: number
  retadores: Array<{ dni: string; nombre: string }>
  convencional: Array<{ dni: string; nombre: string }>
  excluidos: Array<{ dni: string; nombre: string; motivo: string }>
  campaignNombre: string | null
  error?: string
  // Excel de retadores y de convencional, cuando hubo sorteo.
  adjuntos?: Array<{ filename: string; content: Buffer }>
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function listaHtml(titulo: string, personas: Array<{ dni: string; nombre: string; motivo?: string }>) {
  if (personas.length === 0) return ''
  const filas = personas
    .map(
      (p) =>
        `<li style="margin: 2px 0;">${escapeHtml(p.nombre)} · ${escapeHtml(p.dni)}${p.motivo ? ` · <em>${escapeHtml(p.motivo)}</em>` : ''}</li>`,
    )
    .join('')
  return `<h3 style="margin: 20px 0 6px; font-size: 15px; color: #0f172a;">${titulo} (${personas.length})</h3><ul style="margin: 0; padding-left: 20px; font-size: 14px;">${filas}</ul>`
}

export async function sendPreadmisionEmail(data: PreadmisionEmailData) {
  const transporter = getTransporter()
  const from = process.env.GMAIL_USER

  const titulo =
    data.estado === 'sorteado'
      ? `Bienvenida enviada a ${data.retadores.length} retadores`
      : data.estado === 'esperando'
        ? 'Hoy no se envió: se acumulan inscritos'
        : 'Error en la corrida'

  const detalle =
    data.estado === 'sorteado'
      ? `Se creó la campaña <strong>${escapeHtml(data.campaignNombre ?? '')}</strong>, marcada para el Bot Educador (Pre-admisión).`
      : data.estado === 'esperando'
        ? `Hay ${data.pendientes} inscrito(s) sin sortear; se necesitan al menos ${data.minimo}.`
        : escapeHtml(data.error ?? 'Error desconocido')

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: ${data.estado === 'error' ? '#7f1d1d' : '#0f172a'}; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px;">Pre-admisión · ${titulo}</h1>
        <p style="color: #94a3b8; margin: 4px 0 0; font-size: 14px;">Corrida del ${data.hoy} · 1ra asamblea ${data.asamblea}</p>
      </div>
      <div style="border: 1px solid #e2e8f0; border-top: none; padding: 24px 32px; border-radius: 0 0 8px 8px;">
        <p style="margin: 0; font-size: 15px;">${detalle}</p>
        ${listaHtml('Retadores — reciben la bienvenida', data.retadores)}
        ${listaHtml('Convencional — no reciben nada', data.convencional)}
        ${listaHtml('Excluidos', data.excluidos)}
        <p style="margin: 24px 0 0; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          Sayasend · Motor de Envíos
        </p>
      </div>
    </div>
  `

  await transporter.sendMail({
    from: `"Sayasend" <${from}>`,
    to: PREADMISION_RECIPIENTS.join(', '),
    subject: `Pre-admisión ${data.hoy}: ${titulo}`,
    html,
    attachments: data.adjuntos,
  })
}
