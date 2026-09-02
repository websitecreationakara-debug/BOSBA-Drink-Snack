// Product descriptions are stored as plain text with lightweight markdown:
// blank lines become paragraph breaks (via the `whitespace-pre-line` class on
// the container) and **text** renders bold. Returns inline nodes only, so the
// caller's line-clamp / overflow-measurement logic keeps working.
export function renderFormattedDescription(text: string) {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((chunk, i) =>
      chunk.startsWith("**") && chunk.endsWith("**") && chunk.length >= 4 ? (
        <strong key={i}>{chunk.slice(2, -2)}</strong>
      ) : (
        <span key={i}>{chunk}</span>
      ),
    );
}

export type ParsedDescription = {
  /** First `>` line — shown as the hero-banner tagline. */
  tagline: string | null;
  /** Any `>` lines after the first — shown as small badges under the tagline. */
  badges: string[];
  /** `- ` lines — shown as offer callouts in the buy-box callout row. */
  callouts: string[];
  /** Everything else, with paragraph breaks preserved. */
  body: string;
};

// On top of **bold** and blank-line paragraphs, a line on its own that starts
// with:
//   >   hero-banner text — the first `>` line is the tagline, any extra `>`
//       lines become small badges under it
//   - (dash + space) an offer callout shown next to Add to Cart
// Those lines are pulled out so the prose body reads clean.
export function parseProductDescription(text: string | null | undefined): ParsedDescription {
  const hero: string[] = [];
  const callouts: string[] = [];
  const body: string[] = [];
  for (const raw of (text ?? "").split("\n")) {
    const line = raw.trim();
    if (line.startsWith(">")) {
      const v = line.slice(1).trim();
      if (v) hero.push(v);
    } else if (/^-\s+\S/.test(line)) {
      callouts.push(line.slice(1).trim());
    } else {
      body.push(raw);
    }
  }
  return {
    tagline: hero[0] ?? null,
    badges: hero.slice(1),
    callouts,
    body: body
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  };
}
