// kt-chat (kbrdn-herdr #18): what herdr-bridge 0.6.0 asks, answered whole from the Chat. Pure:
// bridge-model.check.mjs.
//
// - The questions of an AskUserQuestion, all of them (`pending.questions`): a single choice, a
//   multi-select, « Other » typed, a `text` or a `number` question. The answer for the bridge is
//   { answers: { [question]: { label } | { labels, other? } | { other } | { text } | { number } |
//   { unanswered } } }: never a bare string (the bridge refuses it, hooks/answers.ts).
// - An MCP server's form (`pending.kind === "elicitation"`, `mode: "form"`, `schema`): its fields, the
//   content for the bridge { action: "accept", content }, or decline / cancel. A link (`mode: "url"`) is
//   never accepted from Herdr (the bridge refuses it): decline or cancel only.
// The card holds what is typed or picked, per question or field: `{ pick?, picks?, text? }` (`held`).
// What it sends fits what the bridge checks; anything else is null, and nothing is sent.
// The questions are walked as Claude Code's dialog walks them (Kylian, 2026-11-25): one row per option,
// with its label and description, « Autre », a text or number question's field, then « Envoyer »; ↑/↓
// move a cursor over them (rowsOf, moveCursor), Entrée picks or toggles (enterRow), and a single
// choice's previews show beside its options, the one under the cursor (previewOf).

// ponytail: the card's InputStates are a pool made in init (they can't be made in a render or a task);
// a form with more fields than this goes to the terminal (the card offers Ouvrir only).
export const MAX_FIELDS = 8;
// The engine's own limits (the bridge's TEXT): one free text, and all texts together.
const TEXT = 32768;
// A single choice's « Other »: never one of the engine's labels (text, no NUL).
export const OTHER = "\u0000other";

const plain = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const chars = (s) => [...s].length; // JSON Schema counts characters (code points), as the bridge does
const typed = (s) => typeof s === "string" && s.trim() !== "" && s.length <= TEXT;
// A number typed with a comma, as a French keyboard gives it.
const numberOf = (s) => {
  const v = String(s ?? "").trim().replace(",", ".");
  return v === "" ? null : Number(v);
};

/** The questions of an AskUserQuestion as the bridge published them, or null (none, or not ours). */
export function questionsOf(pending) {
  if (pending?.kind !== "permission" || pending.tool !== "AskUserQuestion" || !Array.isArray(pending.questions)) return null;
  const qs = pending.questions.filter((q) => plain(q) && typeof q.question === "string");
  const whole = qs.length && qs.length === pending.questions.length && qs.length <= MAX_FIELDS;
  return whole && new Set(qs.map((q) => q.question)).size === qs.length ? qs : null;
}

/** The engine's extended form, where a question may be skipped: the bridge's own test (answers.ts). */
export const extendedOf = (qs) => qs.every((q) => typeof q.kind === "string") || qs.some((q) => q.kind === "text" || q.kind === "number");

/** One question's answer for the bridge, from what the card holds, or null (not answered, or not as asked). */
export function answerOf(q, h = {}) {
  const kind = q.kind ?? "choice";
  if (kind === "text") return typed(h.text) ? { text: h.text } : null;
  if (kind === "number") {
    const n = numberOf(h.text);
    return n !== null && Number.isFinite(n) && typeof q.min === "number" && typeof q.max === "number" && n >= q.min && n <= q.max ? { number: n } : null;
  }
  if (kind !== "choice") return null;
  const labels = (q.options ?? []).map((o) => o?.label);
  const other = typed(h.text) ? h.text : null;
  if (q.multiSelect === true) {
    const picks = [...new Set((h.picks ?? []).filter((l) => labels.includes(l)))];
    if (!picks.length && !other) return null;
    return other ? { labels: picks, other } : { labels: picks };
  }
  if (h.pick === OTHER) return other ? { other } : null;
  return labels.includes(h.pick) ? { label: h.pick } : null;
}

/**
 * What the card sends for the questions: { answers } when each is answered as asked (in the extended
 * form, one left empty is skipped), else null. `held`: { [question]: { pick?, picks?, text? } }.
 */
export function answersOf(qs, held = {}) {
  const extended = extendedOf(qs);
  const answers = new Map();
  let size = 0;
  for (const q of qs) {
    const a = answerOf(q, held[q.question]);
    if (!a && !extended) return null;
    answers.set(q.question, a ?? { unanswered: "skipped" });
    size += [a?.text, a?.other, a?.label, ...(a?.labels ?? [])].reduce((n, s) => n + (typeof s === "string" ? s.length : 0), 0);
  }
  if (size > TEXT || [...answers.values()].every((a) => a.unanswered)) return null;
  // A Map made an object at the end: a question named `__proto__` stays a field.
  return { answers: Object.fromEntries(answers) };
}

