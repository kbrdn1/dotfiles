// kt-chat's composer (#56), pure: when a message can go to the agent, and how. Checked by
// composer.check.mjs. Measured with `hc send` on throwaway terminals (2026-11-19):
// - idle or done: the text is pasted then submitted, a new turn; several lines stay ONE message;
// - working: Claude Code queues it (queue-operation enqueue) and hands it over mid-turn;
// - blocked: hc refuses (exit 9, error.kind "blocked") unless --force, which would answer the
//   agent's dialog in Kylian's place: never used here;
// - a text that starts with "-" goes after `--`.

/** What sending does now, from the agent's status: "send" | "queue" | "blocked" | null (no agent). */
export function mode(status) {
  if (status === "working") return "queue";
  if (status === "blocked") return "blocked";
  if (status === "idle" || status === "done") return "send";
  return null;
}

/** The text as it goes: trailing blank lines and spaces off (Enter adds its own). */
export const clean = (text) => String(text ?? "").replace(/\s+$/, "");

/** Can it go now? { ok, why }: why is "none" (no agent), "blocked", "sending" or "empty". */
export function canSend({ status, text, sending }) {
  const m = mode(status);
  if (!m) return { ok: false, why: "none" };
  if (m === "blocked") return { ok: false, why: "blocked" };
  if (sending) return { ok: false, why: "sending" };
  if (!clean(text).trim()) return { ok: false, why: "empty" };
  return { ok: true, why: null };
}

/** `hc send` arguments: never --force; the text after `--`. */
export const sendArgs = (terminal, text) => ["send", "--json", "--", terminal, clean(text)];

/**
 * hc's answer (an ExecResult, or the error exec threw): { ok } or { ok: false, why, message }.
 * why: "blocked" (a dialog came up meanwhile), "gone" (no such terminal), "failed" (anything else,
 * a timeout included).
 */
export function sendResult(r) {
  if (r instanceof Error || r?.code == null) return { ok: false, why: "failed", message: String(r?.message ?? r ?? "") };
  let j = null;
  try {
    j = JSON.parse(r.stdout || "null");
  } catch {
    j = null;
  }
  if (r.code === 0 && !j?.error) return { ok: true };
  const kind = j?.error?.kind;
  const message = j?.error?.message ?? (r.stderr || r.stdout || "").trim().split("\n").slice(-2).join(" ");
  return { ok: false, why: kind === "blocked" || r.code === 9 ? "blocked" : kind === "not_found" ? "gone" : "failed", message };
}
