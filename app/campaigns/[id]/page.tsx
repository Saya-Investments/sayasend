'use client'

import { use } from 'react'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/app-layout'
import { MetricsCards } from '@/components/contactability/metrics-cards'
import { RateCards } from '@/components/contactability/rate-cards'
import { ContactabilityCharts } from '@/components/contactability/contactability-charts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Download, ArrowLeft } from 'lucide-react'
import { mockCampaigns, mockTemplates, mockContacts, mockMetrics } from '@/lib/mockData'

interface CampaignDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export default function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const { id } = use(params)
  const campaign = mockCampaigns.find(c => c.id === id)
  const template = campaign ? mockTemplates.find(t => t.id === campaign.templateId) : null

  if (!campaign || !template) {
    return (
      <AppLayout>
        <div className="p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">Campaign not found</h1>
            <Link href="/campaigns">
              <Button>Volver a Campañas</Button>
            </Link>
          </div>
        </div>
      </AppLayout>
    )
  }

  // Get filtered contacts for this campaign
  const campaignContacts = mockContacts.filter(contact => {
    const segmentoMatch = !campaign.segmentFilters.segmento || contact.segmento === campaign.segmentFilters.segmento
    return segmentoMatch
  })

  // Build preview message
  let previewMessage = template.content
  if (campaignContacts.length > 0) {
    const firstContact = campaignContacts[0]
    template.variables.forEach(variable => {
      const mappedColumn = campaign.variableMappings[variable.placeholder]
      if (mappedColumn) {
        const value = (firstContact as any)[mappedColumn] || 'N/A'
        previewMessage = previewMessage.replace(variable.placeholder, String(value))
      }
    })
  }

  const handleExportCSV = () => {
    // Create CSV content
    const headers = ['Código Asociado', 'Nombre', 'Teléfono', 'Segmento', 'Monto', 'Fecha Último Pago']
    const rows = campaignContacts.map(contact => [
      contact.codigoAsociado,
      contact.nombre,
      contact.telefono,
      contact.segmento,
      contact.monto,
      new Date(contact.fechaUltimoPago).toLocaleDateString(),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n')

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `campaign-${campaign.id}-contacts.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  return (
    <AppLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/campaigns">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Volver
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">{campaign.name}</h1>
            <p className="text-muted-foreground mt-1">
              Created {new Date(campaign.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Campaign Info and Template Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Información de la Campaña</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Plantilla</p>
                <p className="font-semibold">{template.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Base de Datos</p>
                <p className="font-semibold">{campaign.databaseName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Modo de Envío</p>
                <Badge variant="outline">{campaign.sendMode}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estado</p>
                <Badge className="mt-1">{campaign.status}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vista Previa del Mensaje</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-lg border border-border">
                <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                  {previewMessage}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Campaign Contacts Table */}
        <Card>
          <CardHeader>
            <CardTitle>Clientes de la Campaña ({campaignContacts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted">
                    <TableHead>Código Asociado</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Último Pago</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignContacts.map((contact) => (
                    <TableRow key={contact.codigoAsociado} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">{contact.codigoAsociado}</TableCell>
                      <TableCell className="font-medium">{contact.nombre}</TableCell>
                      <TableCell>{contact.telefono}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{contact.segmento}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        ${contact.monto.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(contact.fechaUltimoPago).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Metrics Section Title */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-foreground">Contactabilidad de Campaña</h2>
            <Button onClick={handleExportCSV} className="gap-2">
              <Download className="w-4 h-4" />
              EXPORTAR CSV
            </Button>
          </div>

          {/* Metrics Cards */}
          <MetricsCards metrics={mockMetrics} />
        </div>

        {/* Rate Cards */}
        <RateCards metrics={mockMetrics} />

        {/* Charts */}
        <ContactabilityCharts metrics={mockMetrics} />
      </div>
    </AppLayout>
  )
}
