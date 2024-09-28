import React, { useEffect, useRef } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Send, Mic, MicOff } from "lucide-react"
import { useChatContext } from './ChatContext'
import ReactMarkdown from 'react-markdown'

export function ChatWindow() {
  const { 
    messages, 
    transcribedText, 
    setTranscribedText, 
    isPending,
    isLiveTranscriptionActive,
    toggleLiveTranscription,
    submit
  } = useChatContext()
  const [newMessage, setNewMessage] = React.useState('')
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    setNewMessage(transcribedText)
  }, [transcribedText])

  useEffect(() => {
    if (!isLiveTranscriptionActive && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isLiveTranscriptionActive])

  const handleSendMessage = async () => {
    if (newMessage.trim()) {
      const messageToSend = newMessage.trim()
      setNewMessage('')
      setTranscribedText('')
      await submit(messageToSend) // This will add the user message to the context
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <Card className="flex-1 h-[calc(100vh-2rem)] flex flex-col">
      <CardHeader>
        <CardTitle>Conversation</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden flex flex-col">
        <ScrollArea className="flex-grow pr-4 mb-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'model' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    message.role === 'model'
                      ? 'bg-secondary text-secondary-foreground'
                      : 'bg-primary text-primary-foreground'
                  }`}
                >
                  <ReactMarkdown className="text-sm prose dark:prose-invert max-w-none">
                    {message.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            {isPending && (
              <div className="flex justify-start">
                <div className="max-w-[70%] rounded-lg p-3 bg-secondary text-secondary-foreground">
                  <p className="text-sm">Thinking...</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="flex items-center gap-2">
          <div className="relative flex-grow">
            <Input
              ref={inputRef}
              placeholder="Type your message..."
              value={newMessage}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              disabled={isLiveTranscriptionActive || isPending}
              className="pr-20"
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
              <Button 
                onClick={handleSendMessage} 
                disabled={isPending || !newMessage.trim()} 
                size="icon"
                className="p-2"
              >
                <Send className="h-4 w-4" />
                <span className="sr-only">Send message</span>
              </Button>
              <Button 
                onClick={toggleLiveTranscription} 
                variant={isLiveTranscriptionActive ? "secondary" : "destructive"}
                size="icon"
                className={`transition-colors ${
                    isLiveTranscriptionActive ? 'text-gray-500' : 'bg-red-500 hover:bg-red-600'
                }`}
                aria-label={isLiveTranscriptionActive ? "Turn off live transcription" : "Turn on live transcription"}
              >
                {isLiveTranscriptionActive ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}