/** Every question closed without an answer (the terminal's Esc). */
export const dismissedOf = (qs) => ({ answers: Object.fromEntries(qs.map((q) => [q.question, { unanswered: "dismissed" }])) });

/**
 * The questions card's rows, in the order ↑/↓ walk them: { q (the question's index), kind, label? }.
 * A choice question gives one `option` row per option, then its `other` (« Autre », typed); a text or
 * number question its `input`; the last row is `send` (« Envoyer »).
 */
export function rowsOf(card) {
  if (card?.kind !== "questions") return [];
  const rows = [];
  card.questions.forEach((q, i) => {
    if ((q.kind ?? "choice") !== "choice") return rows.push({ q: i, kind: "input" });
    for (const o of q.options ?? []) rows.push({ q: i, kind: "option", label: o?.label });
    rows.push({ q: i, kind: "other" });
  });
  rows.push({ q: -1, kind: "send" });
  return rows;
}

/** The cursor moved by `by` rows, kept on them (0 when there are none). */
export const moveCursor = (at, by, n) => Math.max(0, Math.min(n - 1, (Number.isInteger(at) ? at : 0) + by));

/**
 * Entrée (or a click) on row `at` of `card`: { held, focus, to }. An option is picked (a single choice;
 * the cursor then goes to the next question's first row) or toggled (a multi-select); « Autre » is
 * picked on a single choice, and its field takes the keyboard (`focus`), as a text or number question's
 * does. The send row changes nothing here: the caller sends what `sendable` gives. Never sends itself.
 */
export function enterRow(card, held, at) {
  const rows = rowsOf(card);
  const row = rows[at];
  const q = card?.questions?.[row?.q];
  if (!q) return { held, focus: false, to: at };
  const h = held[q.question] ?? {};
  const out = Object.assign(Object.create(null), held);
  if (row.kind === "option") {
    if (q.multiSelect === true) {
      const picks = h.picks ?? [];
      out[q.question] = { ...h, picks: picks.includes(row.label) ? picks.filter((l) => l !== row.label) : [...picks, row.label] };
      return { held: out, focus: false, to: at };
    }
    out[q.question] = { ...h, pick: row.label };
    const next = rows.findIndex((r, i) => i > at && r.q !== row.q);
    return { held: out, focus: false, to: next < 0 ? at : next };
  }
  if (row.kind === "other" && q.multiSelect !== true) out[q.question] = { ...h, pick: OTHER };
  return { held: out, focus: true, to: at };
}

/**
 * What question `i` shows beside its options: the preview of the option under the cursor (`at`) when it
 * is in this question, else of the one picked; "" when that one has none, or none is. Null when the
 * question has no column: not a single choice (AskUserQuestion's previews are for a single choice only),
 * or no option with a preview. The column stays as long as the question does: the list never reflows.
 */
export function previewOf(card, i, held, at) {
  const q = card?.questions?.[i];
  if (!q || (q.kind ?? "choice") !== "choice" || q.multiSelect === true) return null;
  const opts = q.options ?? [];
  if (!opts.some((o) => typeof o?.preview === "string" && o.preview)) return null;
  const row = rowsOf(card)[at];
  const label = row?.q === i && row.kind === "option" ? row.label : held?.[q.question]?.pick;
  const o = opts.find((x) => x?.label === label);
  return typeof o?.preview === "string" ? o.preview : "";
}

// A property's choices as the bridge reads them (answers.ts choices): its `enum`, or the `const` of each
// `oneOf` / `anyOf` entry, with its `title` to show.
function choicesOf(p) {
  if (Array.isArray(p.enum)) return p.enum.map((v) => ({ value: v, label: String(v) }));
  const titled = Array.isArray(p.oneOf) ? p.oneOf : Array.isArray(p.anyOf) ? p.anyOf : null;
  if (!titled || !titled.every((o) => plain(o) && "const" in o)) return null;
  return titled.map((o) => ({ value: o.const, label: typeof o.title === "string" ? o.title : String(o.const) }));
}

/**
 * An MCP form's fields, in the schema's order: { key, title, description?, required, type, choices?,
 * min?, max?, integer?, minLength?, maxLength?, minItems?, maxItems?, default? }, `type` one of
 * string, number, boolean, choice, multi. Null when the form can't be shown whole here (a type the
 * protocol doesn't allow, more than MAX_FIELDS): the terminal then.
 */
