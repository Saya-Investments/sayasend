'use client'

import Link from 'next/link'
import { AppLayout } from '@/components/layout/app-layout'
import { CampaignForm } from '@/components/campaigns/campaign-form'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function NewCampaignPage() {
  return (
    <AppLayout>
      <div className="p-8">
        <div className="max-w-4xl mx-auto flex items-center gap-4 mb-8">
          <Link href="/campaigns">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Volver
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Crear Campaña</h1>
            <p className="text-muted-foreground mt-2">Create a new messaging campaign</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <CampaignForm />
        </div>
      </div>
    </AppLayout>
  )
}
