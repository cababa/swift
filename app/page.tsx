"use client";

import clsx from "clsx";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EnterIcon, LoadingIcon } from "@/lib/icons";
import { usePlayer } from "@/lib/usePlayer";
import { track } from "@vercel/analytics";
import { useMicVAD, utils } from "@ricky0123/vad-react";
import ChatInterface from '@/components/ChatInterface'
import { Chat } from "groq-sdk/resources/index.mjs";

type Message = {
    role: "user" | "model";
    content: string;
    latency?: number;
};

export default function Home() {
    const [input, setInput] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const player = usePlayer();
    const [messages, setMessages] = useState<Message[]>([]);

    const vad = useMicVAD({
        startOnLoad: true,
        onSpeechEnd: (audio) => {
            player.stop();
            const wav = utils.encodeWAV(audio);
            const blob = new Blob([wav], { type: "audio/wav" });
            submit(blob);
            const isFirefox = navigator.userAgent.includes("Firefox");
            if (isFirefox) vad.pause();
        },
        workletURL: "/vad.worklet.bundle.min.js",
        modelURL: "/silero_vad.onnx",
        positiveSpeechThreshold: 0.6,
        minSpeechFrames: 4,
        ortConfig: (ort) => {
            const isSafari = /^((?!chrome|android).)*safari/i.test(
                navigator.userAgent
            );

            ort.env.wasm = {
                wasmPaths: {
                    "ort-wasm-simd-threaded.wasm":
                        "/ort-wasm-simd-threaded.wasm",
                    "ort-wasm-simd.wasm": "/ort-wasm-simd.wasm",
                    "ort-wasm.wasm": "/ort-wasm.wasm",
                    "ort-wasm-threaded.wasm": "/ort-wasm-threaded.wasm",
                },
                numThreads: isSafari ? 1 : 4,
            };
        },
    });

    useEffect(() => {
        function keyDown(e: KeyboardEvent) {
            if (e.key === "Escape") return setInput("");
        }

        window.addEventListener("keydown", keyDown);
        return () => window.removeEventListener("keydown", keyDown);
    }, []);

    const [, submit, isPending] = useActionState<Message[], string | Blob>(
        async (prevMessages, data) => {
            const formData = new FormData();

            if (typeof data === "string") {
                formData.append("input", data);
                track("Text input");
            } else {
                formData.append("input", data, "audio.wav");
                track("Speech input");
            }

            for (const message of prevMessages) {
                formData.append("message", JSON.stringify(message));
            }

            const submittedAt = Date.now();

            const response = await fetch("/api", {
                method: "POST",
                body: formData,
            });

            const transcript = decodeURIComponent(
                response.headers.get("X-Transcript") || ""
            );
            const text = decodeURIComponent(
                response.headers.get("X-Response") || ""
            );

            if (!response.ok || !transcript || !text || !response.body) {
                if (response.status === 429) {
                    toast.error("Too many requests. Please try again later.");
                } else {
                    toast.error((await response.text()) || "An error occurred.");
                }

                return prevMessages;
            }

            const latency = Date.now() - submittedAt;
            player.play(response.body, () => {
                const isFirefox = navigator.userAgent.includes("Firefox");
                if (isFirefox) vad.start();
            });
            setInput(transcript);

            const newMessages: Message[] = [
                ...prevMessages,
                {
                    role: "user",
                    content: transcript,
                },
                {
                    role: "model",
                    content: text,
                    latency,
                },
            ];
            setMessages(newMessages);
            return newMessages;
        },
        []
    );

    function handleSendMessage(message: string) {
        setMessages(prevMessages => [...prevMessages, { role: "user", content: message }]);
        submit(message);
    }

    return (
        <>
            <div className="pb-4 min-h-28" />

            <ChatInterface 
                onSendMessage={handleSendMessage} 
                transcribedText={input} 
                isPending={isPending}
                messages={messages}
            />

            <div
                className={clsx(
                    "absolute size-36 blur-3xl rounded-full bg-gradient-to-b from-red-200 to-red-400 dark:from-red-600 dark:to-red-800 -z-50 transition ease-in-out",
                    {
                        "opacity-0": vad.loading || vad.errored,
                        "opacity-30":
                            !vad.loading && !vad.errored && !vad.userSpeaking,
                        "opacity-100 scale-110": vad.userSpeaking,
                    }
                )}
            />
        </>
    );
}

function A(props: any) {
    return (
        <a
            {...props}
            className="text-neutral-500 dark:text-neutral-500 hover:underline font-medium"
        />
    );
}