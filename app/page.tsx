"use client";

import clsx from "clsx";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { usePlayer } from "@/lib/usePlayer";
import { track } from "@vercel/analytics";
import { useMicVAD, utils } from "@ricky0123/vad-react";
import ChatInterface from '@/components/ChatInterface'
import { ChatProvider, useChatContext } from '@/components/ChatContext'

function HomeContent() {
    const { 
        setTranscribedText, 
        addMessage, 
        setIsPending, 
        isLiveTranscriptionActive, 
        toggleLiveTranscription,
        submit
    } = useChatContext();
    const inputRef = useRef<HTMLInputElement>(null);
    const player = usePlayer();

    const vad = useMicVAD({
        startOnLoad: false,
        onSpeechEnd: async (audio) => {
            if (isLiveTranscriptionActive) {
                player.stop();
                const wav = utils.encodeWAV(audio);
                const blob = new Blob([wav], { type: "audio/wav" });
                try {
                    const response = await submit(blob);
                    if (response && response.body) {
                        player.play(response.body);
                    }
                } catch (error) {
                    console.error("Error submitting audio:", error);
                }
                const isFirefox = navigator.userAgent.includes("Firefox");
                if (isFirefox) vad.pause();
            }
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
        if (isLiveTranscriptionActive) {
            vad.start();
        } else {
            vad.pause();
        }
    }, [isLiveTranscriptionActive, vad]);

    return (
        <>
            <div className="pb-4 min-h-28" />

            <ChatInterface />

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

export default function Home() {
    return (
        <ChatProvider>
            <HomeContent />
        </ChatProvider>
    );
}
