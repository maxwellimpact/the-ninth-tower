// Fit text into a box with the monospaced 5px pixel font: wrap by words onto
// up to `maxLines` lines and shorten the last one with ".." if it still
// doesn't fit. Scaling pixel text down would drop pixels, so we never do that.
export const CHAR_W = 5;

export function fitString(str, maxW, maxLines = 1, scale = 1) {
  const maxChars = Math.max(3, Math.floor(maxW / (CHAR_W * scale)));
  const words = String(str).toUpperCase().split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) { cur = next; continue; }
    if (lines.length === maxLines - 1) {
      // last line: take what fits and mark the cut
      const rest = [next, ...words.slice(i + 1)].join(' ');
      lines.push(rest.length <= maxChars ? rest : `${rest.slice(0, maxChars - 2).trimEnd()}..`);
      return lines.join('\n');
    }
    if (cur) lines.push(cur);
    cur = w.length > maxChars ? `${w.slice(0, maxChars - 2)}..` : w;
  }
  if (cur) lines.push(cur);
  return lines.join('\n');
}

// Apply to an existing BitmapText.
export function fitText(obj, maxW, maxLines = 1) {
  if (!obj || maxW <= 0) return obj;
  return obj.setText(fitString(obj.text, maxW, maxLines, obj.scaleX || 1));
}
