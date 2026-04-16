'use client'

import { useEffect, useState } from 'react'

import { getBigQueryContacts, getBigQueryDatabases } from '@/lib/api'
import { mockTemplates } from '@/lib/mockData'
import type { BigQueryColumn, BigQueryContactsPayload, BigQueryDatabase } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function CampaignForm() {
  const [campaignName, setCampaignName] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [databaseName, setDatabaseName] = useState('')
  const [segmento, setSegmento] = useState('')
  const [estrategia, setEstrategia] = useState('')
  const [showContacts, setShowContacts] = useState(false)
  const [variableMappings, setVariableMappings] = useState<Record<string, string>>({})
  const [databases, setDatabases] = useState<BigQueryDatabase[]>([])
  const [availableColumns, setAvailableColumns] = useState<BigQueryColumn[]>([])
  const [contactsPayload, setContactsPayload] = useState<BigQueryContactsPayload>({
    columns: [],
    contacts: [],
  })
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(true)
  const [isLoadingContacts, setIsLoadingContacts] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const currentTemplate = mockTemplates.find((template) => template.id === selectedTemplate)
  const filteredContacts = contactsPayload.contacts

  useEffect(() => {
    const loadDatabases = async () => {
      setIsLoadingDatabases(true)
      setErrorMessage('')

      const response = await getBigQueryDatabases()

      if (!response.success || !response.data) {
        setDatabases([])
        setErrorMessage(response.error || 'No se pudieron cargar las tablas desde BigQuery.')
        setIsLoadingDatabases(false)
        return
      }

      setDatabases(response.data as BigQueryDatabase[])
      setIsLoadingDatabases(false)
    }

    loadDatabases()
  }, [])

  const resetContactSelection = () => {
    setShowContacts(false)
    setContactsPayload({ columns: [], contacts: [] })
    setAvailableColumns([])
    setVariableMappings({})
  }

  const handleApplyFilters = async () => {
    if (!databaseName) {
      setErrorMessage('Selecciona una base de datos para consultar clientes.')
      return
    }

    setIsLoadingContacts(true)
    setShowContacts(true)
    setErrorMessage('')

    const response = await getBigQueryContacts({
      databaseName,
      segmento: segmento || undefined,
      estrategia: estrategia || undefined,
    })

    if (!response.success || !response.data) {
      setContactsPayload({ columns: [], contacts: [] })
      setAvailableColumns([])
      setErrorMessage(response.error || 'No se pudieron cargar clientes desde BigQuery.')
      setIsLoadingContacts(false)
      return
    }

    const payload = response.data as BigQueryContactsPayload
    setContactsPayload(payload)
    setAvailableColumns(payload.columns)
    setVariableMappings({})
    setIsLoadingContacts(false)
  }

  const handleVariableMappingChange = (placeholder: string, columnName: string) => {
    setVariableMappings((previousMappings) => ({
      ...previousMappings,
      [placeholder]: columnName,
    }))
  }

  const getPreviewMessage = () => {
    if (!currentTemplate || filteredContacts.length === 0) return ''

    let message = currentTemplate.content
    const firstContact = filteredContacts[0]

    currentTemplate.variables.forEach((variable) => {
      const mappedColumn = variableMappings[variable.placeholder]

      if (mappedColumn) {
        const value = firstContact[mappedColumn] || 'N/A'
        message = message.replace(variable.placeholder, String(value))
      }
    })

    return message
  }

  const canCreateCampaign =
    campaignName &&
    databaseName &&
    selectedTemplate &&
    filteredContacts.length > 0 &&
    Object.keys(variableMappings).length === currentTemplate?.variables.length

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Datos Basicos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Nombre de la Campaña</Label>
              <Input
                id="campaign-name"
                placeholder="Ej. Campaña Premium Marzo"
                value={campaignName}
                onChange={(event) => setCampaignName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="database">Base de Datos</Label>
              <Select
                value={databaseName}
                onValueChange={(value) => {
                  setDatabaseName(value)
                  resetContactSelection()
                }}
                disabled={isLoadingDatabases}
              >
                <SelectTrigger id="database" className="w-full">
                  <SelectValue
                    placeholder={
                      isLoadingDatabases ? 'Cargando tablas de BigQuery...' : 'Selecciona una tabla'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {databases.map((database) => (
                    <SelectItem key={database.id} value={database.name}>
                      {database.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isLoadingDatabases && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Spinner className="size-3" />
                  Consultando tablas del dataset `CDV_COL`
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Segmentacion</CardTitle>
          <CardDescription>Consulta clientes desde BigQuery usando la tabla seleccionada</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="segmento">Segmento</Label>
              <Select value={segmento || 'all'} onValueChange={(value) => setSegmento(value === 'all' ? '' : value)}>
                <SelectTrigger id="segmento" className="w-full">
                  <SelectValue placeholder="Selecciona un segmento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ALTA">ALTA</SelectItem>
                  <SelectItem value="MEDIA">MEDIA</SelectItem>
                  <SelectItem value="BAJA">BAJA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="estrategia">Estrategia</Label>
              <Select
                value={estrategia || 'all'}
                onValueChange={(value) => setEstrategia(value === 'all' ? '' : value)}
              >
                <SelectTrigger id="estrategia" className="w-full">
                  <SelectValue placeholder="Selecciona una estrategia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="RETADOR">RETADOR</SelectItem>
                  <SelectItem value="CONVENCIONAL">CONVENCIONAL</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

          <Button
            onClick={handleApplyFilters}
            className="w-full"
            disabled={isLoadingContacts || !databaseName}
          >
            {isLoadingContacts ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner />
                Consultando clientes...
              </span>
            ) : (
              'Aplicar Filtros'
            )}
          </Button>
        </CardContent>
      </Card>

      {showContacts && (
        <Card>
          <CardHeader>
            <CardTitle>Clientes ({filteredContacts.length})</CardTitle>
            <CardDescription>Clientes obtenidos desde BigQuery para la tabla {databaseName}</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredContacts.length === 0 && !isLoadingContacts ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No se encontraron clientes con esos filtros.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted">
                      <TableHead>Codigo Asociado</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Telefono</TableHead>
                      <TableHead>Segmento</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Ultimo Pago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.map((contact, index) => (
                      <TableRow
                        key={contact.codigoAsociado || `${contact.nombre}-${index}`}
                        className="hover:bg-muted/50"
                      >
                        <TableCell className="font-mono text-sm">{contact.codigoAsociado || '-'}</TableCell>
                        <TableCell className="font-medium">{contact.nombre || '-'}</TableCell>
                        <TableCell>{contact.telefono || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{contact.segmento || '-'}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          ${Number(contact.monto || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {contact.fechaUltimoPago
                            ? new Date(String(contact.fechaUltimoPago)).toLocaleDateString()
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showContacts && (
        <Card>
          <CardHeader>
            <CardTitle>Plantilla de Mensaje</CardTitle>
            <CardDescription>Selecciona una plantilla y mapea columnas reales de BigQuery</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="template">Seleccionar Plantilla</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger id="template" className="w-full">
                  <SelectValue placeholder="Selecciona una plantilla" />
                </SelectTrigger>
                <SelectContent>
                  {mockTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {currentTemplate && (
              <div className="space-y-4">
                <div>
                  <h3 className="mb-3 font-semibold">Mapeo de Variables</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {currentTemplate.variables.map((variable) => (
                      <div key={variable.id} className="space-y-2">
                        <Label htmlFor={`var-${variable.id}`}>
                          {variable.name} ({variable.placeholder})
                        </Label>
                        <Select
                          value={variableMappings[variable.placeholder] || ''}
                          onValueChange={(value) =>
                            handleVariableMappingChange(variable.placeholder, value)
                          }
                        >
                          <SelectTrigger id={`var-${variable.id}`} className="w-full">
                            <SelectValue placeholder="Selecciona una columna" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableColumns.map((column) => (
                              <SelectItem key={column.name} value={column.name}>
                                {column.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="my-4" />

                <div>
                  <h3 className="mb-3 font-semibold">Vista Previa</h3>
                  <div className="min-h-24 rounded-lg border border-border bg-muted p-4">
                    <p className="text-sm break-words whitespace-pre-wrap text-foreground">
                      {getPreviewMessage() || 'Mapea todas las variables para ver la vista previa'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showContacts && (
        <div className="flex gap-3">
          <Button size="lg" disabled={!canCreateCampaign} className="flex-1">
            Crear Campaña
          </Button>
          <Button size="lg" variant="outline" className="flex-1">
            Cancelar
          </Button>
        </div>
      )}
    </div>
  )
}
