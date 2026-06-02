import { useState } from "react";

// The right panel of screen 1: optional integrations the user could connect.
// These are visual-only for now — "connect" just simulates a short linking
// delay so the demo feels alive; nothing actually talks to Google.

type Status = "idle" | "connecting" | "connected";

function IntegrationCard({
  name,
  desc,
  icon,
  tilt,
}: {
  name: string;
  desc: string;
  icon: React.ReactNode;
  tilt: string;
}) {
  // Persist "connected" across refreshes so a mid-demo reload doesn't look broken.
  const storageKey = `integration_status_${name.toLowerCase().replace(/\s+/g, "_")}`;
  const [status, setStatus] = useState<Status>(() => {
    try {
      return localStorage.getItem(storageKey) === "connected" ? "connected" : "idle";
    } catch {
      return "idle";
    }
  });

  const handle = () => {
    if (status !== "idle") return;
    setStatus("connecting");
    setTimeout(() => {
      setStatus("connected");
      try {
        localStorage.setItem(storageKey, "connected");
      } catch {
        // localStorage can be unavailable (private mode) — connection still works for the session.
      }
    }, 1200);
  };

  return (
    <div
      className="paper-card relative rounded-xl p-4"
      style={{ transform: `rotate(${tilt})` }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-paper-warm text-lg">
          {icon}
        </div>
        <div className="flex-1">
          <h4 className="font-hand text-lg text-ink">{name}</h4>
          <p className="font-hand text-sm leading-snug text-pencil">{desc}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={handle}
        disabled={status !== "idle"}
        className={`mt-3 w-full rounded-lg border-2 px-3 py-2 font-hand text-base transition ${
          status === "connected"
            ? "border-success/50 bg-success/10 text-success"
            : status === "connecting"
            ? "border-primary/40 bg-primary/5 text-primary"
            : "border-ink/70 bg-paper text-ink hover:bg-ink hover:text-paper"
        }`}
        style={status === "idle" ? { boxShadow: "2px 2px 0 oklch(0.30 0.05 50 / 0.18)" } : undefined}
      >
        {status === "connected"
          ? "✓ all linked up"
          : status === "connecting"
          ? "linking…"
          : "connect"}
      </button>
    </div>
  );
}

export function IntegrationsPanel({
  pinned,
  onTogglePin,
  onClose,
}: {
  pinned?: boolean;
  onTogglePin?: () => void;
  onClose?: () => void;
} = {}) {
  // Show the pin/close controls only when App is managing this panel's visibility.
  const showControls = Boolean(onTogglePin || onClose);

  return (
    <aside className="paper-card relative flex flex-col gap-4 rounded-2xl p-5">
      <div className="tape -top-3 right-6 rotate-6" />

      {showControls && (
        <div className="flex justify-end gap-1">
          {onTogglePin && (
            <button
              type="button"
              onClick={onTogglePin}
              aria-pressed={pinned}
              aria-label={pinned ? "Unpin plug-ins" : "Pin plug-ins open"}
              title={pinned ? "Unpin" : "Keep open"}
              className={`rounded-md px-1.5 py-0.5 text-base transition ${
                pinned ? "opacity-100" : "opacity-50 hover:opacity-90"
              }`}
            >
              📌
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Hide plug-ins"
              title="Hide"
              className="rounded-md px-2 py-0.5 font-hand text-lg leading-none text-pencil transition hover:text-ink"
            >
              ×
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col">
        <span className="font-hand text-base text-pencil">if you'd like —</span>
        <span className="font-hand text-2xl text-ink scribble-underline inline-block">
          bring your real stuff
        </span>
        <p className="mt-1 font-hand text-base leading-snug text-pencil">
          the more i see, the better i can shape this around your actual life. only if you're comfortable.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <IntegrationCard
          name="Google Sheets"
          desc="your expense tracker, budget, anything tabular"
          icon={<span>📊</span>}
          tilt="-0.6deg"
        />
        <IntegrationCard
          name="Google Docs"
          desc="notes, journals, plans — drop them in"
          icon={<span>📓</span>}
          tilt="0.8deg"
        />
      </div>

      <div className="mt-auto rounded-xl border border-dashed border-border bg-paper-warm/60 p-3">
        <p className="font-hand text-base leading-snug text-pencil">
          nothing leaves this page unless you say so. promise.
        </p>
      </div>
    </aside>
  );
}
