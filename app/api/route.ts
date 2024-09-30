// route.ts
import Groq from "groq-sdk";
import { headers } from "next/headers";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { unstable_after as after } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { sessionManager, ChatMessage } from "./sessionManager"; // Adjust the path as needed
import { v4 as uuidv4 } from 'uuid';
import { calculateGeminiCost, calculateWhisperCost, calculateTTSCost } from '../utils/pricing'; // Adjust path
import { parseBuffer } from 'music-metadata';

// Initialize models once to reuse across requests
const groq = new Groq();
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Pre-configure the generative model
const modelConfig = {
    model: "gemini-1.5-pro",
    systemInstruction: process.env.KETZAI_PROMPT,
    generationConfig: {
        candidateCount: 1,
        maxOutputTokens: 200,
        temperature: 1.0,
    },
};
const generativeModel = genAI.getGenerativeModel(modelConfig);

const schema = zfd.formData({
    input: z.union([zfd.text(), zfd.file()]),
    message: zfd.repeatableOfType(
        zfd.json(
            z.object({
                role: z.enum(["user", "model"]), // Updated roles
                content: z.string(),
            })
        )
    ),
    sessionId: zfd.text().optional(), // Optional session ID
});

export async function POST(request: Request) {
    const requestId = uuidv4(); // Generate a unique request ID
    const vercelId = request.headers.get("x-vercel-id") || "local";

    console.time(`POST /api ${requestId}`); // Unique label

    try {
        // Parse form data
        const formData = await request.formData();
        const { data, success } = schema.safeParse(formData);
        if (!success) {
            console.timeEnd(`POST /api ${requestId}`);
            return new Response("Invalid request", { status: 400 });
        }

        // Extract sessionId if provided, else create a new session
        let sessionId = data.sessionId;
        let chatHistory: ChatMessage[] = [];

        if (sessionId) {
            const existingHistory = sessionManager.getSession(sessionId);
            if (existingHistory) {
                chatHistory = existingHistory;
            } else {
                // If sessionId is invalid, create a new session
                sessionId = undefined;
            }
        }

        if (!sessionId) {
            // Initialize with system prompt
            chatHistory = [
                { role: "user", content: "hi" },
                {
                    role: "model",
                    content:
                        "Hello! I'm here to assist you with your queries. How can I help you today?",
                },
            ];
            sessionId = sessionManager.createSession(chatHistory);
        }

        // Start timing transcription
        console.time(`transcribe ${requestId}`);

        // Start parallel operations
        const transcriptPromise = getTranscript(data.input);

        // Fetch necessary headers once
        const headersList = headers();
        const locationData = location(headersList);
        const currentTime = time(headersList);

        // Wait for transcript
        const { transcript, durationSeconds } = await transcriptPromise;
        if (!transcript) {
            console.timeEnd(`transcribe ${requestId}`);
            return new Response("Invalid audio", { status: 400 });
        }
        console.timeEnd(`transcribe ${requestId}`);

        // Calculate Whisper cost
        const { whisperHours, whisperCost } = calculateWhisperCost(durationSeconds);

        // Add user message to session
        sessionManager.updateSession(sessionId, { role: "user", content: transcript });

        // Count tokens for input (chat history + new message)
        console.time(`countTokens ${requestId}`);
        const countResult = await generativeModel.countTokens({
            generateContentRequest: {
                contents: chatHistory.map(msg => ({
                    role: msg.role,
                    parts: [{ text: msg.content }],
                })),
            },
        });
        console.timeEnd(`countTokens ${requestId}`);

        // Log input tokens and character count
        console.log(
            `Request ${requestId} - Input: ${countResult.totalTokens} tokens, ${transcript.length} characters`
        );

        console.time(`text completion ${requestId}`);

        // Start chat session
        const chat = generativeModel.startChat({
            history: chatHistory.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.content }],
            })),
        });

        // Send the new user message (transcript)
        const result = await chat.sendMessage(transcript);
        const responseText = result.response.text();

        // Update session with model's response
        sessionManager.updateSession(sessionId, { role: "model", content: responseText });

        console.timeEnd(`text completion ${requestId}`);

        // Extract token usage metadata
        const { promptTokenCount, candidatesTokenCount, totalTokenCount } = result.response.usageMetadata || {};

        console.log(
            `Request ${requestId} - Text Completion: Input Tokens: ${promptTokenCount || 0}, Output Tokens: ${candidatesTokenCount || 0}, Total Tokens: ${totalTokenCount || 0}`
        );
        console.log(
            `Request ${requestId} - Response: ${candidatesTokenCount || 0} tokens, ${responseText.length} characters`
        );

        // Calculate LLM costs
        const { llmInputCost, llmOutputCost, llmTotalCost } = calculateGeminiCost(
            promptTokenCount || 0,
            candidatesTokenCount || 0
        );

        // Calculate TTS cost
        const { ttsCharacters, ttsCost } = calculateTTSCost(responseText.length);

        console.time(`openai tts request ${requestId}`);

        // Make a streaming request to OpenAI's TTS API
        const ttsStream = await createTTSStream(responseText);

        if (!ttsStream) {
            console.timeEnd(`openai tts request ${requestId}`);
            console.error(`Request ${requestId} - Voice synthesis failed`);
            return new Response("Voice synthesis failed", { status: 500 });
        }

        console.timeEnd(`openai tts request ${requestId}`);

        // Calculate total cost
        const totalCost = llmTotalCost + whisperCost + ttsCost;

        // Collect all cost data
        const costData = {
            llmInputTokens: promptTokenCount || 0,
            llmOutputTokens: candidatesTokenCount || 0,
            llmInputCost,
            llmOutputCost,
            llmTotalCost,
            whisperDurationSeconds: durationSeconds,
            whisperHours,
            whisperCost,
            ttsCharacters,
            ttsCost,
            totalCost,
        };

        console.log(`Request ${requestId} - Cost Data: `, costData);

        // Encode costData as JSON and set in headers
        const costDataHeader = encodeURIComponent(JSON.stringify(costData));

        console.time(`stream ${requestId}`);
        after(() => {
            console.timeEnd(`stream ${requestId}`);
        });

        return new Response(ttsStream, {
            headers: {
                "Content-Type": "audio/mpeg",
                "X-Transcript": encodeURIComponent(transcript),
                "X-Response": encodeURIComponent(responseText),
                "X-Location": encodeURIComponent(locationData),
                "X-Time": encodeURIComponent(currentTime),
                "X-Session-ID": sessionId, // Return session ID to client
                "X-Cost-Data": costDataHeader, // Include cost data
            },
        });
    } catch (error) {
        console.timeEnd(`POST /api ${requestId}`);
        console.error(`Request ${requestId} - Error:`, error);
        return new Response("Internal Server Error", { status: 500 });
    }
}

