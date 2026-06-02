import { useState } from "react";
import type { NotesDocument } from "@/lib/notes";

// A small "what i'm understanding" card on screen 1: shows the live structured
// view of the notes (headings + points) with a toggle to peek at the raw JSON
// we'll send to the backend. Visualizes the messy-notes -> structure step.

export function UnderstandingPreview({ doc }: { doc: NotesDocument }) {
  const [showJson, setShowJson] = useState(false);

  const hasContent = doc.sections.some((s) => s.heading || s.points.length > 0);
  if (!hasContent) return null;

  return (
    <section className="paper-card relative rounded-2xl p-5">
      <div className="tape -top-3 left-10 -rotate-2" />
      <div className="flex items-center justify-between gap-2">
        <span className="font-hand text-xl text-ink scribble-underline inline-block">
          what i'm understanding
        </span>
        <button
          type="button"
          onClick={() => setShowJson((v) => !v)}
          aria-pressed={showJson}
          className="rounded-md border border-dashed border-pencil/50 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-pencil transition hover:border-ink hover:text-ink"
        >
          {showJson ? "outline" : "</> json"}
        </button>
      </div>

      {showJson ? (
        <pre
          className="mt-3 overflow-x-auto rounded-lg bg-paper-warm/60 p-3 text-[11px] leading-relaxed text-ink"
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        >
          {JSON.stringify({ sections: doc.sections }, null, 2)}
        </pre>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {doc.sections.map((s, i) => (
            <div key={i} className="fade-up" style={{ animationDelay: `${i * 60}ms` }}>
              <p className="font-hand text-lg text-ink">{s.heading || "untitled"}</p>
              {s.points.length > 0 && (
                <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-6 marker:text-pencil/60">
                  {s.points.map((p, j) => (
                    <li key={j} className="font-hand text-base leading-snug text-pencil">
                      {p}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
