import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"

export function FactsForNerds() {
  const [inputTokens, setInputTokens] = useState(0)
  const [outputTokens, setOutputTokens] = useState(0)
  const [totalTokens, setTotalTokens] = useState(0)
  const [llmPrice, setLlmPrice] = useState(0)
  const [ttsPrice, setTtsPrice] = useState(0)
  const [whisperPrice, setWhisperPrice] = useState(0)
  const [totalPrice, setTotalPrice] = useState(0)
  const [responseTime, setResponseTime] = useState(0)
  const [systemInstructions, setSystemInstructions] = useState(
    "You are a helpful AI assistant. Answer questions accurately and concisely."
  )
  const [temperature, setTemperature] = useState(0.7)

  // Simulating live updates
  useEffect(() => {
    const interval = setInterval(() => {
      setInputTokens(prev => prev + Math.floor(Math.random() * 10))
      setOutputTokens(prev => prev + Math.floor(Math.random() * 20))
      setLlmPrice(prev => prev + Math.random() * 0.0005)
      setTtsPrice(prev => prev + Math.random() * 0.0002)
      setWhisperPrice(prev => prev + Math.random() * 0.0001)
      setResponseTime(prev => prev + Math.random() * 0.1)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Calculate derived values
  useEffect(() => {
    setTotalTokens(inputTokens + outputTokens)
    setTotalPrice(llmPrice + ttsPrice + whisperPrice)
  }, [inputTokens, outputTokens, llmPrice, ttsPrice, whisperPrice])

  return (
    <Card className="w-full lg:w-96">
      <CardHeader>
        <CardTitle>Facts for Nerds</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Input Tokens</Label>
            <p className="text-2xl font-bold">{Math.floor(inputTokens)}</p>
          </div>
          <div>
            <Label>Output Tokens</Label>
            <p className="text-2xl font-bold">{Math.floor(outputTokens)}</p>
          </div>
          <div>
            <Label>Total Tokens</Label>
            <p className="text-2xl font-bold">{Math.floor(totalTokens)}</p>
          </div>
          <div>
            <Label>LLM Price</Label>
            <p className="text-2xl font-bold">${llmPrice.toFixed(4)}</p>
          </div>
          <div>
            <Label>TTS Price</Label>
            <p className="text-2xl font-bold">${ttsPrice.toFixed(4)}</p>
          </div>
          <div>
            <Label>Whisper Price</Label>
            <p className="text-2xl font-bold">${whisperPrice.toFixed(4)}</p>
          </div>
          <div>
            <Label>Total Price</Label>
            <p className="text-2xl font-bold">${totalPrice.toFixed(4)}</p>
          </div>
          <div>
            <Label>Response Time</Label>
            <p className="text-2xl font-bold">{responseTime.toFixed(2)}s</p>
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