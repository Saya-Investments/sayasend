'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, RefreshCw, Trash2, Loader2, Upload, ImageIcon, Video, Search, FileSpreadsheet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { CreateTemplateDialog } from './create-template-dialog'
import { BulkUploadTemplatesDialog } from './bulk-upload-dialog'
import {
  MEDIA_HEADER_RULES,
  isMediaHeaderType,
  validateMediaFile,
  type MediaHeaderType,
} from '@/lib/template-media'
import { uploadTemplateMedia } from '@/lib/upload-template-media'

type TemplateRow = {
  id: string
  nombre: string
  descripcion: string | null
  contenido: string
  metaId: string | null
  estadoMeta: string | null
  categoria: string | null
  idioma: string | null
  header: string | null
  footer: string | null
  headerType: string | null
  headerMediaUrl: string | null
  createdAt: string
}

const ESTADO_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  APPROVED: 'default',
  PENDING: 'secondary',
  REJECTED: 'destructive',
  PAUSED: 'outline',
  DISABLED: 'outline',
  DELETED_IN_META: 'destructive',
}

const ESTADO_LABEL: Record<string, string> = {
  APPROVED: 'Aprobada',
  PENDING: 'Pendiente',
  REJECTED: 'Rechazada',
  PAUSED: 'Pausada',
  DISABLED: 'Deshabilitada',
  DELETED_IN_META: '⚠️ Eliminada en Meta',
}

