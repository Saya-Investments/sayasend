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
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      <div className="w-80 border-r border-border bg-card flex flex-col">
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
      <MessageThread
        conversation={selected}
        onMessageSent={fetchConversations}
      />
    </div>
  )
}
