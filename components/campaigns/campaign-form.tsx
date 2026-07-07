'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import {
  createCampaign,
  getBigQueryContacts,
  getBigQueryDatabases,
  getBigQueryEstrategias,
  getBigQueryFrentes,
} from '@/lib/api'
import { parseContactsExcel } from '@/lib/excel-contacts'
import type {
  BigQueryColumn,
  BigQueryContactsPayload,
  BigQueryDatabase,
  CampaignSource,
  CreateCampaignPayload,
} from '@/lib/types'

type TemplateOption = {
  id: string
  nombre: string
  contenido: string
  idioma: string | null
  estadoMeta: string | null
}

// Extrae los placeholders {{1}}, {{2}}, ... de un template.contenido en orden.
// Preserva orden por índice numérico, no por aparición (match con la lógica del motor).
function extractTemplateVariables(contenido: string) {
  const matches = (contenido.match(/\{\{\s*(\d+)\s*\}\}/g) ?? []).map((m) => ({
    placeholder: m.replace(/\s+/g, ''),
    index: m.replace(/[^\d]/g, ''),
  }))
  const seen = new Set<string>()
  const unique: { placeholder: string; index: string }[] = []
  for (const v of matches) {
    if (!seen.has(v.index)) {
      seen.add(v.index)
      unique.push({ placeholder: `{{${v.index}}}`, index: v.index })
    }
  }
  unique.sort((a, b) => Number(a.index) - Number(b.index))
  return unique
}
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MultiSelect } from '@/components/ui/multi-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const CONTACTS_PAGE_SIZE = 15

function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return '-'
  }

  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
    if (match) {
      const [, year, month, day] = match
      return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString()
    }
  }

  return new Date(value).toLocaleDateString()
}

