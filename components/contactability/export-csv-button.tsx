'use client'

import { Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type ExportOption = {
  label: string
  status: string | null
}

const OPTIONS: ExportOption[] = [
  { label: 'Todos los contactos', status: null },
  { label: 'Solo entregados', status: 'delivered' },
  { label: 'Solo leídos', status: 'read' },
  { label: 'Solo fallidos', status: 'failed' },
  { label: 'Solo enviados (sin entregar)', status: 'sent' },
  { label: 'Solo pendientes', status: 'pending' },
]

export function ExportCsvButton({ campaignId }: { campaignId: string }) {
  const handleExport = (status: string | null) => {
    const url = status
      ? `/api/campaigns/${campaignId}/export?status=${status}`
      : `/api/campaigns/${campaignId}/export`
    window.location.href = url
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          Exportar CSV
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Exportar contactos por estado</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map((opt) => (
          <DropdownMenuItem key={opt.label} onClick={() => handleExport(opt.status)}>
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
