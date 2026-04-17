'use client'

import Link from 'next/link'
import { Eye } from 'lucide-react'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

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
}

const STATUS_VARIANT: Record<string, 'secondary' | 'outline' | 'default' | 'destructive'> = {
  draft: 'secondary',
  scheduled: 'outline',
  sending: 'default',
  completed: 'default',
}

export function CampaignsList({ campaigns }: { campaigns: CampaignRow[] }) {
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
              <TableHead className="text-center">Detalle</TableHead>
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
                <TableCell className="text-center">
                  <Link href={`/campaigns/${campaign.id}`}>
                    <Button size="sm" variant="ghost" className="gap-2">
                      <Eye className="w-4 h-4" />
                      Ver
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
