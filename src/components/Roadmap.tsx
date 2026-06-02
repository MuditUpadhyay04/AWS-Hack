import { useEffect, useMemo, useRef, useState } from "react";
import rough from "roughjs";
import { mockRoadmap, type Roadmap as RoadmapData, type RoadmapStep } from "@/data/mockRoadmap";

// Screen 2: the hand-drawn roadmap. A winding rough.js path with one node per
// step, styled by status / risk. Everything here is driven by the `roadmap`
// prop — no step data is baked into the component.

// Canvas coordinate space the SVG is drawn in (scaled responsively via viewBox).
const W = 1100;
const H = 560;

interface Point {
  x: number;
  y: number;
}

// The original artwork was hand-tuned for a 5-step roadmap. We keep that exact
// layout for the common case so the demo looks its best, and fall back to a
// generated layout for any other number of steps.
const CURATED_POS: Point[] = [
  { x: 110, y: 440 },
  { x: 310, y: 200 },
  { x: 540, y: 420 },
  { x: 760, y: 180 },
  { x: 980, y: 400 },
];

// Evenly space nodes across the canvas, alternating between a low and high band
// so the path zig-zags. Mirrors the curated layout's pattern (even = low).
function proceduralPositions(count: number): Point[] {
  const marginX = 110;
  const usableW = W - marginX * 2;
  const yLow = 420;
  const yHigh = 190;
  return Array.from({ length: count }, (_, i) => ({
    x: count === 1 ? W / 2 : marginX + (usableW * i) / (count - 1),
    y: i % 2 === 0 ? yLow : yHigh,
  }));
}

// Build a smooth, gently-bending SVG path through the node positions. The first
// segment is a full cubic; the rest are smooth (S) curves with an alternating
// bend so the line keeps waving like a hand-drawn trail.
function buildPath(points: Point[]): string {
  if (points.length < 2) return points.length ? `M ${points[0].x} ${points[0].y}` : "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const cur = points[i];
    if (i === 1) {
      const prev = points[0];
      d += ` C ${prev.x + 80} ${prev.y - 80}, ${cur.x - 80} ${cur.y + 80}, ${cur.x} ${cur.y}`;
    } else {
      const bend = i % 2 === 0 ? -60 : 60;
      d += ` S ${cur.x - 80} ${cur.y + bend}, ${cur.x} ${cur.y}`;
    }
  }
  return d;
}

function colorFor(step: RoadmapStep) {
  if (step.is_risk) return { fill: "#f4a261", stroke: "#c1440e" };
  if (step.status === "done") return { fill: "#a7d8a3", stroke: "#2f6b34" };
  if (step.status === "in_progress") return { fill: "#fde68a", stroke: "#a16207" };
  return { fill: "#e8e2d0", stroke: "#8b8678" };
}

