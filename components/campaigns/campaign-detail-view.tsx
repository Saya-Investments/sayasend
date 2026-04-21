'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { SendCampaignButton } from './send-campaign-button'
import { MetricsCards } from '@/components/contactability/metrics-cards'
import { RateCards } from '@/components/contactability/rate-cards'
import { ContactabilityCharts } from '@/components/contactability/contactability-charts'
import { ErrorsChart, type ErrorItem } from '@/components/contactability/errors-chart'

type ClienteLite = {
  id: string
  codigoAsociado: string
  nombre: string
  telefono: string
  segmento: string | null
}

type CampaignContactLite = {
  id: string
  sendStatus: string
  sentAt: Date | string | null
  deliveredAt: Date | string | null
  readAt: Date | string | null
  failedAt: Date | string | null
  failureReason: string | null
  cliente: ClienteLite
}

type CampaignDetail = {
  id: string
  nombre: string
  status: string
  databaseName: string
  sendMode: string | null
  segmentoFilter: string | null
  estrategiaFilter: string | null
  template: { nombre: string; contenido: string } | null
  campaignContacts: CampaignContactLite[]
}

type Metrics = {
  total: number
  sent: number
  delivered: number
  read: number
  failed: number
  deliveryRate: number
  readRate: number
  failureRate: number
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  sending: 'Enviando',
  completed: 'Completada',
}

const CONTACT_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  sent: 'Enviado',
  delivered: 'Entregado',
  read: 'Leído',
  failed: 'Fallido',
}

const CONTACT_STATUS_VARIANT: Record<string, 'secondary' | 'outline' | 'default' | 'destructive'> = {
  pending: 'secondary',
  sent: 'outline',
  delivered: 'default',
  read: 'default',
  failed: 'destructive',
}

export function CampaignDetailView({
  campaign,
  metrics,
  errors,
}: {
  campaign: CampaignDetail
  metrics: Metrics | null
  errors: ErrorItem[]
}) {
  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <SendCampaignButton campaignId={campaign.id} currentStatus={campaign.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Información de la Campaña</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Plantilla" value={campaign.template?.nombre ?? '—'} />
            <Field label="Base de Datos" value={campaign.databaseName} />
            <Field label="Modo de Envío" value={campaign.sendMode ?? '—'} />
            <Field label="Segmento" value={campaign.segmentoFilter ?? 'Todos'} />
            <Field label="Estrategia" value={campaign.estrategiaFilter ?? 'Todas'} />
            <div>
              <p className="text-sm text-muted-foreground">Estado</p>
              <Badge className="mt-1">{STATUS_LABEL[campaign.status] ?? campaign.status}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plantilla</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg border border-border">
              <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                {campaign.template?.contenido ?? '—'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contactos ({campaign.campaignContacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {campaign.campaignContacts.length === 0 ? (
            <p className="text-muted-foreground">Sin contactos.</p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted">
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Último evento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaign.campaignContacts.map((c) => {
                    const lastEvent = c.readAt ?? c.deliveredAt ?? c.sentAt ?? c.failedAt
                    return (
                      <TableRow key={c.id} className="hover:bg-muted/50">
                        <TableCell className="font-mono text-sm">
                          {c.cliente.codigoAsociado}
                        </TableCell>
                        <TableCell className="font-medium">{c.cliente.nombre}</TableCell>
                        <TableCell>{c.cliente.telefono}</TableCell>
                        <TableCell>
                          {c.cliente.segmento ? (
                            <Badge variant="outline">{c.cliente.segmento}</Badge>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={CONTACT_STATUS_VARIANT[c.sendStatus] ?? 'secondary'}>
                            {CONTACT_STATUS_LABEL[c.sendStatus] ?? c.sendStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {lastEvent ? new Date(lastEvent).toLocaleString() : '—'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {metrics && (
        <div className="space-y-6">
          <MetricsCards metrics={metrics} />
          <RateCards metrics={metrics} />
          <ContactabilityCharts metrics={metrics} />
          <ErrorsChart errors={errors} />
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  )
}

