'use client'

import { useState, type ReactNode } from 'react'
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
import type {
  CampaignContactability,
  ContactabilityScope,
  SecondaryContactabilitySummary,
} from '@/lib/campaign-contactability'
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
  contactability,
}: {
  campaign: CampaignDetail
  contactability: CampaignContactability | null
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

      {contactability && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">Contactabilidad</h2>
          </div>

          <ContactabilitySection
            campaignId={campaign.id}
            exportScope="global"
            title="Contactabilidad global"
            description="Resultado final de cada contacto después de considerar el teléfono principal y, cuando correspondió, el secundario. Cada contacto cuenta una sola vez."
            metrics={contactability.global}
            errors={contactability.errors.global}
            errorEmptyMessage="No hay errores finales sin recuperar en esta campaña."
          />

          <ContactabilitySection
            campaignId={campaign.id}
            exportScope="principal"
            title="Contactabilidad del teléfono principal"
            description="Resultado del primer intento realizado con clientes.telefono para todos los contactos de la campaña."
            metrics={contactability.principal}
            errors={contactability.errors.principal}
            errorEmptyMessage="No hay errores registrados para el teléfono principal."
          />

          <ContactabilitySection
            campaignId={campaign.id}
            exportScope="alterno"
            title="Contactabilidad del teléfono secundario"
            description="Parte de los contactos que fallaron con el teléfono principal. Los casos sin teléfono secundario o todavía no reintentados permanecen pendientes en este bloque."
            metrics={contactability.alternate}
            errors={contactability.errors.alterno}
            errorEmptyMessage="No hay errores registrados para el teléfono secundario."
          >
            <SecondarySummary summary={contactability.secondarySummary} />
          </ContactabilitySection>
        </div>
      )}
    </div>
  )
}

function ContactabilitySection({
  campaignId,
  exportScope,
  title,
  description,
  metrics,
  errors,
  errorEmptyMessage,
  children,
}: {
  campaignId: string
  exportScope: ContactabilityScope
  title: string
  description: string
  metrics: Metrics
  errors: ErrorItem[]
  errorEmptyMessage: string
  children?: ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-muted/20 p-5 md:p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        <ExportCsvButton campaignId={campaignId} scope={exportScope} />
      </div>
      {children}
      <MetricsCards metrics={metrics} />
      <RateCards metrics={metrics} />
      <ContactabilityCharts metrics={metrics} />
      <ErrorsChart errors={errors} emptyMessage={errorEmptyMessage} />
    </section>
  )
}

function SecondarySummary({ summary }: { summary: SecondaryContactabilitySummary }) {
  if (summary.eligible === 0) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
        No hubo fallidos en el teléfono principal, así que no fue necesario buscar teléfonos
        secundarios.
      </div>
    )
  }

  const items = [
    { label: 'Fallidos del principal', value: summary.eligible },
    { label: 'Con teléfono secundario', value: summary.withAlternate },
    { label: 'Sin teléfono secundario', value: summary.withoutAlternate },
    { label: 'Reintentados', value: summary.retried },
    { label: 'Con secundario sin reintento', value: summary.notRetried },
  ]

  return (
    <div className="space-y-3">
      {summary.withAlternate === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Esta campaña no tiene teléfonos secundarios disponibles para los contactos que fallaron
          en el primer intento.
        </div>
      )}
      {summary.withAlternate > 0 && summary.notRetried > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Hay {summary.notRetried} contacto{summary.notRetried === 1 ? '' : 's'} con teléfono
          secundario disponible cuyo reintento todavía no está registrado.
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {items.map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-5 text-center">
              <p className="text-2xl font-bold text-foreground">{item.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
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

