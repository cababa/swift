// app/components/ChatContext.tsx

import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { usePlayer } from "@/lib/usePlayer";
import { toast } from "sonner";
import debounce from 'lodash.debounce';

interface Message {
  role: 'user' | 'model';
  content: string;
}

interface CostData {
  llmInputTokens: number;
  llmOutputTokens: number;
  llmInputCost: number;
  llmOutputCost: number;
  llmTotalCost: number;
  whisperDurationSeconds: number;
  whisperHours: number;
  whisperCost: number;
  ttsCharacters: number;
  ttsCost: number;
  totalCost: number;
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
  costData: CostData | null;
  setCostData: (data: CostData | null) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [transcribedText, setTranscribedText] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [isLiveTranscriptionActive, setIsLiveTranscriptionActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sessionId') || undefined;
    }
    return undefined;
  });
  const [costData, setCostData] = useState<CostData | null>(null);
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

  const debouncedSubmit = useRef(
    debounce(async (data: string | Blob) => {
      await submit(data);
    }, 300)
  ).current;

  const handleSubmit = (data: string | Blob): Promise<void> => {
    return new Promise<void>((resolve) => {
      debouncedSubmit(data);
      resolve();
    });
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

      // Extract cost data
      const costDataHeader = response.headers.get("X-Cost-Data");
      let newCostData: CostData | null = null;
      if (costDataHeader) {
        try {
          newCostData = JSON.parse(decodeURIComponent(costDataHeader));
        } catch (error) {
          console.error("Error parsing cost data:", error);
        }
      }

      // Update cost data with accumulation logic
      setCostData((prevCostData) => {
        if (!newCostData) return prevCostData; // If no new data, return previous data
        // If there is no previous cost data, simply set the new data
        if (!prevCostData) return newCostData;
        // Accumulate the new costs onto the previous costs
        return {
          llmInputTokens: prevCostData.llmInputTokens + newCostData.llmInputTokens,
          llmOutputTokens: prevCostData.llmOutputTokens + newCostData.llmOutputTokens,
          llmInputCost: prevCostData.llmInputCost + newCostData.llmInputCost,
          llmOutputCost: prevCostData.llmOutputCost + newCostData.llmOutputCost,
          llmTotalCost: prevCostData.llmTotalCost + newCostData.llmTotalCost,
          whisperDurationSeconds: prevCostData.whisperDurationSeconds + newCostData.whisperDurationSeconds,
          whisperHours: prevCostData.whisperHours + newCostData.whisperHours,
          whisperCost: prevCostData.whisperCost + newCostData.whisperCost,
          ttsCharacters: prevCostData.ttsCharacters + newCostData.ttsCharacters,
          ttsCost: prevCostData.ttsCost + newCostData.ttsCost,
          totalCost: prevCostData.totalCost + newCostData.totalCost,
        };
      });

      // Check if TTS failed
      const ttsFailed = response.headers.get("X-TTS-Failed") === "true";

      if (!response.ok || !transcript || !text) {
        throw new Error("Invalid response");
      }

      setTranscribedText(transcript);
      addMessage({ role: "user", content: transcript });
      addMessage({ role: "model", content: text });

      if (!ttsFailed && response.body) {
        player.play(response.body);
      } else {
        console.warn("TTS playback failed. Using client-side TTS as a fallback.");
        toast.error("Audio playback is unavailable. Using your browser's speech synthesis.");
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(text);
          window.speechSynthesis.speak(utterance);
        } else {
          console.warn("Speech Synthesis API not supported in this browser.");
        }
      }
    } catch (error) {
      console.error("Error submitting message:", error);
      toast.error("An error occurred while processing your request.");
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
        submit: handleSubmit,
        costData,
        setCostData,
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