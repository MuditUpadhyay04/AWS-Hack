import { useCallback, useEffect, useState } from "react";
import { isSpeechInputAvailable, listenForWake, speak } from "@/lib/voice";

// A "sleep" overlay that dims the whole app until you wake it by saying
// "are you awake buddy" (or tapping). If the browser has no speech recognition,
// it starts awake so nobody gets trapped. Self-contained — mounted alongside App.
export function WakeGate() {
  // Start asleep only if we can actually listen for the wake word.
  const [awake, setAwake] = useState(() => !isSpeechInputAvailable());
  const [closing, setClosing] = useState(false);

  const wake = useCallback(() => {
    setClosing(true);
    speak("Yes — let's get to work.");
    window.setTimeout(() => setAwake(true), 600); // let the overlay fade out first
  }, []);

  useEffect(() => {
    if (awake || closing) return;
    const stop = listenForWake(wake);
    return () => stop?.();
  }, [awake, closing, wake]);

  if (awake) return null;

  return (
    <div
      onClick={wake}
      className="fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center bg-ink/90 text-paper transition-opacity duration-500"
      style={{ opacity: closing ? 0 : 1 }}
    >
      <span aria-hidden className="pulse-dot mb-5 h-3 w-3 rounded-full bg-primary" />
      <p className="font-hand text-3xl">say "are you awake buddy" to wake me</p>
      <p className="mt-2 font-hand text-lg text-paper/70">(or tap anywhere)</p>
    </div>
  );
}
