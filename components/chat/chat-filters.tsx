'use client'

import { useEffect, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

type Campaign = {
  id: string
  nombre: string
  createdAt: string
  totalContacts: number
  status: string
}

type Props = {
  campaignId: string
  onCampaignChange: (id: string) => void
  onlyReplied: boolean
  onOnlyRepliedChange: (v: boolean) => void
}

export function ChatFilters({
  campaignId,
  onCampaignChange,
  onlyReplied,
  onOnlyRepliedChange,
}: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/chat/campaigns', { cache: 'no-store' })
        const json = await res.json()
        if (json.success) setCampaigns(json.data ?? [])
      } catch (e) {
        console.error('[chat] load campaigns:', e)
      }
    })()
  }, [])

  async function handleExport() {
    setExporting(true)
    try {
      const qs = new URLSearchParams()
      if (campaignId && campaignId !== 'all') qs.set('campaignId', campaignId)
      if (onlyReplied) qs.set('onlyReplied', 'true')
      const res = await fetch(`/api/chat/export?${qs.toString()}`)
      if (!res.ok) throw new Error('Error al exportar')
      const blob = await res.blob()
      const filename =
        res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] ??
        'chat-export.xlsx'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('[chat] export:', e)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="border-b border-border p-3 space-y-2 bg-card">
      <div className="flex gap-2 items-center">
        <Select value={campaignId} onValueChange={onCampaignChange}>
          <SelectTrigger className="h-9 text-sm flex-1">
            <SelectValue placeholder="Todas las campañas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las campañas</SelectItem>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="truncate">{c.nombre}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  · {c.totalContacts}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleExport}
          disabled={exporting}
          title="Exportar CSV"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="only-replied"
          checked={onlyReplied}
          onCheckedChange={(v) => onOnlyRepliedChange(v === true)}
        />
        <Label
          htmlFor="only-replied"
          className="text-xs cursor-pointer select-none"
        >
          Solo los que respondieron
        </Label>
      </div>
    </div>
  )
}
