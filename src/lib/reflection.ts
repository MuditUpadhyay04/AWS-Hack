// Judges whether a player's note describes genuine, relevant progress toward a
// step's goal before they're allowed to play that level. Uses an LLM when a key
// is configured; falls back to a simple heuristic offline so it never blocks the
// demo. (VITE_OPENAI_API_KEY ships client-side — use a capped/rotatable key.)

const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY;

export interface Verdict {
  ok: boolean;
  message: string;
}

// Offline fallback: require a real, non-filler sentence.
function heuristic(text: string): Verdict {
  const t = text.trim();
  const words = t.split(/\s+/).filter(Boolean);
  const filler = /^(done|yes|no|nothing|idk|nope|na|n\/?a|ok|sure|test|asdf)\.?$/i;
  if (t.length < 12 || words.length < 3 || filler.test(t)) {
    return { ok: false, message: "tell me a bit more — what did you actually do toward this?" };
  }
  return { ok: true, message: "nice — that counts. you've earned this level." };
}

export async function validateReflection(goal: string, text: string): Promise<Verdict> {
  const t = text.trim();
  if (!t) return { ok: false, message: "tell me what you've actually done first." };
  if (!OPENAI_KEY) return heuristic(t);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'You decide whether a user\'s note describes genuine, relevant effort toward a stated goal. ' +
              'Reply ONLY with strict JSON: {"ok": boolean, "message": string}. ' +
              "Set ok=true if the note is a plausible, on-topic description of real effort (be encouraging — any honest progress counts). " +
              "Set ok=false if it is empty, off-topic, gibberish, or clearly shows no effort. " +
              "message: one short, warm sentence — if ok, acknowledge what they did specifically; if not, gently nudge them to describe what they actually did.",
          },
          { role: "user", content: `Goal: ${goal}\nUser's note: ${text}` },
        ],
      }),
    });

    if (!res.ok) return heuristic(t);
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    return {
      ok: Boolean(parsed.ok),
      message: String(
        parsed.message ?? (parsed.ok ? "nice — you've earned this level." : "tell me a bit more about what you did."),
      ),
    };
  } catch (err) {
    console.warn("Reflection check failed — using heuristic:", err);
    return heuristic(t);
  }
}
