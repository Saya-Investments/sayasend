'use client'

import { useCallback, useEffect, useState } from 'react'

import { ConversationsList, type Conversation } from './conversations-list'
import { MessageThread } from './message-thread'

const POLL_MS = 5000

export function ChatClient() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/conversations', { cache: 'no-store' })
      const json = await res.json()
      if (json.success) setConversations(json.data ?? [])
    } catch (e) {
      console.error('[chat] fetchConversations:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
    const id = setInterval(fetchConversations, POLL_MS)
    return () => clearInterval(id)
  }, [fetchConversations])

  const selected =
    conversations.find((c) => c.phone === selectedPhone) ?? null

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      <ConversationsList
        conversations={conversations}
        selectedPhone={selectedPhone}
        onSelect={setSelectedPhone}
        loading={loading}
      />
      <MessageThread
        conversation={selected}
        onMessageSent={fetchConversations}
      />
    </div>
  )
}
