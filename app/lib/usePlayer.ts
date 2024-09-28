import { useRef, useState } from "react";

export function usePlayer() {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioContext = useRef<AudioContext | null>(null);
    const audioBuffer = useRef<AudioBuffer | null>(null);
    const source = useRef<AudioBufferSourceNode | null>(null);

    async function play(stream: ReadableStream, callback: () => void) {
        try {
            stop();
            audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();

            // Ensure audio context is in running state
            if (audioContext.current.state === 'suspended') {
                await audioContext.current.resume();
            }

            const reader = stream.getReader();
            const chunks: Uint8Array[] = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }

            const blob = new Blob(chunks, { type: 'audio/mpeg' });
            const arrayBuffer = await blob.arrayBuffer();
            audioBuffer.current = await audioContext.current.decodeAudioData(arrayBuffer);

            source.current = audioContext.current.createBufferSource();
            source.current.buffer = audioBuffer.current;
            source.current.connect(audioContext.current.destination);
            
            source.current.onended = () => {
                stop();
                callback();
            };

            source.current.start();
            setIsPlaying(true);
        } catch (error) {
            console.error("Error playing audio:", error);
            stop();
        }
    }

    function stop() {
        if (source.current) {
            source.current.stop();
            source.current.disconnect();
        }
        if (audioContext.current) {
            audioContext.current.close();
        }
        audioContext.current = null;
        audioBuffer.current = null;
        source.current = null;
        setIsPlaying(false);
    }

    return {
        isPlaying,
        play,
        stop,
    };
}