function location(headersList: Headers) {
    const country = headersList.get("x-vercel-ip-country");
    const region = headersList.get("x-vercel-ip-country-region");
    const city = headersList.get("x-vercel-ip-city");

    if (!country || !region || !city) return "unknown";

    return `${city}, ${region}, ${country}`;
}

function time(headersList: Headers) {
    return new Date().toLocaleString("en-US", {
        timeZone: headersList.get("x-vercel-ip-timezone") || undefined,
    });
}

async function getTranscript(input: string | File): Promise<{ transcript: string | null; durationSeconds: number }> {
    if (typeof input === "string") return { transcript: input, durationSeconds: 0 };

    try {
        // Read the file buffer
        const arrayBuffer = await input.arrayBuffer();
        const bufferUint8 = new Uint8Array(arrayBuffer);

        // Parse metadata to get duration
        const metadata = await parseBuffer(bufferUint8, input.type, { duration: true });
        const durationSeconds = metadata.format.duration || 0;

        const { text } = await groq.audio.transcriptions.create({
            file: input,
            model: "whisper-large-v3",
        });

        return { transcript: text.trim() || null, durationSeconds };
    } catch (error) {
        console.error("Error in getTranscript:", error);
        return { transcript: null, durationSeconds: 0 }; // Empty or invalid audio file
    }
}

/**
 * Creates a streaming TTS response from OpenAI's API.
 * @param text The input text to convert to speech.
 * @returns A ReadableStream of the audio data or null if failed.
 */
async function createTTSStream(text: string): Promise<ReadableStream<Uint8Array> | null> {
    try {
        // Construct the request payload
        const payload = {
            model: "tts-1",
            voice: "nova",
            input: text,
            response_format: "mp3",
            stream: true, // Enable streaming
        };

        // Make the request using fetch to have control over the streaming response
        const response = await fetch("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok || !response.body) {
            console.error(`OpenAI TTS API error: ${response.status} ${response.statusText}`);
            return null;
        }

        // Return the ReadableStream directly
        return response.body;
    } catch (error) {
        console.error("Error creating TTS stream:", error);
        return null;
    }
}