export function CampaignForm() {
  const [campaignName, setCampaignName] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [source, setSource] = useState<CampaignSource>('bigquery')
  const [excelFileName, setExcelFileName] = useState('')
  const [isParsingExcel, setIsParsingExcel] = useState(false)
  const [excelWarnings, setExcelWarnings] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [databaseName, setDatabaseName] = useState('')
  const [selectedSegmentos, setSelectedSegmentos] = useState<string[]>([])
  const [selectedEstrategias, setSelectedEstrategias] = useState<string[]>([])
  const [selectedFrentes, setSelectedFrentes] = useState<string[]>([])
  const [frentes, setFrentes] = useState<string[]>([])
  const [isLoadingFrentes, setIsLoadingFrentes] = useState(false)
  const [estrategias, setEstrategias] = useState<string[]>([])
  const [isLoadingEstrategias, setIsLoadingEstrategias] = useState(false)
  const [showContacts, setShowContacts] = useState(false)
  const [variableMappings, setVariableMappings] = useState<Record<string, string>>({})
  const [databases, setDatabases] = useState<BigQueryDatabase[]>([])
  const [availableColumns, setAvailableColumns] = useState<BigQueryColumn[]>([])
  const [contactsPayload, setContactsPayload] = useState<BigQueryContactsPayload>({
    columns: [],
    contacts: [],
  })
  const [contactsPage, setContactsPage] = useState(1)
  const [activeGestionType, setActiveGestionType] = useState<'gestion_m0' | 'gestion_cobranza' | null>(null)
  const [refreshOnSend, setRefreshOnSend] = useState(false)
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(true)
  const [isLoadingContacts, setIsLoadingContacts] = useState(false)
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true)

  const currentTemplate = templates.find((template) => template.id === selectedTemplate)
  const currentVariables = useMemo(
    () => (currentTemplate ? extractTemplateVariables(currentTemplate.contenido) : []),
    [currentTemplate],
  )
  const filteredContacts = contactsPayload.contacts
  const contactsWithoutPhone = filteredContacts.filter(
    (contact) => !contact.telefono || String(contact.telefono).trim() === '',
  ).length
  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / CONTACTS_PAGE_SIZE))
  const safePage = Math.min(contactsPage, totalPages)
  const paginatedContacts = filteredContacts.slice(
    (safePage - 1) * CONTACTS_PAGE_SIZE,
    safePage * CONTACTS_PAGE_SIZE,
  )
  const needsTemplateMappings = !!currentTemplate

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

  // Cargar templates reales desde la BD. El endpoint filtra por default las
  // marcadas como DELETED_IN_META para que no aparezcan en el selector.
  useEffect(() => {
    const loadTemplates = async () => {
      setIsLoadingTemplates(true)
      try {
        const response = await fetch('/api/templates')
        const result = await response.json()
        if (result.success && Array.isArray(result.data)) {
          setTemplates(result.data as TemplateOption[])
        } else {
          setTemplates([])
        }
      } catch {
        setTemplates([])
      } finally {
        setIsLoadingTemplates(false)
      }
    }
    loadTemplates()
  }, [])

  useEffect(() => {
    if (source !== 'bigquery' || !databaseName) {
      setFrentes([])
      setSelectedFrentes([])
      setEstrategias([])
      setSelectedEstrategias([])
      return
    }

    const loadFrentes = async () => {
      setIsLoadingFrentes(true)
      const response = await getBigQueryFrentes(databaseName)

      if (!response.success || !Array.isArray(response.data)) {
        setFrentes([])
        setIsLoadingFrentes(false)
        return
      }

      setFrentes(response.data as string[])
      setIsLoadingFrentes(false)
    }

    const loadEstrategias = async () => {
      setIsLoadingEstrategias(true)
      const response = await getBigQueryEstrategias(databaseName)

      if (!response.success || !Array.isArray(response.data)) {
        setEstrategias([])
        setIsLoadingEstrategias(false)
        return
      }

      setEstrategias(response.data as string[])
      setIsLoadingEstrategias(false)
    }

    loadFrentes()
    loadEstrategias()
  }, [databaseName, source])

  const resetContactSelection = () => {
    setShowContacts(false)
    setContactsPayload({ columns: [], contacts: [] })
    setAvailableColumns([])
    setVariableMappings({})
    setSuccessMessage('')
    setSelectedFrentes([])
    setSelectedEstrategias([])
    setContactsPage(1)
    setExcelFileName('')
    setExcelWarnings([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSourceChange = (next: CampaignSource) => {
    if (next === source) return
    setSource(next)
    setDatabaseName('')
    setSelectedSegmentos([])
    setErrorMessage('')
    resetContactSelection()
  }

  const handleExcelFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsParsingExcel(true)
    setErrorMessage('')
    setSuccessMessage('')
    setExcelWarnings([])

    const result = await parseContactsExcel(file)

    if (!result.success) {
      setErrorMessage(result.error)
      setExcelFileName('')
      setContactsPayload({ columns: [], contacts: [] })
      setAvailableColumns([])
      setShowContacts(false)
      setIsParsingExcel(false)
      return
    }

    const foundOptionalColumns = result.foundOptionalColumns ?? []
    const excelColumns: BigQueryColumn[] = [
      { name: 'numDoc', type: 'STRING' },
      { name: 'telefono', type: 'STRING' },
      ...(foundOptionalColumns.includes('nombre') ? [{ name: 'nombre', type: 'STRING' }] : []),
      ...(foundOptionalColumns.includes('monto') ? [{ name: 'monto', type: 'FLOAT' }] : []),
      ...(foundOptionalColumns.includes('fechaVencimiento') ? [{ name: 'fechaVencimiento', type: 'DATE' }] : []),
    ]

    setExcelFileName(file.name)
    setExcelWarnings(result.warnings)
    setDatabaseName(file.name)
    setContactsPayload({ columns: excelColumns, contacts: result.contacts })
    setAvailableColumns(excelColumns)
    setVariableMappings({})
    setContactsPage(1)
    setShowContacts(true)
    setIsParsingExcel(false)
  }

  const handleApplyFilters = async (gestionType: 'gestion_m0' | 'gestion_cobranza') => {
    if (!databaseName) {
      setErrorMessage('Selecciona una base de datos para consultar clientes.')
      return
    }

    setIsLoadingContacts(true)
    setShowContacts(true)
    setActiveGestionType(gestionType)
    setErrorMessage('')
    setSuccessMessage('')

    const response = await getBigQueryContacts({
      databaseName,
      segmento: selectedSegmentos.length > 0 ? selectedSegmentos : undefined,
      estrategia: selectedEstrategias.length > 0 ? selectedEstrategias : undefined,
      frente: selectedFrentes.length > 0 ? selectedFrentes : undefined,
      gestionType,
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
    setContactsPage(1)
    setIsLoadingContacts(false)
  }

  // El key en variableMappings es el índice numérico ("1", "2", ...) — formato
  // canónico que el motor espera. No usamos el placeholder con llaves ({{1}})
  // porque rompe los parseInt() de sort que hace el motor.
  const handleVariableMappingChange = (index: string, columnName: string) => {
    setVariableMappings((previousMappings) => ({
      ...previousMappings,
      [index]: columnName,
    }))
  }

  const getPreviewMessage = () => {
    if (!currentTemplate || filteredContacts.length === 0) return ''

    let message = currentTemplate.contenido
    const firstContact = filteredContacts[0]

    currentVariables.forEach((variable) => {
      const mappedColumn = variableMappings[variable.index]

      if (mappedColumn) {
        const value = firstContact[mappedColumn] || 'N/A'
        message = message.replaceAll(variable.placeholder, String(value))
      }
    })

    return message
  }

  const handleCreateCampaign = async () => {
    if (!campaignName.trim()) {
      setErrorMessage('Ingresa un nombre para la campaña.')
      return
    }

    if (source === 'bigquery' && !databaseName) {
      setErrorMessage('Selecciona una base de datos.')
      return
    }

    if (source === 'excel' && !excelFileName) {
      setErrorMessage('Sube un archivo Excel con las columnas "Num Doc" y "telefono".')
      return
    }

    if (filteredContacts.length === 0) {
      setErrorMessage('No hay clientes para guardar en la campaña.')
      return
    }

    if (
      needsTemplateMappings &&
      Object.keys(variableMappings).length !== currentVariables.length
    ) {
      setErrorMessage('Completa el mapeo de variables de la plantilla.')
      return
    }

    setIsCreatingCampaign(true)
    setErrorMessage('')
    setSuccessMessage('')

    const payload: CreateCampaignPayload = {
      name: campaignName.trim(),
      templateId: selectedTemplate || null,
      source,
      databaseName: source === 'excel' ? `EXCEL:${excelFileName}` : databaseName,
      segmentFilters:
        source === 'bigquery'
          ? {
              segmento: selectedSegmentos.length > 0 ? selectedSegmentos : undefined,
              estrategia: selectedEstrategias.length > 0 ? selectedEstrategias : undefined,
              frente: selectedFrentes.length > 0 ? selectedFrentes : undefined,
            }
          : {},
      variableMappings,
      contacts: filteredContacts,
      gestionType: source === 'bigquery' ? activeGestionType ?? undefined : undefined,
      refreshOnSend: source === 'bigquery' ? refreshOnSend : false,
    }

    const response = await createCampaign(payload)

    if (!response.success) {
      setErrorMessage(response.error || 'No se pudo crear la campaña.')
      setIsCreatingCampaign(false)
      return
    }

    setSuccessMessage(`Campaña creada correctamente con ${filteredContacts.length} clientes.`)
    setIsCreatingCampaign(false)
  }

  const canCreateCampaign =
    !!campaignName.trim() &&
    (source === 'bigquery' ? !!databaseName : !!excelFileName) &&
    filteredContacts.length > 0 &&
    (!needsTemplateMappings ||
      Object.keys(variableMappings).length === currentVariables.length)

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Datos Basicos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="campaign-name">Nombre de la Campaña</Label>
            <Input
              id="campaign-name"
              placeholder="Ej. Campaña Premium Abril"
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Origen de Clientes</CardTitle>
          <CardDescription>Elige cómo cargar los clientes: desde BigQuery o desde un archivo Excel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={source} onValueChange={(value) => handleSourceChange(value as CampaignSource)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bigquery">BigQuery</TabsTrigger>
              <TabsTrigger value="excel">Excel</TabsTrigger>
            </TabsList>

            <TabsContent value="bigquery" className="mt-4 space-y-4">
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

              <div className="space-y-2">
                <p className="text-sm font-medium">Segmentación</p>
                <p className="text-xs text-muted-foreground">
                  Filtra la tabla seleccionada por segmento, estrategia y frente
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="segmento">Segmento</Label>
                  <MultiSelect
                    id="segmento"
                    value={selectedSegmentos}
                    onChange={setSelectedSegmentos}
                    placeholder="Todos"
                    options={[
                      { value: 'ALTA' },
                      { value: 'MEDIA' },
                      { value: 'BAJA' },
                    ]}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estrategia">Estrategia</Label>
                  <MultiSelect
                    id="estrategia"
                    value={selectedEstrategias}
                    onChange={setSelectedEstrategias}
                    disabled={!databaseName || isLoadingEstrategias}
                    placeholder={
                      !databaseName
                        ? 'Selecciona una tabla primero'
                        : isLoadingEstrategias
                          ? 'Cargando estrategias...'
                          : 'Todas'
                    }
                    emptyText="No hay estrategias"
                    options={estrategias.map((estrategiaOption) => ({ value: estrategiaOption }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="frente">Frente</Label>
                  <MultiSelect
                    id="frente"
                    value={selectedFrentes}
                    onChange={setSelectedFrentes}
                    disabled={!databaseName || isLoadingFrentes}
                    placeholder={
                      !databaseName
                        ? 'Selecciona una tabla primero'
                        : isLoadingFrentes
                          ? 'Cargando frentes...'
                          : 'Todos'
                    }
                    emptyText="No hay frentes"
                    options={frentes.map((frenteOption) => ({ value: frenteOption }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => handleApplyFilters('gestion_m0')}
                  disabled={isLoadingContacts || !databaseName}
                >
                  {isLoadingContacts ? (
                    <span className="flex items-center justify-center gap-2">
                      <Spinner />
                      Consultando...
                    </span>
                  ) : (
                    'Gestión m0'
                  )}
                </Button>
                <Button
                  onClick={() => handleApplyFilters('gestion_cobranza')}
                  disabled={isLoadingContacts || !databaseName}
                >
                  {isLoadingContacts ? (
                    <span className="flex items-center justify-center gap-2">
                      <Spinner />
                      Consultando...
                    </span>
                  ) : (
                    'Gestión cobranza'
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="excel" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="excel-file">Archivo Excel</Label>
                <Input
                  id="excel-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelFileChange}
                  disabled={isParsingExcel}
                />
                <p className="text-xs text-muted-foreground">
                  Columnas obligatorias: <span className="font-mono">Num Doc</span> (o DNI, Cédula…) y{' '}
                  <span className="font-mono">Telefono</span> (o Celular, Movil…).{' '}
                  Columnas opcionales: <span className="font-mono">Nombre</span>,{' '}
                  <span className="font-mono">Monto</span> y{' '}
                  <span className="font-mono">Fecha Vencimiento</span> — si están presentes se guardarán en la BD.
                </p>
              </div>

              {isParsingExcel && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="size-3" />
                  Procesando archivo...
                </p>
              )}

              {excelFileName && !isParsingExcel && (
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                  <p className="font-medium">{excelFileName}</p>
                  <p className="text-muted-foreground">
                    {filteredContacts.length} clientes leídos
                  </p>
                  {excelWarnings.map((warning, idx) => (
                    <p key={idx} className="text-xs text-amber-600 mt-1">
                      {warning}
                    </p>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
          {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
        </CardContent>
      </Card>

      {showContacts && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle>Clientes ({filteredContacts.length})</CardTitle>
                <CardDescription>
                  {source === 'excel'
                    ? `Clientes cargados desde ${excelFileName || 'archivo Excel'}`
                    : `Clientes cruzados desde BigQuery para la tabla ${databaseName}`}
                </CardDescription>
              </div>
              {contactsWithoutPhone > 0 && (
                <Badge variant="outline" className="border-destructive/40 text-destructive">
                  Sin telefono: {contactsWithoutPhone}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {filteredContacts.length === 0 && !isLoadingContacts ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                {source === 'excel'
                  ? 'El archivo no contiene filas válidas.'
                  : 'No se encontraron clientes con esos filtros.'}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted">
                      <TableHead>Codigo Asociado</TableHead>
                      <TableHead>Num Doc</TableHead>
                      <TableHead>Probabilidad Pago</TableHead>
                      <TableHead>Segmento</TableHead>
                      <TableHead>Gestion</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Telefono</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      {activeGestionType === 'gestion_cobranza' && (
                        <>
                          <TableHead className="text-right">Monto 1</TableHead>
                          <TableHead className="text-right">Monto 2</TableHead>
                          <TableHead className="text-right">Monto 3</TableHead>
                          <TableHead>Mes Pasado</TableHead>
                          <TableHead>Fec. Venc. Pasado</TableHead>
                        </>
                      )}
                      <TableHead>Fecha Asamblea</TableHead>
                      <TableHead>Fecha Vencimiento</TableHead>
                      <TableHead>Mes</TableHead>
                      <TableHead>Fec_Ult_Pag_CCAP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedContacts.map((contact, index) => (
                      <TableRow
                        key={contact.codigoAsociado || `${contact.nombre}-${index}`}
                        className="hover:bg-muted/50"
                      >
                        <TableCell className="font-mono text-sm">{contact.codigoAsociado || '-'}</TableCell>
                        <TableCell>{contact.numDoc || '-'}</TableCell>
                        <TableCell>{contact.probabilidadPago ?? 0}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{contact.segmento || '-'}</Badge>
                        </TableCell>
                        <TableCell>{contact.gestion || '-'}</TableCell>
                        <TableCell className="font-medium">{contact.nombre || '-'}</TableCell>
                        <TableCell>{contact.telefono || '-'}</TableCell>
                        <TableCell className="text-right">
                          {Number(contact.monto || 0).toLocaleString('es-CO', {
                            style: 'currency',
                            currency: 'COP',
                            maximumFractionDigits: 0,
                          })}
                        </TableCell>
                        {activeGestionType === 'gestion_cobranza' && (
                          <>
                            <TableCell className="text-right">
                              {Number(contact.monto1 || 0).toLocaleString('es-CO', {
                                style: 'currency',
                                currency: 'COP',
                                maximumFractionDigits: 0,
                              })}
                            </TableCell>
                            <TableCell className="text-right">
                              {Number(contact.monto2 || 0).toLocaleString('es-CO', {
                                style: 'currency',
                                currency: 'COP',
                                maximumFractionDigits: 0,
                              })}
                            </TableCell>
                            <TableCell className="text-right">
                              {Number(contact.monto3 || 0).toLocaleString('es-CO', {
                                style: 'currency',
                                currency: 'COP',
                                maximumFractionDigits: 0,
                              })}
                            </TableCell>
                            <TableCell>{contact.mesPasado || '-'}</TableCell>
                            <TableCell>{formatDate(contact.fechaVencimientoPasado)}</TableCell>
                          </>
                        )}
                        <TableCell>{formatDate(contact.fechaAsamblea)}</TableCell>
                        <TableCell>{formatDate(contact.fechaVencimiento)}</TableCell>
                        <TableCell>{contact.mes || '-'}</TableCell>
                        <TableCell>{formatDate(contact.fecUltPagCcap)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {filteredContacts.length > CONTACTS_PAGE_SIZE && (
              <div className="mt-4 flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Mostrando {(safePage - 1) * CONTACTS_PAGE_SIZE + 1}-
                  {Math.min(safePage * CONTACTS_PAGE_SIZE, filteredContacts.length)} de{' '}
                  {filteredContacts.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setContactsPage((page) => Math.max(1, page - 1))}
                    disabled={safePage <= 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Pagina {safePage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setContactsPage((page) => Math.min(totalPages, page + 1))}
                    disabled={safePage >= totalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showContacts && (
        <Card>
          <CardHeader>
            <CardTitle>Plantilla de Mensaje</CardTitle>
            <CardDescription>La plantilla es opcional; si eliges una, completa el mapeo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="template">Seleccionar Plantilla</Label>
              <Select
                value={selectedTemplate || 'none'}
                onValueChange={(value) => {
                  setSelectedTemplate(value === 'none' ? '' : value)
                  setVariableMappings({})
                }}
                disabled={isLoadingTemplates}
              >
                <SelectTrigger id="template" className="w-full">
                  <SelectValue
                    placeholder={
                      isLoadingTemplates
                        ? 'Cargando plantillas...'
                        : templates.length === 0
                          ? 'No hay plantillas — sincroniza con Meta primero'
                          : 'Selecciona una plantilla'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin plantilla</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.nombre}
                      {template.idioma ? ` (${template.idioma})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {currentTemplate && (
              <div className="space-y-4">
                {currentVariables.length > 0 ? (
                  <div>
                    <h3 className="mb-3 font-semibold">Mapeo de Variables</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {currentVariables.map((variable) => (
                        <div key={variable.index} className="space-y-2">
                          <Label htmlFor={`var-${variable.index}`}>
                            Variable {variable.placeholder}
                          </Label>
                          <Select
                            value={variableMappings[variable.index] || ''}
                            onValueChange={(value) =>
                              handleVariableMappingChange(variable.index, value)
                            }
                          >
                            <SelectTrigger id={`var-${variable.index}`} className="w-full">
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
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Esta plantilla no tiene variables — se enviará tal cual.
                  </p>
                )}

                <Separator className="my-4" />

                <div>
                  <h3 className="mb-3 font-semibold">Vista Previa</h3>
                  <div className="min-h-24 rounded-lg border border-border bg-muted p-4">
                    <p className="text-sm break-words whitespace-pre-wrap text-foreground">
                      {currentVariables.length === 0
                        ? currentTemplate.contenido
                        : getPreviewMessage() ||
                          'Mapea todas las variables para ver la vista previa'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showContacts && source === 'bigquery' && (
        <Card>
          <CardContent className="flex items-start gap-3 py-4">
            <Checkbox
              id="refresh-on-send"
              checked={refreshOnSend}
              onCheckedChange={(value) => setRefreshOnSend(value === true)}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label htmlFor="refresh-on-send" className="cursor-pointer">
                Usar base actualizada del día de envío
              </Label>
              <p className="text-xs text-muted-foreground">
                Si la programas para una fecha futura, los contactos se volverán a
                consultar en BigQuery ese mismo día (con estos mismos filtros) en
                lugar de usar la lista de hoy. Si ese día no hay contactos, la
                campaña se marcará como fallida y se enviará un aviso por correo.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {showContacts && (
        <div className="flex gap-3">
          <Button
            size="lg"
            disabled={!canCreateCampaign || isCreatingCampaign}
            className="flex-1"
            onClick={handleCreateCampaign}
          >
            {isCreatingCampaign ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner />
                Guardando campaña...
              </span>
            ) : (
              'Crear Campaña'
            )}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="flex-1"
            onClick={resetContactSelection}
          >
            Cancelar
          </Button>
        </div>
      )}
    </div>
  )
}
