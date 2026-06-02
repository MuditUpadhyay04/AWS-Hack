// Voice layer for the interview: ElevenLabs TTS so the clarifying questions are
// spoken, plus a thin Web Speech wrapper so answers can be given by voice.
// Both degrade gracefully: no API key -> silent; no SpeechRecognition -> the mic
// button simply isn't offered. Set the keys in .env.local (see .env.example).

const ELEVEN_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;
const ELEVEN_VOICE = import.meta.env.VITE_ELEVENLABS_VOICE_ID;

export function isTtsEnabled(): boolean {
  return Boolean(ELEVEN_KEY && ELEVEN_VOICE);
}

let currentAudio: HTMLAudioElement | null = null;

export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

// Speak a line via ElevenLabs. No-ops (resolves) if no key is configured.
export async function speak(text: string): Promise<void> {
  if (!ELEVEN_KEY || !ELEVEN_VOICE) return;
  try {
    stopSpeaking();
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}/stream`,
      {
        method: "POST",
        headers: { "xi-api-key": ELEVEN_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2",
          voice_settings: { stability: 0.4, similarity_boost: 0.8 },
        }),
      },
    );
    if (!res.ok) return;
    const url = URL.createObjectURL(await res.blob());
    const audio = new Audio(url);
    currentAudio = audio;
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
  } catch (err) {
    console.error("TTS failed:", err);
  }
}

// --- Web Speech (voice answers) ---

export function isSpeechInputAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

// Listen for a single spoken phrase. Returns a stop() function, or null if the
// browser has no SpeechRecognition (Chrome/Edge support it; Firefox does not).
export function listenOnce(
  onResult: (transcript: string) => void,
  onEnd?: () => void,
): (() => void) | null {
  const w = window as unknown as Record<string, any>;
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!SR) return null;

  const rec = new SR();
  rec.lang = "en-US";
  rec.interimResults = false;
  rec.continuous = false;
  rec.onresult = (e: any) => {
    const transcript: string = e.results?.[0]?.[0]?.transcript ?? "";
    if (transcript) onResult(transcript);
  };
  rec.onend = () => onEnd?.();
  rec.onerror = () => onEnd?.();
  try {
    rec.start();
  } catch {
    // some browsers throw if start() is called twice — safe to ignore
  }
  return () => {
    try {
      rec.stop();
    } catch {
      /* noop */
    }
  };
}
