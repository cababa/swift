"use client"

import { ChatWindow } from '@/components/ChatWindow'
import { FactsForNerds } from '@/components/FactsForNerds'

interface Message {
  role: "user" | "model";
  content: string;
  latency?: number;
}

interface ChatInterfaceProps {
  onSendMessage: (message: string) => void;
  transcribedText: string;
  isPending: boolean;
  messages: Message[];
}

export default function ChatInterface({ onSendMessage, transcribedText, isPending, messages }: ChatInterfaceProps) {
  return (
    <div className="flex flex-col lg:flex-row w-full max-w-7xl mx-auto gap-6 p-4">
      <ChatWindow 
        messages={messages} 
        onSendMessage={onSendMessage} 
        transcribedText={transcribedText} 
        isPending={isPending}
      />
      <FactsForNerds />
    </div>
  )
}