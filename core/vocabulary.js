// BoringTeacher Core V1 — vocabulary primitives.
// Pair order is deliberately preserved. No automatic translation or reversal.
export function parsePairs(text) {
  const pairs = [], rejectedLines = [];
  String(text ?? "").split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const columns = line.split("\t");
    if (columns.length !== 2 || !columns[0].trim() || !columns[1].trim()) {
      rejectedLines.push(index + 1); return;
    }
    pairs.push([columns[0].trim(), columns[1].trim()]);
  });
  return { pairs, rejectedLines };
}
export function swapPairs(pairs) {
  return pairs.map(([prompt, target]) => [target, prompt]);
}
export function validateSet(set, { minPairs = 5 } = {}) {
  const fail = message => ({ ok: false, error: { code: "VALIDATION", message } });
  if (!set || typeof set !== "object") return fail("Missing vocabulary set.");
  if (typeof set.title !== "string" || !set.title.trim()) return fail("Enter a set title.");
  if (typeof set.language !== "string" || !set.language.trim()) return fail("Choose a language.");
  if (!Array.isArray(set.pairs) || set.pairs.length < minPairs) return fail(`At least ${minPairs} pairs are required.`);
  if (!set.pairs.every(p => Array.isArray(p) && p.length === 2 && p.every(v => typeof v === "string" && v.trim()))) {
    return fail("Each pair must contain two nonempty text values.");
  }
  return { ok: true, value: { title: set.title.trim(), language: set.language.trim(), pairs: set.pairs.map(p => p.map(v => v.trim())) } };
}
