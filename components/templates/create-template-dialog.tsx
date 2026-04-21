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

type HeaderType = 'NONE' | 'TEXT' | 'IMAGE'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function CreateTemplateDialog({ open, onOpenChange, onCreated }: Props) {
  const [loading, setLoading] = useState(false)
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
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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
    setImageFile(null)
    setImagePreview(null)
    setError(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setImageFile(null)
      setImagePreview(null)
      return
    }

    // Validaciones básicas cliente-side
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen (JPEG, PNG, WebP)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no puede pesar más de 5MB (límite de WhatsApp)')
      return
    }

    setError(null)
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const clearImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (headerType === 'IMAGE' && !imageFile) {
      setError('Cuando el header es IMAGE, hay que subir una imagen')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const ejemplos_mensaje = ejemplosTexto
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const templateData = {
        nombre,
        mensaje,
        descripcion: descripcion || undefined,
        categoria,
        idioma,
        headerType,
        header: headerType === 'TEXT' ? header || null : null,
        footer: footer || null,
        ejemplos_mensaje: ejemplos_mensaje.length > 0 ? ejemplos_mensaje : undefined,
      }

      let response: Response

      if (headerType === 'IMAGE' && imageFile) {
        // Multipart: enviar JSON como campo "data" + archivo como "image"
        const form = new FormData()
        form.append('data', JSON.stringify(templateData))
        form.append('image', imageFile)
        response = await fetch('/api/templates', { method: 'POST', body: form })
      } else {
        // JSON normal
        response = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateData),
        })
      }

      const result = await response.json()
      if (!result.success) throw new Error(result.error ?? 'Error creando plantilla')
      reset()
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
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
            <Select value={headerType} onValueChange={(v) => setHeaderType(v as HeaderType)}>
              <SelectTrigger id="headerType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Sin header</SelectItem>
                <SelectItem value="TEXT">Texto</SelectItem>
                <SelectItem value="IMAGE">Imagen</SelectItem>
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

          {headerType === 'IMAGE' && (
            <div className="space-y-2">
              <Label htmlFor="image">Imagen del header *</Label>
              {imagePreview ? (
                <div className="relative rounded-md border border-border overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="preview" className="max-h-48 w-full object-contain bg-muted" />
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={clearImage}
                    className="absolute top-2 right-2 gap-1"
                  >
                    <X className="w-3 h-3" />
                    Quitar
                  </Button>
                  <p className="p-2 text-xs text-muted-foreground bg-muted/50">
                    {imageFile?.name} · {imageFile ? (imageFile.size / 1024).toFixed(0) : 0} KB
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
                    Seleccionar imagen
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    JPEG, PNG o WebP. Máximo 5MB.
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground">
                Esta imagen se sube a Google Cloud Storage y se usará como cabecera cuando
                envíes esta plantilla. Meta también la revisará para aprobar la plantilla.
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
                (headerType === 'IMAGE' && !imageFile)
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
