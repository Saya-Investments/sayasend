import Link from 'next/link'
import Image from 'next/image'

import { NavbarUser } from './navbar-user'
import { MobileNavigation } from './mobile-navigation'

export function Navbar() {
  return (
    <div className="border-b border-border bg-card">
      <div className="flex h-16 items-center justify-between gap-2 px-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-1 sm:gap-3">
          <MobileNavigation />
          <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="relative size-9 shrink-0 sm:size-10">
              <Image
                src="/logo-saya.png"
                alt="SAYA Logo"
                width={40}
                height={40}
                className="h-full w-full"
              />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="text-base font-bold text-primary sm:text-lg">SAYASEND</span>
              <span className="hidden text-xs text-muted-foreground sm:block">Campaign Manager</span>
            </div>
          </Link>
        </div>
        <NavbarUser />
      </div>
    </div>
  )
}