export function fieldsOf(schema) {
  if (!plain(schema) || !plain(schema.properties)) return null;
  const required = Array.isArray(schema.required) ? schema.required : [];
  const fields = [];
  for (const [key, p] of Object.entries(schema.properties)) {
    if (!plain(p)) return null;
    const f = { key, title: typeof p.title === "string" && p.title ? p.title : key, required: required.includes(key) };
    if (typeof p.description === "string" && p.description) f.description = p.description;
    if ("default" in p) f.default = p.default;
    const one = choicesOf(p);
    if (p.type === "array") {
      const items = plain(p.items) ? choicesOf(p.items) : null;
      if (!items) return null;
      Object.assign(f, { type: "multi", choices: items });
      if (typeof p.minItems === "number") f.minItems = p.minItems;
      if (typeof p.maxItems === "number") f.maxItems = p.maxItems;
    } else if (one) Object.assign(f, { type: "choice", choices: one });
    else if (p.type === "boolean") f.type = "boolean";
    else if (p.type === "string") {
      f.type = "string";
      if (typeof p.minLength === "number") f.minLength = p.minLength;
      if (typeof p.maxLength === "number") f.maxLength = p.maxLength;
    } else if (p.type === "number" || p.type === "integer") {
      Object.assign(f, { type: "number", integer: p.type === "integer" });
      if (typeof p.minimum === "number") f.min = p.minimum;
      if (typeof p.maximum === "number") f.max = p.maximum;
    } else return null;
    fields.push(f);
  }
  return fields.length && fields.length <= MAX_FIELDS ? fields : null;
}

/**
 * What the card holds at first: each field's default, a boolean false. With no prototype, as every
 * `held`: a field or a question named `__proto__` stays one.
 */
export function heldOf(fields = []) {
  const held = Object.create(null);
  for (const f of fields) {
    const d = f.default;
    if (f.type === "boolean") held[f.key] = { pick: d === true };
    else if (f.type === "choice") held[f.key] = { pick: f.choices.some((c) => c.value === d) ? d : null };
    else if (f.type === "multi") held[f.key] = { picks: Array.isArray(d) ? d.filter((v) => f.choices.some((c) => c.value === v)) : [] };
    else held[f.key] = { text: typeof d === "string" || typeof d === "number" ? String(d) : "" };
  }
  return held;
}

// One field's value, `undefined` when left out, or `null` when it doesn't fit.
function valueOf(f, h = {}) {
  if (f.type === "boolean") return h.pick === true;
  if (f.type === "choice") return f.choices.some((c) => c.value === h.pick) ? h.pick : undefined;
  if (f.type === "multi") {
    const v = [...new Set((h.picks ?? []).filter((x) => f.choices.some((c) => c.value === x)))];
    if (!v.length && !f.required) return undefined;
    return (f.minItems === undefined || v.length >= f.minItems) && (f.maxItems === undefined || v.length <= f.maxItems) ? v : null;
  }
  const text = String(h.text ?? "");
  if (text.trim() === "") return undefined;
  if (f.type === "string") {
    const n = chars(text);
    return text.length <= TEXT && (f.minLength === undefined || n >= f.minLength) && (f.maxLength === undefined || n <= f.maxLength) ? text : null;
  }
  const n = numberOf(text);
  if (!Number.isFinite(n) || (f.integer && !Number.isInteger(n))) return null;
  return (f.min === undefined || n >= f.min) && (f.max === undefined || n <= f.max) ? n : null;
}

/** The form's content for the bridge, when every required field is there and each fits; else null. */
export function contentOf(fields, held = {}) {
  const content = new Map();
  for (const f of fields) {
    const v = valueOf(f, held[f.key]);
    if (v === null || (v === undefined && f.required)) return null;
    if (v !== undefined) content.set(f.key, v);
  }
  return Object.fromEntries(content);
}

/**
 * What the card shows for `pending`: { kind: "questions", questions, extended } (an AskUserQuestion),
 * { kind: "form", fields } (an MCP form), { kind: "link", url } (an MCP link: decline or cancel), or
 * null: the card as before (a permission's choices, Ouvrir).
 */
export function cardOf(pending) {
  const qs = questionsOf(pending);
  if (qs) return { kind: "questions", questions: qs, extended: extendedOf(qs) };
  if (pending?.kind !== "elicitation") return null;
  if (pending.mode === "url") return typeof pending.url === "string" ? { kind: "link", url: pending.url } : null;
  const fields = fieldsOf(pending.schema);
  return fields ? { kind: "form", fields } : null;
}

/**
 * Which input of the pool each question or field types in: { [question or key]: index }. A question has
 * one (its text, its number, or its « Other »); a form's string and number fields one each.
 */
export function slotsOf(card) {
  const keys = card?.kind === "questions" ? card.questions.map((q) => q.question)
    : card?.kind === "form" ? card.fields.filter((f) => f.type === "string" || f.type === "number").map((f) => f.key) : [];
  return Object.fromEntries(keys.map((k, i) => [k, i]));
}

/** How many inputs a card takes from the pool. */
export const inputsOf = (card) => Object.keys(slotsOf(card)).length;

/** Who asks, for a request that isn't the lead agent's own: a sub-agent's name, else its type, else its id. */
export const whoOf = (pending) => (pending?.agent ? pending.agent.name || pending.agent.type || pending.agent.id || null : null);
