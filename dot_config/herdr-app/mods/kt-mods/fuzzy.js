// kt-picker's fuzzy search. A term matches a field as a substring first (earlier, and at a word
// start, scores higher), else as its characters in order (word starts and runs score higher, a
// wide spread lower). Case-insensitive.
// ponytail: indices are taken on the lowercased text; a letter whose lowercase changes length
// (Turkish İ) shifts the highlight after it. Fine for titles, branches and paths.

const startsWord = (s, i) => i === 0 || /[^\p{L}\p{N}]/u.test(s[i - 1]);

export function fuzzy(term, text) {
  const q = term.toLowerCase();
  const s = (text ?? "").toLowerCase();
  if (!q) return { score: 0, at: [] };
  const i = s.indexOf(q);
  if (i >= 0) return { score: 1000 - i + (startsWord(s, i) ? 200 : 0), at: Array.from(q, (_, k) => i + k) };
  const at = [];
  let score = 0;
  for (let k = 0; k < s.length && at.length < q.length; k++) {
    if (s[k] !== q[at.length]) continue;
    score += startsWord(s, k) ? 10 : at.length && at[at.length - 1] === k - 1 ? 5 : 1;
    at.push(k);
  }
  return at.length === q.length ? { score: score - (at[at.length - 1] - at[0]) / 10, at } : null;
}

// Every whitespace-separated term of the query must match one of the fields (the first field wins
// a tie). Returns the row's score and, per field, the set of indices to light up; null: no match.
export function search(query, fields) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  const marks = fields.map(() => new Set());
  let score = 0;
  for (const term of terms) {
    let best = null;
    let field = -1;
    fields.forEach((f, i) => {
      const m = f ? fuzzy(term, f) : null;
      if (m && (!best || m.score > best.score)) [best, field] = [m, i];
    });
    if (!best) return null;
    score += best.score;
    for (const k of best.at) marks[field].add(k);
  }
  return { score, marks };
}
