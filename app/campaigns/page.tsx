'use client'

import Link from 'next/link'
import { AppLayout } from '@/components/layout/app-layout'
import { CampaignsList } from '@/components/campaigns/campaigns-list'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default function CampaignsPage() {
  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Campañas</h1>
            <p className="text-muted-foreground mt-2">Create and manage your messaging campaigns</p>
          </div>
          <Link href="/campaigns/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nueva Campaña
            </Button>
          </Link>
        </div>

        <CampaignsList />
      </div>
    </AppLayout>
  )
}
