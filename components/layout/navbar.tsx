import Link from 'next/link'
import Image from 'next/image'

export function Navbar() {
  return (
    <div className="border-b border-border bg-card">
      <div className="flex h-16 items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative w-10 h-10">
            <Image
              src="/logo-saya.png"
              alt="SAYA Logo"
              width={40}
              height={40}
              className="w-full h-full"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-primary">SAYASEND</span>
            <span className="text-xs text-muted-foreground">Campaign Manager</span>
          </div>
        </Link>
      </div>
    </div>
  )
}
