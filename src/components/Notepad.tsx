import { useEffect, useRef } from "react";

// The middle panel of screen 1: a notebook page the user types into. This is
// the only truly interactive part of screen 1 — the text it holds is lifted up
// to App so the cortex panel and the roadmap can both read it.

const PLACEHOLDER = `Investment

- want to make money
- invest in things
- reduce student loans
- not sure where to start...`;

export function Notepad({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow the textarea to fit its content (with a sensible minimum) so the page
  // "extends" as you write instead of showing an inner scrollbar.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight, 420) + "px";
  }, [value]);

  return (
    <section className="paper-card relative flex flex-col overflow-hidden rounded-2xl">
      {/* spiral binding */}
      <div className="absolute left-0 top-0 flex h-full w-6 flex-col items-center justify-around py-3">
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className="h-2.5 w-2.5 rounded-full border border-pencil/40 bg-paper-warm shadow-inner"
          />
        ))}
      </div>

      <header className="ml-8 flex items-center justify-between border-b border-dashed border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="font-hand text-xl text-ink">today's page</span>
          <span className="font-hand text-sm text-pencil">— {new Date().toLocaleDateString(undefined, { month: "long", day: "numeric" })}</span>
        </div>
        <span className="font-hand text-sm text-pencil">
          {value.trim().split(/\s+/).filter(Boolean).length} words so far
        </span>
      </header>

      <div className="relative ml-8 flex-1 bg-ruled margin-line">
        <div className="relative p-5 pl-16">
          {!value && (
            <pre className="pointer-events-none absolute left-16 top-5 right-5 whitespace-pre-wrap font-hand text-[22px] leading-[32px] text-pencil/40">
              {PLACEHOLDER}
            </pre>
          )}
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Your notes"
            spellCheck={false}
            className="relative w-full resize-none bg-transparent font-hand text-[22px] leading-[32px] text-ink outline-none"
            style={{ minHeight: 420 }}
            autoFocus
          />
        </div>
      </div>

      <footer className="ml-8 border-t border-dashed border-border px-5 py-2.5">
        <span className="font-hand text-sm text-pencil">
          ⌘ + enter when you're ready — or just keep going, no rush.
        </span>
      </footer>
    </section>
  );
}
