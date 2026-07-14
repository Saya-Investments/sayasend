'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, Loader2, Trash2 } from 'lucide-react'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { deleteCampaign } from '@/lib/api'

type CampaignRow = {
  id: string
  nombre: string
  status: string
  totalContacts: number
  createdAt: Date | string
  template: { nombre: string } | null
  _count?: { campaignContacts: number }
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  sending: 'Enviando',
  completed: 'Completada',
  failed: 'Fallida',
}

const STATUS_VARIANT: Record<string, 'secondary' | 'outline' | 'default' | 'destructive'> = {
  draft: 'secondary',
  scheduled: 'outline',
  sending: 'default',
  completed: 'default',
  failed: 'destructive',
}

export function CampaignsList({ campaigns }: { campaigns: CampaignRow[] }) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async (campaign: CampaignRow) => {
    const warning =
      campaign.status === 'completed'
        ? `\n\nOJO: ya fue enviada. Se borrará también su historial de mensajes y sus métricas de entrega. Esto no se puede deshacer.`
        : ''

    if (!confirm(`¿Borrar la campaña "${campaign.nombre}"?${warning}`)) return

    setDeletingId(campaign.id)
    setError(null)
    try {
      const result = await deleteCampaign(campaign.id)
      if (result.success) {
        router.refresh()
      } else {
        setError(result.error ?? 'Error al borrar la campaña.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al borrar la campaña.')
    } finally {
      setDeletingId(null)
    }
  }

  if (campaigns.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg p-12 text-center">
        <p className="text-muted-foreground">
          No hay campañas todavía. Crea una nueva desde el botón de arriba.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead>Nombre</TableHead>
                <TableHead>Plantilla</TableHead>
                <TableHead>Fecha Creación</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Contactos</TableHead>
                <TableHead className="text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{campaign.nombre}</TableCell>
                  <TableCell>{campaign.template?.nombre ?? 'Sin plantilla'}</TableCell>
                  <TableCell>{new Date(campaign.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[campaign.status] ?? 'secondary'}>
                      {STATUS_LABEL[campaign.status] ?? campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {campaign._count?.campaignContacts ?? campaign.totalContacts}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Link href={`/campaigns/${campaign.id}`}>
                        <Button size="sm" variant="ghost" className="gap-2">
                          <Eye className="w-4 h-4" />
                          Ver
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-2 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(campaign)}
                        disabled={campaign.status === 'sending' || deletingId === campaign.id}
                      >
                        {deletingId === campaign.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        Borrar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
