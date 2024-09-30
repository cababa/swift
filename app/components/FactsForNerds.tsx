// FactsForNerds.tsx
import { useChatContext } from './ChatContext'
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { useState } from 'react'

export function FactsForNerds() {
  const { costData, setCostData } = useChatContext()

  const [systemInstructions, setSystemInstructions] = useState(
    "You are a helpful AI assistant. Answer questions accurately and concisely."
  )
  const [temperature, setTemperature] = useState(0.7)

  return (
    <Card className="w-full lg:w-96">
      <CardHeader>
        <CardTitle>Facts for Nerds</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          {/* Gemini LLM */}
          <div>
            <Label>Input Tokens</Label>
            <p className="text-2xl font-bold">{costData ? Math.floor(costData.llmInputTokens) : 0}</p>
          </div>
          <div>
            <Label>Output Tokens</Label>
            <p className="text-2xl font-bold">{costData ? Math.floor(costData.llmOutputTokens) : 0}</p>
          </div>
          <div>
            <Label>Total Tokens</Label>
            <p className="text-2xl font-bold">{costData ? Math.floor(costData.llmInputTokens + costData.llmOutputTokens) : 0}</p>
          </div>
          <div>
            <Label>LLM Input Cost</Label>
            <p className="text-2xl font-bold">${costData ? costData.llmInputCost.toFixed(6) : "0.000000"}</p>
          </div>
          <div>
            <Label>LLM Output Cost</Label>
            <p className="text-2xl font-bold">${costData ? costData.llmOutputCost.toFixed(6) : "0.000000"}</p>
          </div>
          <div>
            <Label>LLM Total Cost</Label>
            <p className="text-2xl font-bold">${costData ? costData.llmTotalCost.toFixed(6) : "0.000000"}</p>
          </div>

          {/* Whisper STT */}
          <div>
            <Label>Whisper Duration</Label>
            <p className="text-2xl font-bold">{costData ? costData.whisperDurationSeconds.toFixed(2) : 0} s</p>
          </div>
          <div>
            <Label>Whisper Cost</Label>
            <p className="text-2xl font-bold">${costData ? costData.whisperCost.toFixed(6) : "0.000000"}</p>
          </div>

          {/* OpenAI TTS */}
          <div>
            <Label>TTS Characters</Label>
            <p className="text-2xl font-bold">{costData ? costData.ttsCharacters : 0}</p>
          </div>
          <div>
            <Label>TTS Cost</Label>
            <p className="text-2xl font-bold">${costData ? costData.ttsCost.toFixed(6) : "0.000000"}</p>
          </div>

          {/* Total Cost */}
          <div>
            <Label>Total Price</Label>
            <p className="text-2xl font-bold">${costData ? costData.totalCost.toFixed(6) : "0.000000"}</p>
          </div>
        </div>
        <Separator />
        <div className="space-y-2">
          <Label htmlFor="system-instructions">System Instructions</Label>
          <Textarea
            id="system-instructions"
            value={systemInstructions}
            onChange={(e) => setSystemInstructions(e.target.value)}
            rows={4}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="temperature">Temperature</Label>
          <Input
            id="temperature"
            type="number"
            min="0"
            max="1"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
          />
        </div>
      </CardContent>
    </Card>
  )
}