import Link from 'next/link'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Send, ArrowRight } from 'lucide-react'

export default function Home() {
  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-8 sm:mb-12">
          <h1 className="mb-2 text-2xl font-bold text-foreground sm:text-4xl">Bienvenido a SAYASEND</h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Plataforma de gestión de campañas de email y mensajería
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Templates Card */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <Link href="/templates" className="block">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="w-6 h-6 text-primary" />
                      Plantillas
                    </CardTitle>
                    <CardDescription>
                      MANEJA TUS PLANTILLAS
                    </CardDescription>
                  </div>
                  <ArrowRight className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Create and manage reusable templates with variables for your campaigns. View, edit, and organize all your message templates in one place.
                </p>
              </CardContent>
            </Link>
          </Card>

          {/* Campaigns Card */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <Link href="/campaigns" className="block">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Send className="w-6 h-6 text-primary" />
                      Campañas
                    </CardTitle>
                    <CardDescription>
                      Manage your campaigns
                    </CardDescription>
                  </div>
                  <ArrowRight className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Create new campaigns, view existing ones, and monitor their performance. Filter contacts by segments and strategies, then send personalized messages.
                </p>
              </CardContent>
            </Link>
          </Card>
        </div>

        <div className="mt-8 rounded-lg border border-border bg-card p-4 sm:mt-12 sm:p-8">
          <h2 className="mb-4 text-xl font-bold text-foreground sm:text-2xl">Quick Start</h2>
          <div className="space-y-3 text-muted-foreground">
            <p className="flex items-start gap-2">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
              Create or select a message template
            </p>
            <p className="flex items-start gap-2">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
              Create a new campaign and select your target audience
            </p>
            <p className="flex items-start gap-2">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
              Map template variables to customer data columns
            </p>
            <p className="flex items-start gap-2">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">4</span>
              Send the campaign and monitor contactability metrics
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
