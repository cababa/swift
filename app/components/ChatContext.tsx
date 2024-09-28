// ChatContext.tsx
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { usePlayer } from "@/lib/usePlayer";

interface Message {
  role: 'user' | 'model';
  content: string;
}

interface ChatContextType {
  messages: Message[];
  addMessage: (message: Message) => void;
  transcribedText: string;
  setTranscribedText: (text: string) => void;
  isPending: boolean;
  setIsPending: (isPending: boolean) => void;
  isLiveTranscriptionActive: boolean;
  toggleLiveTranscription: () => void;
  submit: (data: string | Blob) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [transcribedText, setTranscribedText] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [isLiveTranscriptionActive, setIsLiveTranscriptionActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(() => {
    // Initialize sessionId from localStorage if available
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sessionId') || undefined;
    }
    return undefined;
  });
  const player = usePlayer();

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('sessionId', sessionId);
    } else {
      localStorage.removeItem('sessionId');
    }
  }, [sessionId]);

  const addMessage = (message: Message) => {
    setMessages((prevMessages) => [...prevMessages, message]);
  };

  const toggleLiveTranscription = () => {
    setIsLiveTranscriptionActive((prev) => !prev);
  };

  const submit = async (data: string | Blob) => {
    setIsPending(true);
    const formData = new FormData();

    if (sessionId) {
      formData.append("sessionId", sessionId);
    }

    if (typeof data === "string") {
      formData.append("input", data);
    } else {
      formData.append("input", data, "audio.wav");
    }

    try {
      const response = await fetch("/api", {
        method: "POST",
        body: formData,
      });

      const newSessionId = response.headers.get("X-Session-ID");
      if (newSessionId) {
        setSessionId(newSessionId);
      }

      const transcript = decodeURIComponent(
        response.headers.get("X-Transcript") || ""
      );
      const text = decodeURIComponent(
        response.headers.get("X-Response") || ""
      );

      if (!response.ok || !transcript || !text || !response.body) {
        throw new Error("Invalid response");
      }

      setTranscribedText(transcript);
      addMessage({ role: "user", content: transcript });
      addMessage({ role: "model", content: text });

      player.play(response.body);
    } catch (error) {
      console.error("Error submitting message:", error);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <ChatContext.Provider
      value={{
        messages,
        addMessage,
        transcribedText,
        setTranscribedText,
        isPending,
        setIsPending,
        isLiveTranscriptionActive,
        toggleLiveTranscription,
        submit,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}
