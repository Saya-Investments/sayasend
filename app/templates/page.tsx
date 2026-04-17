import { AppLayout } from '@/components/layout/app-layout'
import { TemplatesClient } from '@/components/templates/templates-client'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function TemplatesPage() {
  const templates = await prisma.template.findMany({
    orderBy: { createdAt: 'desc' },
  })

  const serialized = templates.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }))

  return (
    <AppLayout>
      <TemplatesClient initialTemplates={serialized} />
    </AppLayout>
  )
}
