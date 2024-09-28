"use client"

import { useState } from 'react'
import { ChatWindow } from '@/components/ChatWindow'
import { FactsForNerds } from '@/components/FactsForNerds'

interface Message {
  id: number;
  sender: 'AI' | 'Student';
  content: string;
}

interface ChatInterfaceProps {
  onSendMessage: (message: string) => void;
  transcribedText: string;
  isPending: boolean;
}

export default function ChatInterface({ onSendMessage, transcribedText, isPending }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])

  const handleSendMessage = (message: string) => {
    const newMessage: Message = {
      id: messages.length + 1,
      sender: 'Student',
      content: message
    }
    setMessages(prevMessages => [...prevMessages, newMessage])
    onSendMessage(message)
  }

  // Add this function to update messages when AI responds
  const addAIMessage = (content: string) => {
    const newMessage: Message = {
      id: messages.length + 1,
      sender: 'AI',
      content: content
    }
    setMessages(prevMessages => [...prevMessages, newMessage])
  }

  return (
    <div className="flex flex-col lg:flex-row w-full max-w-7xl mx-auto gap-6 p-4">
      <ChatWindow 
        messages={messages} 
        onSendMessage={handleSendMessage} 
        transcribedText={transcribedText} 
        isPending={isPending}
      />
      <FactsForNerds />
    </div>
  )
}