// Product descriptions are stored as plain text with lightweight markdown:
// blank lines become paragraph breaks (via the `whitespace-pre-line` class on
// the container) and **text** renders bold. Returns inline nodes only, so the
// caller's line-clamp / overflow-measurement logic keeps working.
export function renderFormattedDescription(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) =>
    chunk.startsWith("**") && chunk.endsWith("**") && chunk.length >= 4 ? (
      <strong key={i}>{chunk.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{chunk}</span>
    ),
  );
}
