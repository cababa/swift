import Groq from "groq-sdk";
import { headers } from "next/headers";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { unstable_after as after } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

const groq = new Groq();
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const schema = zfd.formData({
    input: z.union([zfd.text(), zfd.file()]),
    message: zfd.repeatableOfType(
        zfd.json(
            z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string(),
            })
        )
    ),
});

export async function POST(request: Request) {
    console.time("transcribe " + request.headers.get("x-vercel-id") || "local");

    const { data, success } = schema.safeParse(await request.formData());
    if (!success) return new Response("Invalid request", { status: 400 });

    const transcript = await getTranscript(data.input);
    if (!transcript) return new Response("Invalid audio", { status: 400 });

    console.timeEnd(
        "transcribe " + request.headers.get("x-vercel-id") || "local"
    );
    console.time(
        "text completion " + request.headers.get("x-vercel-id") || "local"
    );

    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: process.env.KETZAI_PROMPT,
        generationConfig: {
            candidateCount: 1,
            maxOutputTokens: 200,
            temperature: 1.0,
        },
    });

    // Start a chat session
    const chat = model.startChat({
        history: [
            {
                role: "user",
                parts: [
                    {
                        text: `hi`,
                    },
                ],
            },
            {
                role: "model",
                parts: [{ text: "Understood. I'm ready to assist with the History of World Powers. How may I help you?" }],
            },
        ],
    });

    // Add previous messages to the chat history
    for (const msg of data.message) {
        await chat.sendMessage(msg.content);
    }

    // Send the new user message (transcript)
    const result = await chat.sendMessage(transcript);

    const response = result.response.text();
    console.timeEnd(
        "text completion " + request.headers.get("x-vercel-id") || "local"
    );

    console.time(
        "openai tts request " + request.headers.get("x-vercel-id") || "local"
    );
    const voice = await openai.audio.speech.create({
        model: "tts-1",
        voice: "nova",
        input: response,
        response_format: "mp3",
    });
    console.timeEnd(
        "openai tts request " + request.headers.get("x-vercel-id") || "local"
    );

    if (!voice) {
        console.error("Voice synthesis failed");
        return new Response("Voice synthesis failed", { status: 500 });
    }

    console.time("stream " + request.headers.get("x-vercel-id") || "local");
    after(() => {
        console.timeEnd(
            "stream " + request.headers.get("x-vercel-id") || "local"
        );
    });

    const audioStream = voice.body;
    return new Response(audioStream, {
        headers: {
            "Content-Type": "audio/mpeg",
            "X-Transcript": encodeURIComponent(transcript),
            "X-Response": encodeURIComponent(response),
        },
    });
}

function location() {
    const headersList = headers();

    const country = headersList.get("x-vercel-ip-country");
    const region = headersList.get("x-vercel-ip-country-region");
    const city = headersList.get("x-vercel-ip-city");

    if (!country || !region || !city) return "unknown";

    return `${city}, ${region}, ${country}`;
}

function time() {
    return new Date().toLocaleString("en-US", {
        timeZone: headers().get("x-vercel-ip-timezone") || undefined,
    });
}

async function getTranscript(input: string | File) {
    if (typeof input === "string") return input;

    try {
        const { text } = await groq.audio.transcriptions.create({
            file: input,
            model: "whisper-large-v3",
        });

        return text.trim() || null;
    } catch {
        return null; // Empty audio file
    }
}
