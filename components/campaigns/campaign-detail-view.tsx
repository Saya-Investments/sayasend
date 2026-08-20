'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SendCampaignButton } from './send-campaign-button'
import { MetricsCards } from '@/components/contactability/metrics-cards'
import { RateCards } from '@/components/contactability/rate-cards'
import { ContactabilityCharts } from '@/components/contactability/contactability-charts'
import { ErrorsChart, type ErrorItem } from '@/components/contactability/errors-chart'
import { ExportCsvButton } from '@/components/contactability/export-csv-button'
import { parseFilterValue } from '@/lib/segment-filters'
import type { ContactabilityMetrics } from '@/lib/types'

// Muestra un filtro guardado (uno o varios valores) de forma legible.
function formatFilterValue(stored: string | null, allLabel: string) {
  const values = parseFilterValue(stored)
  return values.length > 0 ? values.join(', ') : allLabel
}

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
  scheduledAt: Date | string | null
  segmentoFilter: string | null
  estrategiaFilter: string | null
  frenteFilter: string | null
  rangoMontoFilter: string | null
  variableMappings: Record<string, string>
  template: { nombre: string; contenido: string } | null
  campaignContacts: CampaignContactLite[]
}

type Metrics = ContactabilityMetrics

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  sending: 'Enviando',
  completed: 'Completada',
  failed: 'Fallida',
}

const CONTACT_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  sent: 'Enviado',
  delivered: 'Entregado',
  read: 'Leído',
  failed: 'Fallido',
}

const PAGE_SIZE_OPTIONS = [20, 50, 100]

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
  principalErrors,
  alternateErrors,
}: {
  campaign: CampaignDetail
  metrics: Metrics | null
  principalErrors: ErrorItem[]
  alternateErrors: ErrorItem[]
}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0])

  const contacts = campaign.campaignContacts
  const totalPages = Math.max(1, Math.ceil(contacts.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const pageItems = contacts.slice(startIndex, startIndex + pageSize)

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <SendCampaignButton
          campaignId={campaign.id}
          currentStatus={campaign.status}
          scheduledAt={campaign.scheduledAt}
        />
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
            <Field label="Segmento" value={formatFilterValue(campaign.segmentoFilter, 'Todos')} />
            <Field label="Estrategia" value={formatFilterValue(campaign.estrategiaFilter, 'Todas')} />
            <Field label="Frente" value={formatFilterValue(campaign.frenteFilter, 'Todos')} />
            <Field label="Rango Monto" value={formatFilterValue(campaign.rangoMontoFilter, 'Todos')} />
            <Field
              label="Programada para"
              value={
                campaign.scheduledAt
                  ? new Date(campaign.scheduledAt).toLocaleString()
                  : 'No programada'
              }
            />
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
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg border border-border">
              <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                {campaign.template?.contenido ?? '—'}
              </p>
            </div>
            {Object.keys(campaign.variableMappings).length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Mapeo de Variables</p>
                <div className="space-y-1">
                  {Object.entries(campaign.variableMappings)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([index, columnName]) => (
                      <p key={index} className="text-sm text-muted-foreground">
                        <span className="font-mono">{'{{' + index + '}}'}</span>: {columnName}
                      </p>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contactos ({contacts.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {contacts.length === 0 ? (
            <p className="text-muted-foreground">Sin contactos.</p>
          ) : (
            <>
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
                  {pageItems.map((c) => {
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

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Filas por página</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value))
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="h-8 w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Mostrando {startIndex + 1}–{Math.min(startIndex + pageSize, contacts.length)} de{' '}
                  {contacts.length}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {metrics && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">Contactabilidad</h2>
            <ExportCsvButton campaignId={campaign.id} />
          </div>
          <MetricsCards metrics={metrics} />
          <RateCards metrics={metrics} />
          <ContactabilityCharts metrics={metrics} />
          <ErrorsChart
            principalErrors={principalErrors}
            alternateErrors={alternateErrors}
          />
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

