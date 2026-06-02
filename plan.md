# Pathfinder — Frontend Build Plan (Teammate 1)

## Read this first (context for Cursor)

This is a hackathon project: a **domain-agnostic roadmap builder**. A user opens a notepad and writes about a goal — paying off loans, earning a certification, a health goal, anything. The app figures out the domain, asks clarifying questions, and turns the answers into a step-by-step roadmap. That roadmap is then rendered as a Mario-style game by a different teammate.

Three people are building this:
- **Teammate 1 (me — this plan):** the frontend. The notepad screen and the hand-drawn roadmap screen.
- **Teammate 2:** the backend / knowledge base. Takes the user's notes, asks questions, returns a roadmap as JSON.
- **Teammate 3:** the Mario game world, which consumes the same roadmap JSON.

**My job is the frontend only.** I am NOT wiring up the AI, the database, or the game. I am building the screens and faking the data with hardcoded JSON so I can build independently while Teammate 2 works. When their backend is ready, I swap my mock data for their real responses — nothing else should need to change.

---

## What I am building

### Screen 1 — The Notepad

A three-panel layout:

- **Left panel — "AI context" / cortex area.** A narrow column with a futuristic, quiet feel. As the user types in the middle, short context notes appear here (e.g. "Detected: financial goal", "Topic: debt + investing", "Profile: likely student"). For now these are faked — I show a few placeholder context items. A small pulsing dot signals "the AI is reading."
- **Middle panel — the notes.** This is where the user actually types. Free-form. They can write a heading and bullet points under it, like a real notepad. Text appears live as they type. This is the only truly interactive part of screen 1.
- **Right panel — "plug-ins" area.** A column showing connectable integrations (Google Sheets, Google Docs). For now these are just visual cards with a "Connect" button that doesn't need to do anything real yet.

Below the three panels: a **constraints area**. This is where the questions/answers and extracted constraints get displayed (the stuff Teammate 2 will eventually send). For now, fake it with a few sample constraint items.

A **"Build my roadmap →" button** at the bottom. Clicking it navigates to Screen 2 and passes the roadmap JSON.

### Screen 2 — The Hand-drawn Roadmap

After clicking next, render the roadmap as if it were **sketched by hand on paper** — brush strokes, pencil texture, slightly imperfect lines. Each step is a node along a winding path. This is the signature visual of the whole project, so it deserves the most polish.

- The path connecting steps should look hand-drawn, not a clean vector line.
- Each step node shows its title.
- Completed steps, the current step, and locked/future steps should look visually distinct.
- Risk steps (flagged in the data) should stand out — these are the ones that later become "Bowser" levels in Teammate 3's game.

This screen reads the same JSON that Teammate 3's game reads, so we stay consistent.

---

## The data contract (shared with Teammate 2 and Teammate 3)

Both my roadmap screen and Teammate 3's game read the same JSON. Build against this hardcoded sample until the backend is live:

```json
{
  "domain": "finance",
  "goal": "Pay off loans and start investing",
  "steps": [
    { "id": 0, "title": "Build an emergency fund", "difficulty": "easy",   "status": "done",        "is_risk": false },
    { "id": 1, "title": "Cut monthly costs",        "difficulty": "medium", "status": "in_progress", "is_risk": false },
    { "id": 2, "title": "Start loan payments",      "difficulty": "medium", "status": "not_started", "is_risk": false },
    { "id": 3, "title": "New semester loans hit",   "difficulty": "hard",   "status": "not_started", "is_risk": true  },
    { "id": 4, "title": "First investment",         "difficulty": "hard",   "status": "not_started", "is_risk": false }
  ]
}
```

Field meanings:
- `domain` — finance / education / health / etc. Lets the roadmap restyle per topic later.
- `status` — `done` / `in_progress` / `not_started`. Drives how each node looks.
- `is_risk` — when true, this node is a hazard / Bowser step. Style it differently (warning color, rougher edges).
- `difficulty` — easy / medium / hard. Optional visual cue (node size or intensity).

Keep all rendering driven off this JSON. Do not hardcode step titles into the components.

---

## Suggested tech stack

- **React + Vite** — fast, and Cursor handles it well.
- **Tailwind CSS** — quick styling without fighting CSS files.
- **rough.js** — a small library that makes shapes and lines look hand-drawn/sketchy. This is the key to the brush-stroke roadmap. (Alternatively, Excalidraw's rendering approach is built on the same idea and is worth looking at for inspiration.)
- **React Router** (or simple state) to switch between Screen 1 and Screen 2.
- Keep state simple: hold the notes text and the roadmap JSON in a parent component, pass down as props.

Do not add a backend, a database, or any API calls. Everything is local state and mock JSON.

---

## Build order (do it in this sequence)

1. **Scaffold the project** — React + Vite + Tailwind, two routes/screens, a parent component holding shared state.
2. **Build Screen 2 (the roadmap) FIRST, with hardcoded JSON.** It's the hardest and most distinctive part — don't leave it for last. Get the hand-drawn path and nodes looking good before anything else.
3. **Build Screen 1's middle notepad** — live typing into local state.
4. **Add Screen 1's left (AI context) and right (plug-ins) panels** — static/faked for now.
5. **Add the constraints area** below the panels — rendered from a small mock array.
6. **Wire the "Build my roadmap" button** to pass the JSON from Screen 1 to Screen 2.
7. **Polish** — transitions between screens, the hand-drawn texture, responsive spacing.

---

## Aesthetic direction

The contrast is the whole point: Screen 1 feels like a **clean, futuristic workspace** (crisp panels, a quiet "AI is thinking" cortex feel), and Screen 2 feels **warm and hand-made** — like the plan was sketched on paper with pencil and brush. Lean into that shift. It makes the moment of "click next" feel like the machine handed you something human.

Avoid generic AI-looking UI (plain purple gradients, default fonts). Pick one distinctive display font for headings and a clean body font. Commit to the paper/sketch texture on Screen 2 rather than a flat vector look.

---

## What "done" looks like for the demo

- I can type notes in the middle of Screen 1 and see them appear live.
- Fake context items show in the left panel; fake plug-in cards show on the right.
- A constraints area shows a few sample constraints below.
- Clicking "Build my roadmap" takes me to a hand-drawn roadmap rendered entirely from JSON.
- Swapping the mock JSON for Teammate 2's real response requires changing only the data source, not the components.