export function TemplatesClient({ initialTemplates }: { initialTemplates: TemplateRow[] }) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  )
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const pendingUploadIdRef = useRef<string | null>(null)
  const pendingUploadTypeRef = useRef<MediaHeaderType>('IMAGE')
  // El accept del input cambia según qué plantilla se esté editando
  const [acceptedMimes, setAcceptedMimes] = useState(MEDIA_HEADER_RULES.IMAGE.mimeTypes.join(','))

  const normalizedQuery = query.trim().toLowerCase()
  const filteredTemplates = normalizedQuery
    ? initialTemplates.filter(
        (t) =>
          t.nombre.toLowerCase().includes(normalizedQuery) ||
          (t.descripcion ?? '').toLowerCase().includes(normalizedQuery) ||
          (t.categoria ?? '').toLowerCase().includes(normalizedQuery),
      )
    : initialTemplates

  const handleOpenUpload = (templateId: string, mediaType: MediaHeaderType) => {
    pendingUploadIdRef.current = templateId
    pendingUploadTypeRef.current = mediaType
    setAcceptedMimes(MEDIA_HEADER_RULES[mediaType].mimeTypes.join(','))
    // El accept se acaba de setear, así que el click va en el siguiente tick
    // para que el diálogo del SO ya filtre por el tipo correcto.
    setTimeout(() => fileInputRef.current?.click(), 0)
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const templateId = pendingUploadIdRef.current
    const mediaType = pendingUploadTypeRef.current
    // reset para permitir re-seleccionar el mismo archivo después
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file || !templateId) return

    const invalid = validateMediaFile(mediaType, file.type, file.size)
    if (invalid) {
      setFeedback({ type: 'error', message: invalid })
      return
    }

    setUploadingId(templateId)
    setFeedback(null)
    try {
      // Siempre vía signed URL: un video de 16MB no entra en el body de un
      // route handler de Vercel (límite 4.5MB).
      const { objectPath } = await uploadTemplateMedia(file, mediaType)
      const response = await fetch(`/api/templates/${templateId}/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectPath }),
      })
      const result = await response.json()
      if (!result.success) throw new Error(result.error ?? 'Error subiendo el archivo')
      setFeedback({
        type: 'success',
        message:
          (mediaType === 'VIDEO' ? 'Video actualizado' : 'Imagen actualizada') +
          (result.previousDeleted ? ' (anterior eliminada del bucket)' : ''),
      })
      router.refresh()
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Error desconocido',
      })
    } finally {
      setUploadingId(null)
      pendingUploadIdRef.current = null
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/templates/sync', { method: 'POST' })
      const result = await response.json()
      if (!result.success) throw new Error(result.error ?? 'Error en sync')
      const r = result.resumen
      const partes = [
        `${r.creadas} creadas`,
        `${r.actualizadas} actualizadas`,
      ]
      if (r.borradas > 0) partes.push(`${r.borradas} borradas`)
      if (r.marcadasComoEliminadas > 0)
        partes.push(`${r.marcadasComoEliminadas} marcadas como eliminadas (con campañas asociadas)`)
      if (r.errores > 0) partes.push(`${r.errores} errores`)
      setFeedback({
        type: 'success',
        message: `Sincronizado: ${partes.join(', ')}`,
      })
      router.refresh()
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Error desconocido',
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Borrar plantilla "${nombre}"? También se eliminará de Meta.`)) return
    setFeedback(null)
    try {
      const response = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
      const result = await response.json()
      if (!result.success) throw new Error(result.error ?? 'Error al borrar')
      setFeedback({
        type: 'success',
        message: `"${nombre}" eliminada${result.metaDeleted ? ' (BD + Meta)' : ' (BD, no encontrada en Meta)'}`,
      })
      router.refresh()
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Error desconocido',
      })
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Plantillas</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona tus plantillas de WhatsApp Meta Business
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSync} disabled={syncing} variant="outline" className="gap-2">
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Sincronizar con Meta
          </Button>
          <Button onClick={() => setBulkDialogOpen(true)} variant="outline" className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Cargar desde Excel
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Nueva Plantilla
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`mb-6 p-3 rounded-md border text-sm ${
            feedback.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-destructive/10 border-destructive/20 text-destructive'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {initialTemplates.length > 0 && (
        <div className="relative max-w-sm mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar plantilla..."
            className="pl-9"
          />
        </div>
      )}

      {initialTemplates.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground mb-4">
            No hay plantillas todavía. Sincroniza con Meta o crea una nueva.
          </p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground">
            No se encontraron plantillas para “{query}”.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTemplates.map((t) => (
            <Card
              key={t.id}
              className={`hover:shadow-md transition-shadow ${
                t.estadoMeta === 'DELETED_IN_META' ? 'opacity-60' : ''
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg font-mono">{t.nombre}</CardTitle>
                      {t.estadoMeta && (
                        <Badge variant={ESTADO_VARIANT[t.estadoMeta] ?? 'secondary'}>
                          {ESTADO_LABEL[t.estadoMeta] ?? t.estadoMeta}
                        </Badge>
                      )}
                      {t.categoria && <Badge variant="outline">{t.categoria}</Badge>}
                      {t.idioma && <Badge variant="outline">{t.idioma}</Badge>}
                    </div>
                    {t.descripcion && (
                      <p className="text-sm text-muted-foreground">{t.descripcion}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(t.id, t.nombre)}
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                    Borrar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {isMediaHeaderType(t.headerType) && t.headerMediaUrl && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-muted-foreground">
                        Header ({MEDIA_HEADER_RULES[t.headerType].label})
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={uploadingId === t.id}
                        onClick={() => handleOpenUpload(t.id, t.headerType as MediaHeaderType)}
                        className="gap-2 h-7 text-xs"
                      >
                        {uploadingId === t.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : t.headerType === 'VIDEO' ? (
                          <Video className="w-3 h-3" />
                        ) : (
                          <ImageIcon className="w-3 h-3" />
                        )}
                        Reemplazar
                      </Button>
                    </div>
                    <div className="bg-muted p-2 rounded-md border border-border">
                      {t.headerType === 'VIDEO' ? (
                        <video
                          src={t.headerMediaUrl}
                          controls
                          preload="metadata"
                          className="max-h-40 w-full object-contain rounded"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.headerMediaUrl}
                          alt={`header de ${t.nombre}`}
                          className="max-h-40 w-full object-contain rounded"
                        />
                      )}
                    </div>
                  </div>
                )}
                {isMediaHeaderType(t.headerType) && !t.headerMediaUrl && (
                  <div className="p-3 rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-sm space-y-2">
                    <p>
                      ⚠️ Esta plantilla tiene header {t.headerType} pero no hay URL guardada.
                      No se puede previsualizar hasta que subas un archivo.
                    </p>
                    <Button
                      size="sm"
                      disabled={uploadingId === t.id}
                      onClick={() => handleOpenUpload(t.id, t.headerType as MediaHeaderType)}
                      className="gap-2"
                    >
                      {uploadingId === t.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      Subir {MEDIA_HEADER_RULES[t.headerType].label}
                    </Button>
                  </div>
                )}
                {t.header && !isMediaHeaderType(t.headerType) && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Header (texto)</p>
                    <div className="bg-muted p-3 rounded-md border border-border">
                      <p className="text-sm font-semibold">{t.header}</p>
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Contenido</p>
                  <div className="bg-muted p-4 rounded-md border border-border">
                    <p className="text-sm whitespace-pre-wrap break-words">{t.contenido}</p>
                  </div>
                </div>
                {t.footer && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Footer</p>
                    <div className="bg-muted p-3 rounded-md border border-border">
                      <p className="text-sm text-muted-foreground">{t.footer}</p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground pt-2">
                  Creada {new Date(t.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => {
          setDialogOpen(false)
          setFeedback({
            type: 'success',
            message: 'Plantilla enviada a Meta para aprobación. Puede tardar unos minutos.',
          })
          router.refresh()
        }}
      />

      <BulkUploadTemplatesDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        onFinished={() => router.refresh()}
      />

      {/* Input oculto compartido por todos los botones de "subir/reemplazar media" */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedMimes}
        onChange={handleFileSelected}
        className="hidden"
      />
    </div>
  )
}
