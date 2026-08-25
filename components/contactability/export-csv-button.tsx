'use client'

import { Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ContactabilityScope } from '@/lib/campaign-contactability'
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

const SCOPE_LABELS: Record<ContactabilityScope, string> = {
  global: 'global',
  principal: 'del teléfono principal',
  alterno: 'del teléfono secundario',
}

export function ExportCsvButton({
  campaignId,
  scope,
}: {
  campaignId: string
  scope: ContactabilityScope
}) {
  const handleExport = (status: string | null) => {
    const searchParams = new URLSearchParams({ scope })
    if (status) searchParams.set('status', status)
    window.location.href = `/api/campaigns/${campaignId}/export?${searchParams.toString()}`
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
        <DropdownMenuLabel>Contactabilidad {SCOPE_LABELS[scope]}</DropdownMenuLabel>
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
