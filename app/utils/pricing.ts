// app/utils/pricing.ts

export const PRICING = {
    gemini: {
        inputPerMillion: 1.25, // $ per million tokens
        outputPerMillion: 5.00,
    },
    whisper: {
        perHour: 0.111, // $ per hour
    },
    openaiTTS: {
        perMillionCharacters: 15.00, // $ per million characters
    },
};

// Calculate Gemini LLM costs
export function calculateGeminiCost(inputTokens: number, outputTokens: number): { llmInputCost: number; llmOutputCost: number; llmTotalCost: number } {
    const llmInputCost = (inputTokens / 1_000_000) * PRICING.gemini.inputPerMillion;
    const llmOutputCost = (outputTokens / 1_000_000) * PRICING.gemini.outputPerMillion;
    const llmTotalCost = llmInputCost + llmOutputCost;
    return { llmInputCost, llmOutputCost, llmTotalCost };
}

// Calculate Whisper costs
export function calculateWhisperCost(durationSeconds: number): { whisperHours: number; whisperCost: number } {
    const whisperHours = durationSeconds / 3600;
    const whisperCost = whisperHours * PRICING.whisper.perHour;
    return { whisperHours, whisperCost };
}

// Calculate TTS costs
export function calculateTTSCost(characters: number): { ttsCharacters: number; ttsCost: number } {
    const ttsCharacters = characters;
    const ttsCost = (ttsCharacters / 1_000_000) * PRICING.openaiTTS.perMillionCharacters;
    return { ttsCharacters, ttsCost };
}

// Calculate Total Cost
export function calculateTotalCost(llmCost: number, whisperCost: number, ttsCost: number): number {
    return llmCost + whisperCost + ttsCost;
}