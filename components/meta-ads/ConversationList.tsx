'use client'

import { MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface Conversation {
  id: string
  title: string
  updated_at: string
}

interface ConversationListProps {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  loading: boolean
}

export function ConversationList({ conversations, activeId, onSelect, loading }: ConversationListProps) {
  if (loading) {
    return (
      <div className="flex-1 p-3 space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-gray-400 text-sm text-center">
        No hay conversaciones aún
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {conversations.map(conv => (
        <button
          key={conv.id}
          onClick={() => onSelect(conv.id)}
          className={cn(
            'w-full text-left px-3 py-2.5 rounded-lg transition-colors text-sm group',
            activeId === conv.id
              ? 'bg-purple-100 text-purple-700'
              : 'hover:bg-gray-100 text-gray-700'
          )}
        >
          <div className="flex items-start gap-2">
            <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-50" />
            <div className="min-w-0">
              <p className="truncate font-medium">{conv.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(conv.updated_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
