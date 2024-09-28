// route.ts
import Groq from "groq-sdk";
import { headers } from "next/headers";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { unstable_after as after } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { sessionManager, ChatMessage } from "./sessionManager"; // Adjust the path as needed

// Initialize models once to reuse across requests
const groq = new Groq();
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Pre-configure the generative model
const modelConfig = {
    model: "gemini-1.5-flash",
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
                role: z.enum(["user", "model"]), // Changed 'assistant' to 'model'
                content: z.string(),
            })
        )
    ),
    sessionId: zfd.text().optional(), // Optional session ID
});

export async function POST(request: Request) {
    const vercelId = request.headers.get("x-vercel-id") || "local";
    console.time(`POST /api ${vercelId}`);

    // Parse form data
    const formData = await request.formData();
    const { data, success } = schema.safeParse(formData);
    if (!success) {
        console.timeEnd(`POST /api ${vercelId}`);
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
                role: "model", // Changed from 'assistant' to 'model'
                content:
                    "Understood. I'm ready to assist with the History of World Powers. How may I help you?",
            },
        ];
        sessionId = sessionManager.createSession(chatHistory);
    }

    // Start timing transcription
    console.time(`transcribe ${vercelId}`);

    // Start parallel operations
    const transcriptPromise = getTranscript(data.input);

    // Fetch necessary headers once
    const headersList = headers();
    const locationData = location(headersList);
    const currentTime = time(headersList);

    // Wait for transcript
    const transcript = await transcriptPromise;
    if (!transcript) {
        console.timeEnd(`transcribe ${vercelId}`);
        return new Response("Invalid audio", { status: 400 });
    }
    console.timeEnd(`transcribe ${vercelId}`);

    // Add user message to session
    sessionManager.updateSession(sessionId, { role: "user", content: transcript });

    console.time(`text completion ${vercelId}`);

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

    // Update session with assistant's response
    sessionManager.updateSession(sessionId, { role: "model", content: responseText }); // Changed from 'assistant' to 'model'

    console.timeEnd(`text completion ${vercelId}`);
    console.time(`openai tts request ${vercelId}`);

    // Make a streaming request to OpenAI's TTS API
    const ttsStream = await createTTSStream(responseText);

    if (!ttsStream) {
        console.timeEnd(`openai tts request ${vercelId}`);
        console.error("Voice synthesis failed");
        return new Response("Voice synthesis failed", { status: 500 });
    }

    console.timeEnd(`openai tts request ${vercelId}`);
    console.time(`stream ${vercelId}`);
    after(() => {
        console.timeEnd(`stream ${vercelId}`);
    });

    return new Response(ttsStream, {
        headers: {
            "Content-Type": "audio/mpeg",
            "X-Transcript": encodeURIComponent(transcript),
            "X-Response": encodeURIComponent(responseText),
            "X-Location": encodeURIComponent(locationData),
            "X-Time": encodeURIComponent(currentTime),
            "X-Session-ID": sessionId, // Return session ID to client
        },
    });
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

async function getTranscript(input: string | File): Promise<string | null> {
    if (typeof input === "string") return input;

    try {
        const { text } = await groq.audio.transcriptions.create({
            file: input,
            model: "whisper-large-v3",
        });

        return text.trim() || null;
    } catch {
        return null; // Empty or invalid audio file
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