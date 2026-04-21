'use client'

import { useEffect, useState } from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

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

  return (
    <div className="border-b border-border p-3 space-y-2 bg-card">
      <Select value={campaignId} onValueChange={onCampaignChange}>
        <SelectTrigger className="h-9 text-sm">
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
