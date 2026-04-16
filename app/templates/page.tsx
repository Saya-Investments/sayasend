'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { TemplatesList } from '@/components/templates/templates-list'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default function TemplatesPage() {
  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Plantillas</h1>
            <p className="text-muted-foreground mt-2">Manage your message templates with variables</p>
          </div>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Nueva Plantilla
          </Button>
        </div>

        <TemplatesList />
      </div>
    </AppLayout>
  )
}
