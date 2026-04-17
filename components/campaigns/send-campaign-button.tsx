'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { sendCampaign } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Send, Loader2 } from 'lucide-react'

type Props = {
  campaignId: string
  currentStatus: string
}

export function SendCampaignButton({ campaignId, currentStatus }: Props) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  )

  const isTerminalStatus = currentStatus === 'completed' || currentStatus === 'sending'
  const isDisabled = isLoading || isTerminalStatus

  const handleSend = async () => {
    if (!confirm('¿Enviar la campaña a todos los contactos pendientes?')) return

    setIsLoading(true)
    setFeedback(null)
    try {
      const result = await sendCampaign(campaignId)
      if (result.success) {
        setFeedback({
          type: 'success',
          message: 'Campaña enviada. La página se actualizará con los nuevos estados.',
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

  return (
    <div className="flex flex-col gap-2 items-end">
      <Button onClick={handleSend} disabled={isDisabled} className="gap-2">
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            {currentStatus === 'completed' ? 'Ya enviada' : 'Enviar campaña'}
          </>
        )}
      </Button>
      {feedback && (
        <p
          className={`text-sm ${
            feedback.type === 'success' ? 'text-green-600' : 'text-destructive'
          }`}
        >
          {feedback.message}
        </p>
      )}
    </div>
  )
}
