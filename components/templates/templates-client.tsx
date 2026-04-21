'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, RefreshCw, Trash2, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreateTemplateDialog } from './create-template-dialog'

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
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  )

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

      {initialTemplates.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground mb-4">
            No hay plantillas todavía. Sincroniza con Meta o crea una nueva.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {initialTemplates.map((t) => (
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
                {t.header && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Header</p>
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
    </div>
  )
}
