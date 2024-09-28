"use client"

import { ChatWindow } from '@/components/ChatWindow'
import { FactsForNerds } from '@/components/FactsForNerds'

export default function ChatInterface() {
  return (
    <div className="flex flex-col lg:flex-row w-full max-w-7xl mx-auto gap-6 p-4">
      <ChatWindow />
      <FactsForNerds />
    </div>
  )
}