export function Roadmap({
  roadmap = mockRoadmap,
  onBack,
}: {
  roadmap?: RoadmapData;
  onBack?: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  // How many nodes have "appeared" so far, for the staggered reveal.
  const [drawn, setDrawn] = useState(0);

  const steps = roadmap.steps;

  // Node positions: hand-tuned for the 5-step demo, generated otherwise.
  const positions = useMemo(
    () => (steps.length === 5 ? CURATED_POS : proceduralPositions(steps.length)),
    [steps.length],
  );

  // Identity of the roadmap's *structure* (which nodes, and where). When this
  // changes we redraw with the full staggered reveal. A change to only a step's
  // status/risk keeps the same structure, so we recolor in place instead of
  // re-running the reveal animation (so live sync updates don't re-animate).
  const structureKey = useMemo(
    () =>
      steps.map((s) => s.id).join(",") +
      "|" +
      positions.map((p) => `${p.x},${p.y}`).join(";"),
    [steps, positions],
  );
  const prevStructureRef = useRef<string | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const rc = rough.svg(svg);

    const isStructureChange = prevStructureRef.current !== structureKey;
    prevStructureRef.current = structureKey;

    svg.innerHTML = "";

    // the winding trail connecting the steps
    const pathNode = rc.path(buildPath(positions), {
      stroke: "#6b5d4a",
      strokeWidth: 2.2,
      roughness: 2.4,
      bowing: 2,
      fill: "none",
    });
    pathNode.setAttribute("stroke-dasharray", "8 10");
    pathNode.setAttribute("opacity", "0.55");
    svg.appendChild(pathNode);

    // only the staggered-reveal path schedules timers
    if (isStructureChange) setDrawn(0);
    const timers: ReturnType<typeof setTimeout>[] = [];

    steps.forEach((step, i) => {
      const c = colorFor(step);
      const r = step.is_risk ? 56 : 48;
      const circ = rc.circle(positions[i].x, positions[i].y, r * 2, {
        fill: c.fill,
        fillStyle: "hachure",
        hachureGap: 4,
        stroke: c.stroke,
        strokeWidth: step.is_risk ? 2.5 : 1.8,
        roughness: 2.2,
        fillWeight: 1.2,
      });
      circ.setAttribute("data-node", String(step.id));
      circ.style.transition = "opacity 0.5s ease";
      // Not-yet-started steps stay faded to read as "locked / future".
      const targetOpacity = step.status === "not_started" && !step.is_risk ? "0.45" : "1";

      if (isStructureChange) {
        // first draw / new roadmap -> fade each node in on a stagger
        const delay = 300 + i * 220;
        circ.style.opacity = "0";
        timers.push(setTimeout(() => setDrawn((d) => Math.max(d, i + 1)), delay));
        timers.push(setTimeout(() => (circ.style.opacity = targetOpacity), delay));
      } else {
        // status/risk change only -> recolor in place, no re-animation
        circ.style.opacity = targetOpacity;
      }
      svg.appendChild(circ);
    });

    return () => timers.forEach(clearTimeout);
  }, [steps, positions, structureKey]);

  // Which step is "current", for the "you're here" pin.
  const currentIndex = steps.findIndex((s) => s.status === "in_progress");

  return (
    <div className="bg-paper min-h-screen w-full">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-6 flex items-end justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-pencil">
              your roadmap · {roadmap.domain}
            </p>
            <h1 className="font-hand text-5xl text-ink">Here's your path forward.</h1>
            <p className="mt-2 max-w-xl text-sm text-pencil">
              Toward <span className="font-medium text-ink">{roadmap.goal}</span>. I read your
              notes and shaped this around what you told me. Watch out for the orange one — that's
              a risk that could push you back.
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border-2 border-ink/70 bg-paper px-4 py-2 font-hand text-lg text-ink transition hover:bg-ink hover:text-paper"
            style={{ boxShadow: "3px 3px 0 rgba(0,0,0,0.15)" }}
          >
            ← back to notes
          </button>
        </header>

        <div className="relative rounded-3xl border-2 border-dashed border-ink/20 bg-paper/60 p-4">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full"
            preserveAspectRatio="xMidYMid meet"
          />

          {/* overlay labels — drawn in their own SVG so we can use real text/HTML */}
          <div className="pointer-events-none absolute inset-4">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
              {steps.map((step, i) => (
                <g
                  key={step.id}
                  style={{
                    opacity: drawn > i ? 1 : 0,
                    transition: "opacity 0.5s ease",
                  }}
                >
                  {/* status icon */}
                  <text
                    x={positions[i].x}
                    y={positions[i].y + 6}
                    textAnchor="middle"
                    className="font-hand"
                    fontSize="28"
                    fill={step.is_risk ? "#7a1f00" : "#2a2a2a"}
                  >
                    {step.is_risk
                      ? "⚠"
                      : step.status === "done"
                      ? "✓"
                      : step.status === "in_progress"
                      ? "★"
                      : i + 1}
                  </text>

                  {/* title label, placed below or above the node so they don't collide */}
                  <foreignObject
                    x={positions[i].x - 100}
                    y={positions[i].y + (i % 2 === 0 ? 65 : -110)}
                    width="200"
                    height="60"
                  >
                    <div
                      className="text-center"
                      style={{
                        fontFamily: "Caveat, cursive",
                        color: step.is_risk ? "#7a1f00" : "#2a2a2a",
                        fontSize: 20,
                        lineHeight: 1.1,
                        fontWeight: 600,
                        opacity: step.status === "not_started" && !step.is_risk ? 0.6 : 1,
                      }}
                    >
                      {step.title}
                      <div
                        style={{
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: 9,
                          textTransform: "uppercase",
                          letterSpacing: "0.16em",
                          marginTop: 2,
                          opacity: 0.7,
                        }}
                      >
                        {step.is_risk ? "risk · bowser" : step.status.replace("_", " ")} · {step.difficulty}
                      </div>
                    </div>
                  </foreignObject>
                </g>
              ))}

              {/* "you're here" marker over the in-progress step */}
              {currentIndex >= 0 && (
                <g style={{ opacity: drawn > currentIndex ? 1 : 0, transition: "opacity 0.5s ease" }}>
                  <text
                    x={positions[currentIndex].x}
                    y={positions[currentIndex].y - 70}
                    textAnchor="middle"
                    fontSize="32"
                    style={{ filter: "drop-shadow(0 2px 1px rgba(0,0,0,0.2))" }}
                  >
                    📍
                  </text>
                  <text
                    x={positions[currentIndex].x}
                    y={positions[currentIndex].y - 92}
                    textAnchor="middle"
                    style={{ fontFamily: "Caveat, cursive", fontSize: 18, fill: "#7a4a00" }}
                  >
                    you're here
                  </text>
                </g>
              )}
            </svg>
          </div>

          {/* hand-drawn corner notes */}
          <div className="absolute right-8 top-4 rotate-3 font-hand text-lg text-ink/60">
            ✦ a path, not a prescription
          </div>
          <div className="absolute bottom-4 left-8 -rotate-2 font-hand text-base text-ink/50">
            (we'll redraw this whenever life shifts)
          </div>
        </div>

        {/* legend */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink/15 bg-paper/70 p-4">
          <div className="flex flex-wrap gap-4 font-hand text-base text-ink">
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: "#a7d8a3" }} /> done</span>
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: "#fde68a" }} /> in progress</span>
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: "#e8e2d0" }} /> coming up</span>
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: "#f4a261" }} /> ⚠ risk (bowser)</span>
          </div>
          <button
            type="button"
            className="rounded-full border-2 border-ink bg-ink px-5 py-2 font-hand text-lg text-paper transition hover:bg-paper hover:text-ink"
            style={{ boxShadow: "3px 3px 0 rgba(0,0,0,0.25)" }}
          >
            keep going →
          </button>
        </div>
      </div>
    </div>
  );
}
