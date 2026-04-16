'use client'

import { useState } from 'react'
import { mockTemplates, mockContacts } from '@/lib/mockData'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { Template } from '@/lib/types'

export function CampaignForm() {
  const [campaignName, setCampaignName] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [segmento, setSegmento] = useState<string>('all')
  const [estrategia, setEstrategia] = useState<string>('all')
  const [showContacts, setShowContacts] = useState(false)
  const [variableMappings, setVariableMappings] = useState<Record<string, string>>({})

  const currentTemplate = mockTemplates.find(t => t.id === selectedTemplate)

  const getFilteredContacts = () => {
    return mockContacts.filter(contact => {
      const segmentoMatch = segmento === 'all' || contact.segmento === segmento
      const estrategiaMatch = estrategia === 'all' || true // Estrategia is a placeholder filter
      return segmentoMatch && estrategiaMatch
    })
  }

  const filteredContacts = getFilteredContacts()

  const handleApplyFilters = () => {
    setShowContacts(true)
  }

  const handleVariableMappingChange = (placeholder: string, columnName: string) => {
    setVariableMappings(prev => ({
      ...prev,
      [placeholder]: columnName
    }))
  }

  const getPreviewMessage = () => {
    if (!currentTemplate || filteredContacts.length === 0) return ''
    
    let message = currentTemplate.content
    const firstContact = filteredContacts[0]
    
    currentTemplate.variables.forEach(variable => {
      const mappedColumn = variableMappings[variable.placeholder]
      if (mappedColumn) {
        const value = (firstContact as any)[mappedColumn] || 'N/A'
        message = message.replace(variable.placeholder, String(value))
      }
    })
    
    return message
  }

  const canCreateCampaign = campaignName && selectedTemplate && filteredContacts.length > 0 && Object.keys(variableMappings).length === currentTemplate?.variables.length

  return (
    <div className="space-y-8">
      {/* Datos Básicos */}
      <Card>
        <CardHeader>
          <CardTitle>Datos Básicos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Nombre de la Campaña</Label>
              <Input
                id="campaign-name"
                placeholder="e.g., Campaña Premium Marzo"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="database">Base de Datos</Label>
              <Input
                id="database"
                placeholder="clientes_pdb"
                disabled
                className="bg-muted"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Segmentación */}
      <Card>
        <CardHeader>
          <CardTitle>Segmentación</CardTitle>
          <CardDescription>Filter customers by segment and strategy</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="segmento">Segmento</Label>
              <Select value={segmento} onValueChange={setSegmento}>
                <SelectTrigger id="segmento">
                  <SelectValue placeholder="Select segment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Premium">Premium</SelectItem>
                  <SelectItem value="Standard">Standard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="estrategia">Estrategia</Label>
              <Select value={estrategia} onValueChange={setEstrategia}>
                <SelectTrigger id="estrategia">
                  <SelectValue placeholder="Select strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="reactivacion">Reactivación</SelectItem>
                  <SelectItem value="cobranza">Cobranza</SelectItem>
                  <SelectItem value="retention">Retención</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleApplyFilters} className="w-full">
            Aplicar Filtros
          </Button>
        </CardContent>
      </Card>

      {/* Contacts Table */}
      {showContacts && (
        <Card>
          <CardHeader>
            <CardTitle>Clientes ({filteredContacts.length})</CardTitle>
            <CardDescription>Customers matching your filters</CardDescription>
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
                  {filteredContacts.map((contact) => (
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
      )}

      {/* Template Selection and Variable Mapping */}
      {showContacts && (
        <Card>
          <CardHeader>
            <CardTitle>Plantilla de Mensaje</CardTitle>
            <CardDescription>Select template and map variables</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="template">Seleccionar Plantilla</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger id="template">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {mockTemplates.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {currentTemplate && (
              <>
                {/* Variable Mapping */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-3">Mapeo de Variables</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {currentTemplate.variables.map((variable) => (
                        <div key={variable.id} className="space-y-2">
                          <Label htmlFor={`var-${variable.id}`}>
                            {variable.name} ({variable.placeholder})
                          </Label>
                          <Select
                            value={variableMappings[variable.placeholder] || ''}
                            onValueChange={(value) => handleVariableMappingChange(variable.placeholder, value)}
                          >
                            <SelectTrigger id={`var-${variable.id}`}>
                              <SelectValue placeholder="Select column" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nombre">Nombre</SelectItem>
                              <SelectItem value="telefono">Teléfono</SelectItem>
                              <SelectItem value="segmento">Segmento</SelectItem>
                              <SelectItem value="monto">Monto</SelectItem>
                              <SelectItem value="codigoAsociado">Código Asociado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator className="my-4" />

                  {/* Preview */}
                  <div>
                    <h3 className="font-semibold mb-3">Vista Previa</h3>
                    <div className="bg-muted p-4 rounded-lg border border-border min-h-24">
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                        {getPreviewMessage() || 'Map all variables to see preview'}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Campaign Button */}
      {showContacts && (
        <div className="flex gap-3">
          <Button
            size="lg"
            disabled={!canCreateCampaign}
            className="flex-1"
          >
            Crear Campaña
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="flex-1"
          >
            Cancelar
          </Button>
        </div>
      )}
    </div>
  )
}
