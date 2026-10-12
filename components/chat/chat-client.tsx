'use client'

import { useCallback, useEffect, useState } from 'react'

import { ConversationsList, type Conversation } from './conversations-list'
import { MessageThread } from './message-thread'
import { ChatFilters } from './chat-filters'

const POLL_MS = 5000

export function ChatClient() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [campaignId, setCampaignId] = useState<string>('all')
  const [onlyReplied, setOnlyReplied] = useState(true)

  const fetchConversations = useCallback(async () => {
    try {
      const qs = new URLSearchParams()
      if (campaignId && campaignId !== 'all') qs.set('campaignId', campaignId)
      if (onlyReplied) qs.set('onlyReplied', 'true')
      const res = await fetch(
        `/api/chat/conversations?${qs.toString()}`,
        { cache: 'no-store' },
      )
      const json = await res.json()
      if (json.success) setConversations(json.data ?? [])
    } catch (e) {
      console.error('[chat] fetchConversations:', e)
    } finally {
      setLoading(false)
    }
  }, [campaignId, onlyReplied])

  useEffect(() => {
    setLoading(true)
    fetchConversations()
    const id = setInterval(fetchConversations, POLL_MS)
    return () => clearInterval(id)
  }, [fetchConversations])

  const selected =
    conversations.find((c) => c.phone === selectedPhone) ?? null

  return (
    <div className="flex h-[calc(100dvh-64px)] min-h-0 overflow-hidden">
      <div
        className={`${selectedPhone ? 'hidden md:flex' : 'flex'} w-full flex-col border-r border-border bg-card md:w-80 md:shrink-0`}
      >
        <ChatFilters
          campaignId={campaignId}
          onCampaignChange={setCampaignId}
          onlyReplied={onlyReplied}
          onOnlyRepliedChange={setOnlyReplied}
        />
        <ConversationsList
          conversations={conversations}
          selectedPhone={selectedPhone}
          onSelect={setSelectedPhone}
          loading={loading}
        />
      </div>
      <div className={`${selectedPhone ? 'flex' : 'hidden md:flex'} min-w-0 flex-1`}>
        <MessageThread
          conversation={selected}
          onMessageSent={fetchConversations}
          onBack={() => setSelectedPhone(null)}
        />
      </div>
    </div>
  )
}
