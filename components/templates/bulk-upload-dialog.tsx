'use client'

import { useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  MinusCircle,
  Upload,
  XCircle,
} from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  parseTemplatesExcel,
  generarExcelEjemplo,
  extraerVariables,
  TAMANO_LOTE,
  type BulkTemplateRow,
} from '@/lib/excel-templates'

type BulkResultado = {
  fila: number
  nombreSolicitado: string
  nombreFinal: string | null
  versionado: boolean
  estado: 'creada' | 'omitida' | 'error'
  estadoMeta?: string
  error?: string
  nota?: string
}

type BulkResponse = {
  resumen: { total: number; creadas: number; omitidas: number; errores: number; versionadas: number }
  avisoMeta?: string
  resultados: BulkResultado[]
}

type SiNombreExiste = 'versionar' | 'omitir'

/** Cuántas plantillas manda el piloto por defecto. */
const PILOTO_POR_DEFECTO = 10

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFinished: () => void
}

export function BulkUploadTemplatesDialog({ open, onOpenChange, onFinished }: Props) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<BulkTemplateRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [respuesta, setRespuesta] = useState<BulkResponse | null>(null)
  const [progreso, setProgreso] = useState<{ procesadas: number; total: number } | null>(null)
  const [modoPiloto, setModoPiloto] = useState(false)
  const [pilotoN, setPilotoN] = useState(PILOTO_POR_DEFECTO)
  const [siNombreExiste, setSiNombreExiste] = useState<SiNombreExiste>('versionar')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const validas = rows.filter((r) => r.errores.length === 0)
  const invalidas = rows.filter((r) => r.errores.length > 0)
  // En modo piloto solo se manda el primer tramo del archivo, para ver cómo
  // reacciona la revisión de Meta antes de subir el resto.
  const aEnviar = modoPiloto ? validas.slice(0, pilotoN) : validas

  const reset = () => {
    setFileName(null)
    setRows([])
    setError(null)
    setRespuesta(null)
    setProgreso(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClose = (next: boolean) => {
    if (!next) {
      // Si se creó algo, refrescamos la lista al cerrar.
      if (respuesta && respuesta.resumen.creadas > 0) onFinished()
      reset()
    }
    onOpenChange(next)
  }

  const handleDescargarEjemplo = () => {
    const blob = generarExcelEjemplo()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantillas-ejemplo.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setParsing(true)
    setError(null)
    setRespuesta(null)
    setRows([])

    const result = await parseTemplatesExcel(file)
    setParsing(false)

    if (!result.success) {
      setError(result.error)
      setFileName(null)
      return
    }

    setFileName(file.name)
    setRows(result.rows)
  }

  // Manda las plantillas en tandas de TAMANO_LOTE en vez de todas en un
  // request: un archivo grande se pasaría del timeout de la función, y así
  // además podemos ir mostrando el avance. Si una tanda falla entera (timeout,
  // red), conservamos lo que ya se creó y cortamos ahí — las filas que no se
  // procesaron quedan reportadas para reintentarlas.
  const handleCrear = async () => {
    setSubiendo(true)
    setError(null)
    setProgreso({ procesadas: 0, total: aEnviar.length })

    const acumulado: BulkResultado[] = []
    let avisoMeta: string | undefined
    let corteError: string | null = null

    for (let i = 0; i < aEnviar.length; i += TAMANO_LOTE) {
      const tanda = aEnviar.slice(i, i + TAMANO_LOTE)
      try {
        const response = await fetch('/api/templates/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siNombreExiste,
            templates: tanda.map((r) => ({
              fila: r.fila,
              nombre: r.nombre,
              mensaje: r.mensaje,
              ejemplosMensaje: r.ejemplosMensaje,
              categoria: r.categoria,
              idioma: r.idioma,
              header: r.header,
              ejemplosHeader: r.ejemplosHeader,
              footer: r.footer,
              descripcion: r.descripcion,
            })),
          }),
        })
        const result = await response.json()
        if (!result.success) throw new Error(result.error ?? 'Error creando plantillas')

        acumulado.push(...(result.resultados as BulkResultado[]))
        avisoMeta = avisoMeta ?? result.avisoMeta
        setProgreso({ procesadas: acumulado.length, total: aEnviar.length })
      } catch (err) {
        corteError = err instanceof Error ? err.message : 'Error desconocido'
        // Las filas de esta tanda y las que faltaban no se procesaron.
        for (const r of aEnviar.slice(i)) {
          acumulado.push({
            fila: r.fila,
            nombreSolicitado: r.nombre,
            nombreFinal: null,
            versionado: false,
            estado: 'error',
            error: 'No se procesó: se interrumpió la carga.',
          })
        }
        break
      }
    }

    const creadas = acumulado.filter((r) => r.estado === 'creada').length
    const omitidas = acumulado.filter((r) => r.estado === 'omitida').length
    setRespuesta({
      resumen: {
        total: acumulado.length,
        creadas,
        omitidas,
        errores: acumulado.length - creadas - omitidas,
        versionadas: acumulado.filter((r) => r.estado === 'creada' && r.versionado).length,
      },
      avisoMeta,
      resultados: acumulado,
    })
    if (corteError) setError(`La carga se interrumpió: ${corteError}`)
    setProgreso(null)
    setSubiendo(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cargar plantillas desde Excel</DialogTitle>
          <DialogDescription>
            Una fila por plantilla. Se crean en Meta Business y quedan pendientes de aprobación.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!respuesta && (
            <>
              <div className="rounded-md border border-border bg-muted/40 p-4 text-sm space-y-2">
                <p className="font-medium">Columnas del archivo</p>
                <ul className="text-muted-foreground space-y-1 list-disc pl-5">
                  <li>
                    <span className="font-mono text-foreground">nombre</span> y{' '}
                    <span className="font-mono text-foreground">mensaje</span> son obligatorias.
                  </li>
                  <li>
                    <span className="font-mono text-foreground">ejemplos_mensaje</span>: un ejemplo
                    por cada variable del mensaje, separados por{' '}
                    <span className="font-mono text-foreground">|</span>. Si el mensaje tiene{' '}
                    {'{{1}}'}, {'{{2}}'} y {'{{3}}'}, van tres ejemplos.
                  </li>
                  <li>
                    Opcionales:{' '}
                    <span className="font-mono">categoria, idioma, header, ejemplos_header, footer, descripcion</span>.
                  </li>
                  <li>
                    Si el nombre ya existe, se crea como{' '}
                    <span className="font-mono text-foreground">_v2</span>,{' '}
                    <span className="font-mono text-foreground">_v3</span>, etc.
                  </li>
                </ul>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDescargarEjemplo}
                  className="gap-2 mt-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar Excel de ejemplo
                </Button>
              </div>

              <div className="rounded-md border border-dashed border-border p-6 text-center">
                {parsing ? (
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <FileSpreadsheet className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {fileName ? 'Cambiar archivo' : 'Seleccionar archivo'}
                    </Button>
                    {fileName && (
                      <p className="text-xs text-muted-foreground mt-2">{fileName}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">.xlsx, .xls o .csv</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFile}
                  className="hidden"
                />
              </div>
            </>
          )}

          {error && (
            <div className="p-3 rounded-md border border-destructive/20 bg-destructive/10 text-sm text-destructive">
              {error}
            </div>
          )}

          {!respuesta && rows.length > 0 && (
            <div className="rounded-md border border-border p-4 space-y-3 text-sm">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modoPiloto}
                  onChange={(e) => setModoPiloto(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">Enviar solo un piloto</span>
                  <span className="block text-xs text-muted-foreground">
                    Crea las primeras{' '}
                    <input
                      type="number"
                      min={1}
                      max={validas.length}
                      value={pilotoN}
                      disabled={!modoPiloto}
                      onClick={(e) => e.preventDefault()}
                      onChange={(e) =>
                        setPilotoN(Math.max(1, Math.min(validas.length, Number(e.target.value) || 1)))
                      }
                      className="w-14 mx-1 px-1 py-0.5 rounded border border-border bg-background disabled:opacity-50"
                    />{' '}
                    de {validas.length}. Espera a que Meta las revise y, si aprueban, vuelve a subir
                    el mismo archivo con la opción “omitir” de abajo para crear las restantes.
                  </span>
                </span>
              </label>

              <div className="space-y-1">
                <p className="font-medium">Si el nombre ya existe</p>
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={siNombreExiste === 'versionar'}
                      onChange={() => setSiNombreExiste('versionar')}
                    />
                    Crear una versión nueva (<span className="font-mono">_v2</span>,{' '}
                    <span className="font-mono">_v3</span>…)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={siNombreExiste === 'omitir'}
                      onChange={() => setSiNombreExiste('omitir')}
                    />
                    Omitir si ya existe con el mismo mensaje — para resubir el mismo archivo sin
                    duplicar lo ya creado
                  </label>
                  <p className="pl-6 text-[11px] leading-relaxed">
                    Si el nombre coincide pero el mensaje es distinto, se crea igual como versión:
                    es otra plantilla y omitirla la perdería.
                  </p>
                </div>
              </div>
            </div>
          )}

          {progreso && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Creando en Meta… {progreso.procesadas} de {progreso.total}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {Math.round((progreso.procesadas / progreso.total) * 100)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${(progreso.procesadas / progreso.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                No cierres esta ventana. Toma alrededor de un segundo por plantilla.
              </p>
            </div>
          )}

          {!respuesta && rows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Badge variant="default">{validas.length} listas para crear</Badge>
                {invalidas.length > 0 && (
                  <Badge variant="destructive">{invalidas.length} con error</Badge>
                )}
              </div>

              <div className="border border-border rounded-md divide-y divide-border max-h-80 overflow-y-auto">
                {rows.map((row) => {
                  const nVars = extraerVariables(row.mensaje).length
                  return (
                    <div key={row.fila} className="p-3 space-y-1.5">
                      <div className="flex items-start gap-2">
                        {row.errores.length > 0 ? (
                          <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm">{row.nombre || '(sin nombre)'}</span>
                            <span className="text-xs text-muted-foreground">fila {row.fila}</span>
                            <Badge variant="outline" className="text-xs">
                              {row.categoria}
                            </Badge>
                            {nVars > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {nVars} variable{nVars > 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 break-words">
                            {row.mensaje || '(sin mensaje)'}
                          </p>
                          {row.ejemplosMensaje.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Ejemplos: {row.ejemplosMensaje.join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>
                      {row.errores.map((e, i) => (
                        <p key={i} className="text-xs text-destructive pl-6">
                          {e}
                        </p>
                      ))}
                      {row.advertencias.map((a, i) => (
                        <p key={i} className="text-xs text-amber-600 pl-6 flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                          {a}
                        </p>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {respuesta && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm flex-wrap">
                <Badge variant="default">{respuesta.resumen.creadas} creadas</Badge>
                {respuesta.resumen.omitidas > 0 && (
                  <Badge variant="outline">{respuesta.resumen.omitidas} omitidas (ya existían)</Badge>
                )}
                {respuesta.resumen.versionadas > 0 && (
                  <Badge variant="secondary">{respuesta.resumen.versionadas} versionadas</Badge>
                )}
                {respuesta.resumen.errores > 0 && (
                  <Badge variant="destructive">{respuesta.resumen.errores} con error</Badge>
                )}
              </div>

              {respuesta.avisoMeta && (
                <div className="p-3 rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-sm">
                  {respuesta.avisoMeta}
                </div>
              )}

              <div className="border border-border rounded-md divide-y divide-border max-h-80 overflow-y-auto">
                {respuesta.resultados.map((r) => (
                  <div key={r.fila} className="p-3 flex items-start gap-2">
                    {r.estado === 'creada' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    ) : r.estado === 'omitida' ? (
                      <MinusCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm">{r.nombreFinal ?? r.nombreSolicitado}</span>
                        <span className="text-xs text-muted-foreground">fila {r.fila}</span>
                        {r.versionado && (
                          <Badge variant="secondary" className="text-xs">
                            renombrada (ya existía {r.nombreSolicitado})
                          </Badge>
                        )}
                      </div>
                      {r.error && <p className="text-xs text-destructive mt-1">{r.error}</p>}
                      {r.nota && <p className="text-xs text-muted-foreground mt-1">{r.nota}</p>}
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                La aprobación de Meta es asíncrona. Usa “Sincronizar con Meta” en unos minutos para
                ver el estado final de cada plantilla.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={subiendo}>
            {respuesta ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!respuesta && (
            <Button type="button" onClick={handleCrear} disabled={subiendo || aEnviar.length === 0}>
              {subiendo ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Crear {aEnviar.length} plantilla{aEnviar.length === 1 ? '' : 's'} en Meta
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
