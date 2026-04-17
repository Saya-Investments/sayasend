'use client'

import Link from 'next/link'
import { mockCampaigns, mockTemplates } from '@/lib/mockData'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye } from 'lucide-react'

export function CampaignsList() {
  const getTemplateNameById = (templateId: string | null) => {
    if (!templateId) return 'Sin plantilla'
    return mockTemplates.find(t => t.id === templateId)?.name || 'Unknown'
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'secondary',
      scheduled: 'outline',
      sending: 'default',
      completed: 'default',
    }
    return colors[status] || 'secondary'
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: 'Borrador',
      scheduled: 'Programada',
      sending: 'Enviando',
      completed: 'Completada',
    }
    return labels[status] || status
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
            {mockCampaigns.map((campaign) => (
              <TableRow key={campaign.id} className="hover:bg-muted/50">
                <TableCell className="font-medium">{campaign.name}</TableCell>
                <TableCell>{getTemplateNameById(campaign.templateId)}</TableCell>
                <TableCell>{new Date(campaign.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Badge variant={getStatusColor(campaign.status) as any}>
                    {getStatusLabel(campaign.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{campaign.totalContacts}</TableCell>
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
