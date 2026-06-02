// Turns the freeform notepad text into a structured document as the user types.
// This is what we hand to the backend (Teammate 2) so it gets clean, embeddable
// units (headings + their bullet points) instead of one undifferentiated blob.

export interface NotesSection {
  /** A heading line; "" for points written before any heading. */
  heading: string;
  points: string[];
}

export interface NotesDocument {
  sections: NotesSection[];
  /** The original text, always kept so nothing is lost. */
  raw: string;
}

// Matches a leading bullet/number marker: "- ", "* ", "• ", "1. ", "2) ", etc.
const BULLET = /^\s*([-*•]|\d+[.)])\s+/;

export function parseNotes(text: string): NotesDocument {
  const sections: NotesSection[] = [];
  let current: NotesSection | null = null;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const bullet = line.match(BULLET);
    if (bullet) {
      const point = line.slice(bullet[0].length).trim();
      // points before any heading land in a leading, untitled section
      if (!current) {
        current = { heading: "", points: [] };
        sections.push(current);
      }
      if (point) current.points.push(point);
    } else {
      // a non-bullet line is a heading and starts a new section
      current = { heading: line, points: [] };
      sections.push(current);
    }
  }

  return { sections, raw: text };
}
