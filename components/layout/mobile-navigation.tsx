'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Mail, Menu, MessageCircle, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const items = [
  { title: 'Plantillas', href: '/templates', icon: Mail },
  { title: 'Campañas', href: '/campaigns', icon: Send, excludeHref: '/campaigns/calendar' },
  { title: 'Calendario', href: '/campaigns/calendar', icon: CalendarDays },
  { title: 'Chat', href: '/chat', icon: MessageCircle },
]

export function MobileNavigation() {
  const pathname = usePathname()

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menú">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(20rem,86vw)] p-0">
        <SheetHeader className="border-b px-5 py-5 text-left">
          <SheetTitle>SAYASEND</SheetTitle>
          <SheetDescription>Navegación principal</SheetDescription>
        </SheetHeader>
        <nav className="space-y-2 p-4">
          {items.map((item) => {
            const Icon = item.icon
            const active =
              pathname.startsWith(item.href) &&
              !(item.excludeHref && pathname.startsWith(item.excludeHref))

            return (
              <SheetClose asChild key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex min-h-11 items-center gap-3 rounded-lg px-4 py-3 font-medium transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-muted',
                  )}
                >
                  <Icon className="size-5 shrink-0" />
                  {item.title}
                </Link>
              </SheetClose>
            )
          })}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
