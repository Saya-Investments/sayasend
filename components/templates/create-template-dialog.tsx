'use client'

import { useState, useRef } from 'react'
import { Loader2, Upload, X } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  MEDIA_HEADER_RULES,
  isMediaHeaderType,
  validateMediaFile,
  type MediaHeaderType,
} from '@/lib/template-media'
import { uploadTemplateMedia } from '@/lib/upload-template-media'

type HeaderType = 'NONE' | 'TEXT' | MediaHeaderType

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function CreateTemplateDialog({ open, onOpenChange, onCreated }: Props) {
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [nombre, setNombre] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [categoria, setCategoria] = useState<'MARKETING' | 'UTILITY' | 'AUTHENTICATION'>('MARKETING')
  const [idioma, setIdioma] = useState('es_CO')
  const [headerType, setHeaderType] = useState<HeaderType>('NONE')
  const [header, setHeader] = useState('')
  const [footer, setFooter] = useState('')
  const [ejemplosTexto, setEjemplosTexto] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const mediaHeaderType = isMediaHeaderType(headerType) ? headerType : null
  const mediaRules = mediaHeaderType ? MEDIA_HEADER_RULES[mediaHeaderType] : null

  const reset = () => {
    setNombre('')
    setMensaje('')
    setDescripcion('')
    setCategoria('MARKETING')
    setIdioma('es_CO')
    setHeaderType('NONE')
    setHeader('')
    setFooter('')
    setEjemplosTexto('')
    setMediaFile(null)
    setMediaPreview(null)
    setError(null)
  }

  // Cambiar el tipo de header invalida el archivo elegido (un MP4 no sirve
  // para un header IMAGE y viceversa).
  const handleHeaderTypeChange = (value: HeaderType) => {
    setHeaderType(value)
    clearMedia()
    setError(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !mediaHeaderType) {
      setMediaFile(null)
      setMediaPreview(null)
      return
    }

    // Validaciones cliente-side (las mismas que corre la API)
    const invalid = validateMediaFile(mediaHeaderType, file.type, file.size)
    if (invalid) {
      setError(invalid)
      return
    }

    setError(null)
    setMediaFile(file)
    // objectURL en vez de FileReader: un video de 16MB en base64 sería enorme
    // y bloquearía el render.
    setMediaPreview(URL.createObjectURL(file))
  }

  const clearMedia = () => {
    setMediaPreview((current) => {
      if (current?.startsWith('blob:')) URL.revokeObjectURL(current)
      return null
    })
    setMediaFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (mediaHeaderType && !mediaFile) {
      setError(`Cuando el header es ${mediaHeaderType}, hay que subir un ${mediaRules?.label}`)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const ejemplos_mensaje = ejemplosTexto
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      // El archivo va primero directo a GCS (signed URL). Recién después se
      // crea la template mandando solo el objectPath, así el body del POST
      // queda chico y no choca con el límite de 4.5MB de Vercel.
      let headerObjectPath: string | null = null
      if (mediaHeaderType && mediaFile) {
        setUploadProgress(`Subiendo ${mediaRules?.label} a Cloud Storage…`)
        headerObjectPath = (await uploadTemplateMedia(mediaFile, mediaHeaderType)).objectPath
        setUploadProgress('Creando la plantilla en Meta…')
      }

      const templateData = {
        nombre,
        mensaje,
        descripcion: descripcion || undefined,
        categoria,
        idioma,
        headerType,
        header: headerType === 'TEXT' ? header || null : null,
        headerObjectPath,
        footer: footer || null,
        ejemplos_mensaje: ejemplos_mensaje.length > 0 ? ejemplos_mensaje : undefined,
      }

      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData),
      })

      const result = await response.json()
      if (!result.success) throw new Error(result.error ?? 'Error creando plantilla')
      reset()
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
      setUploadProgress(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva plantilla</DialogTitle>
          <DialogDescription>
            La plantilla se crea en Meta Business y queda pendiente de aprobación.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="ej: bienvenida_colombia"
              required
            />
            <p className="text-xs text-muted-foreground">
              Se normaliza automáticamente a snake_case (Meta solo acepta a-z, 0-9, _).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoría</Label>
              <Select
                value={categoria}
                onValueChange={(v) =>
                  setCategoria(v as 'MARKETING' | 'UTILITY' | 'AUTHENTICATION')
                }
              >
                <SelectTrigger id="categoria">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="UTILITY">Utility</SelectItem>
                  <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="idioma">Idioma</Label>
              <Input
                id="idioma"
                value={idioma}
                onChange={(e) => setIdioma(e.target.value)}
                placeholder="es_CO"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="headerType">Tipo de header</Label>
            <Select
              value={headerType}
              onValueChange={(v) => handleHeaderTypeChange(v as HeaderType)}
            >
              <SelectTrigger id="headerType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Sin header</SelectItem>
                <SelectItem value="TEXT">Texto</SelectItem>
                <SelectItem value="IMAGE">Imagen</SelectItem>
                <SelectItem value="VIDEO">Video</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {headerType === 'TEXT' && (
            <div className="space-y-2">
              <Label htmlFor="header">Texto del header</Label>
              <Input
                id="header"
                value={header}
                onChange={(e) => setHeader(e.target.value)}
                placeholder="Ej: Hola {{1}}"
              />
            </div>
          )}

          {mediaHeaderType && mediaRules && (
            <div className="space-y-2">
              <Label htmlFor="media">
                {mediaHeaderType === 'VIDEO' ? 'Video' : 'Imagen'} del header *
              </Label>
              {mediaPreview ? (
                <div className="relative rounded-md border border-border overflow-hidden">
                  {mediaHeaderType === 'VIDEO' ? (
                    <video
                      src={mediaPreview}
                      controls
                      className="max-h-48 w-full object-contain bg-muted"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaPreview}
                      alt="preview"
                      className="max-h-48 w-full object-contain bg-muted"
                    />
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={clearMedia}
                    className="absolute top-2 right-2 gap-1"
                  >
                    <X className="w-3 h-3" />
                    Quitar
                  </Button>
                  <p className="p-2 text-xs text-muted-foreground bg-muted/50">
                    {mediaFile?.name} ·{' '}
                    {mediaFile ? (mediaFile.size / 1024 / 1024).toFixed(2) : 0} MB
                  </p>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border p-6 text-center">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    size="sm"
                  >
                    Seleccionar {mediaRules.label}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">{mediaRules.hint}</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={mediaRules.mimeTypes.join(',')}
                onChange={handleFileChange}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground">
                El archivo se sube a Google Cloud Storage (para poder verlo desde el CRM) y
                también a Meta, que lo revisa para aprobar la plantilla.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="mensaje">Mensaje *</Label>
            <Textarea
              id="mensaje"
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Hola {{1}}, tu cuota de {{2}} vence el {{3}}. ¡Paga aquí!"
              rows={5}
              required
            />
            <p className="text-xs text-muted-foreground">
              Usa {'{{1}}'}, {'{{2}}'}... para las variables.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ejemplos">Ejemplos de variables (separadas por coma)</Label>
            <Input
              id="ejemplos"
              value={ejemplosTexto}
              onChange={(e) => setEjemplosTexto(e.target.value)}
              placeholder="Juan, 150.000, 30 de noviembre"
            />
            <p className="text-xs text-muted-foreground">
              Meta requiere ejemplos para aprobar plantillas con variables.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="footer">Footer (opcional)</Label>
            <Input
              id="footer"
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              placeholder="Saya Investments"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción interna (opcional)</Label>
            <Input
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Solo para ti, no se envía a Meta"
            />
          </div>

          {uploadProgress && (
            <div className="p-3 rounded-md border border-border bg-muted text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {uploadProgress}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-md border border-destructive/20 bg-destructive/10 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                loading ||
                !nombre ||
                !mensaje ||
                (mediaHeaderType !== null && !mediaFile)
              }
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Crear en Meta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
