'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Eye,
  Loader2,
  Trash2,
  Check,
  X,
  AlertTriangle,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { deleteCampaign, getCampaignSendStats, type CampaignSendStats } from '@/lib/api'

type CampaignRow = {
  id: string
  nombre: string
  status: string
  totalContacts: number
  createdAt: Date | string
  template: { nombre: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  sending: 'Enviando',
  completed: 'Completada',
  failed: 'Fallida',
}

const STATUS_VARIANT: Record<string, 'secondary' | 'outline' | 'default' | 'destructive'> = {
  draft: 'secondary',
  scheduled: 'outline',
  sending: 'default',
  completed: 'default',
  failed: 'destructive',
}

const PAGE_SIZE = 20

export function CampaignsList({ campaigns }: { campaigns: CampaignRow[] }) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = normalizedQuery
    ? campaigns.filter(
        (c) =>
          c.nombre.toLowerCase().includes(normalizedQuery) ||
          (c.template?.nombre ?? '').toLowerCase().includes(normalizedQuery),
      )
    : campaigns

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const pageItems = filtered.slice(startIndex, startIndex + PAGE_SIZE)

  // Las métricas de envío se piden solo para las filas visibles y se guardan
  // para no volver a pedirlas al navegar entre páginas.
  const [stats, setStats] = useState<Record<string, CampaignSendStats>>({})
  const requestedRef = useRef<Set<string>>(new Set())
  const visibleKey = pageItems.map((c) => c.id).join(',')

  useEffect(() => {
    const missing = (visibleKey ? visibleKey.split(',') : []).filter(
      (id) => !requestedRef.current.has(id),
    )
    if (missing.length === 0) return

    missing.forEach((id) => requestedRef.current.add(id))

    getCampaignSendStats(missing).then((result) => {
      if (!result.success || !result.data) {
        // Se permite reintentar cuando el usuario vuelva a esta página.
        missing.forEach((id) => requestedRef.current.delete(id))
        return
      }

      const data = result.data
      // Una campaña sin contactos no vuelve en la respuesta: se fija en cero
      // para que la fila deje de mostrarse como "cargando".
      setStats((prev) => ({
        ...prev,
        ...Object.fromEntries(
          missing.map((id) => [id, data[id] ?? { enviados: 0, fallidos: 0 }]),
        ),
      }))
    })
  }, [visibleKey])

  const handleDelete = async (campaign: CampaignRow) => {
    const warning =
      campaign.status === 'completed'
        ? `\n\nOJO: ya fue enviada. Se borrará también su historial de mensajes y sus métricas de entrega. Esto no se puede deshacer.`
        : ''

    if (!confirm(`¿Borrar la campaña "${campaign.nombre}"?${warning}`)) return

    setDeletingId(campaign.id)
    setError(null)
    try {
      const result = await deleteCampaign(campaign.id)
      if (result.success) {
        router.refresh()
      } else {
        setError(result.error ?? 'Error al borrar la campaña.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al borrar la campaña.')
    } finally {
      setDeletingId(null)
    }
  }

  const renderStats = (campaignId: string) => {
    const row = stats[campaignId]
    if (!row) {
      return <Loader2 className="mx-auto size-3.5 animate-spin text-muted-foreground" />
    }

    const { enviados, fallidos } = row
    const procesados = enviados + fallidos
    if (procesados === 0) {
      return <span className="text-sm text-muted-foreground">—</span>
    }

    const failRate = fallidos / procesados
    const grave = failRate >= 0.5
    return (
      <div
        className="flex items-center justify-center gap-3 text-sm"
        title={`${enviados} enviados · ${fallidos} fallidos`}
      >
        <span className="flex items-center gap-1 font-medium tabular-nums text-green-600 dark:text-green-500">
          <Check className="size-3.5" />
          {enviados}
        </span>
        <span
          className={`flex items-center gap-1 font-medium tabular-nums ${
            fallidos > 0 ? 'text-red-600 dark:text-red-500' : 'text-muted-foreground'
          }`}
        >
          <X className="size-3.5" />
          {fallidos}
        </span>
        {grave && (
          <span
            className="flex items-center gap-1 font-semibold text-red-600 dark:text-red-500"
            title={`${Math.round(failRate * 100)}% falló — revisar`}
          >
            <AlertTriangle className="size-4" />
          </span>
        )}
      </div>
    )
  }

  if (campaigns.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg p-12 text-center">
        <p className="text-muted-foreground">
          No hay campañas todavía. Crea una nueva desde el botón de arriba.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(1)
          }}
          placeholder="Buscar por campaña o plantilla..."
          className="pl-9"
        />
      </div>

      <div className="space-y-3 md:hidden">
        {pageItems.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No se encontraron campañas para “{query}”.
          </div>
        )}
        {pageItems.map((campaign) => (
          <div key={campaign.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <Link href={`/campaigns/${campaign.id}`} className="block truncate font-semibold hover:underline">
                  {campaign.nombre}
                </Link>
                <p className="truncate text-sm text-muted-foreground">
                  {campaign.template?.nombre ?? 'Sin plantilla'}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="-mr-2 -mt-2 shrink-0">
                    {deletingId === campaign.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <MoreHorizontal className="size-4" />
                    )}
                    <span className="sr-only">Acciones</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/campaigns/${campaign.id}`}>
                      <Eye className="size-4" />
                      Ver
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => handleDelete(campaign)}
                    disabled={campaign.status === 'sending' || deletingId === campaign.id}
                  >
                    <Trash2 className="size-4" />
                    Borrar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Estado</p>
                <Badge className="mt-1" variant={STATUS_VARIANT[campaign.status] ?? 'secondary'}>
                  {STATUS_LABEL[campaign.status] ?? campaign.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Contactos</p>
                <p className="mt-1 font-semibold tabular-nums">{campaign.totalContacts}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Envíos</p>
                <div className="mt-1">{renderStats(campaign.id)}</div>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Creada el {new Date(campaign.createdAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-border md:block">
        <div>
          <Table className="w-full [&_th]:px-5 [&_td]:px-5">
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead>Nombre</TableHead>
                <TableHead>Plantilla</TableHead>
                <TableHead>Fecha Creación</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Contactos</TableHead>
                <TableHead className="text-center">Envíos</TableHead>
                <TableHead className="text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No se encontraron campañas para “{query}”.
                  </TableCell>
                </TableRow>
              )}
              {pageItems.map((campaign) => (
                <TableRow key={campaign.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{campaign.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {campaign.template?.nombre ?? 'Sin plantilla'}
                  </TableCell>
                  <TableCell>{new Date(campaign.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[campaign.status] ?? 'secondary'}>
                      {STATUS_LABEL[campaign.status] ?? campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{campaign.totalContacts}</TableCell>
                  <TableCell className="text-center">{renderStats(campaign.id)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            {deletingId === campaign.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="w-4 h-4" />
                            )}
                            <span className="sr-only">Acciones</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/campaigns/${campaign.id}`}>
                              <Eye className="w-4 h-4" />
                              Ver
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => handleDelete(campaign)}
                            disabled={campaign.status === 'sending' || deletingId === campaign.id}
                          >
                            <Trash2 className="w-4 h-4" />
                            Borrar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-center text-sm text-muted-foreground sm:text-left">
            Mostrando {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, filtered.length)} de{' '}
            {filtered.length}
          </p>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1 px-2 sm:px-3"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 px-2 sm:px-3"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
