'use client'

import Link from 'next/link'
import { AppLayout } from '@/components/layout/app-layout'
import { CampaignForm } from '@/components/campaigns/campaign-form'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function NewCampaignPage() {
  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto mb-6 flex max-w-4xl items-start gap-2 sm:mb-8 sm:items-center sm:gap-4">
          <Link href="/campaigns">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Volver</span>
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Crear Campaña</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:mt-2 sm:text-base">Create a new messaging campaign</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <CampaignForm />
        </div>
      </div>
    </AppLayout>
  )
}
