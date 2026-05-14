'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { cancelScheduledCampaign, scheduleCampaign, sendCampaign } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarClock, Loader2, Send, XCircle } from 'lucide-react'

type Props = {
  campaignId: string
  currentStatus: string
  scheduledAt?: Date | string | null
}

function toDatetimeLocalValue(value: Date) {
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(
    value.getHours(),
  )}:${pad(value.getMinutes())}`
}

function getDefaultScheduledAt() {
  const date = new Date()
  date.setMinutes(date.getMinutes() + 30)
  date.setSeconds(0, 0)
  return toDatetimeLocalValue(date)
}

export function SendCampaignButton({ campaignId, currentStatus, scheduledAt }: Props) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isScheduling, setIsScheduling] = useState(false)
  const [isCanceling, setIsCanceling] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [scheduledInput, setScheduledInput] = useState(getDefaultScheduledAt)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  )

  const isScheduled = currentStatus === 'scheduled'
  const isTerminalStatus =
    currentStatus === 'completed' || currentStatus === 'sending' || isScheduled
  const isDisabled = isLoading || isTerminalStatus
  const canSchedule = currentStatus === 'draft' || isScheduled
  const scheduledDate = scheduledAt ? new Date(scheduledAt) : null

  const handleSend = async () => {
    if (!confirm('Enviar la campana a todos los contactos pendientes?')) return

    setIsLoading(true)
    setFeedback(null)
    try {
      const result = await sendCampaign(campaignId)
      if (result.success) {
        setFeedback({
          type: 'success',
          message: 'Campana enviada. La pagina se actualizara con los nuevos estados.',
        })
        router.refresh()
      } else {
        setFeedback({ type: 'error', message: result.error ?? 'Error desconocido' })
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Error desconocido',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSchedule = async () => {
    const date = new Date(scheduledInput)
    if (Number.isNaN(date.getTime())) {
      setFeedback({ type: 'error', message: 'Selecciona una fecha y hora valida.' })
      return
    }

    if (date.getTime() <= Date.now()) {
      setFeedback({ type: 'error', message: 'La fecha programada debe ser futura.' })
      return
    }

    setIsScheduling(true)
    setFeedback(null)
    try {
      const result = await scheduleCampaign(campaignId, date.toISOString())
      if (result.success) {
        setFeedback({
          type: 'success',
          message: `Envio programado para ${date.toLocaleString()}.`,
        })
        setIsDialogOpen(false)
        router.refresh()
      } else {
        setFeedback({ type: 'error', message: result.error ?? 'Error desconocido' })
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Error desconocido',
      })
    } finally {
      setIsScheduling(false)
    }
  }

  const handleCancelSchedule = async () => {
    if (!confirm('Cancelar la programacion de esta campana?')) return

    setIsCanceling(true)
    setFeedback(null)
    try {
      const result = await cancelScheduledCampaign(campaignId)
      if (result.success) {
        setFeedback({ type: 'success', message: 'Programacion cancelada.' })
        router.refresh()
      } else {
        setFeedback({ type: 'error', message: result.error ?? 'Error desconocido' })
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Error desconocido',
      })
    } finally {
      setIsCanceling(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex flex-wrap justify-end gap-2">
        {isScheduled ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleCancelSchedule}
            disabled={isCanceling}
            className="gap-2"
          >
            {isCanceling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            Cancelar programacion
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsDialogOpen(true)}
            disabled={!canSchedule || isScheduling}
            className="gap-2"
          >
            <CalendarClock className="w-4 h-4" />
            Programar envio
          </Button>
        )}

        <Button onClick={handleSend} disabled={isDisabled} className="gap-2">
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              {currentStatus === 'completed'
                ? 'Ya enviada'
                : isScheduled
                  ? 'Envio programado'
                  : 'Enviar campana'}
            </>
          )}
        </Button>
      </div>

      {scheduledDate && isScheduled && (
        <p className="text-sm text-muted-foreground">
          Programada para {scheduledDate.toLocaleString()}
        </p>
      )}

      {feedback && (
        <p
          className={`text-sm ${
            feedback.type === 'success' ? 'text-green-600' : 'text-destructive'
          }`}
        >
          {feedback.message}
        </p>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Programar envio</DialogTitle>
            <DialogDescription>
              El cron enviara la campana cuando llegue esta fecha y hora.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="scheduled-at">Fecha y hora</Label>
            <Input
              id="scheduled-at"
              type="datetime-local"
              value={scheduledInput}
              min={toDatetimeLocalValue(new Date())}
              onChange={(event) => setScheduledInput(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSchedule} disabled={isScheduling}>
              {isScheduling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Programando...
                </>
              ) : (
                <>
                  <CalendarClock className="w-4 h-4" />
                  Programar envio
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
