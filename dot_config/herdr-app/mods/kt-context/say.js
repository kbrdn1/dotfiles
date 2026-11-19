// kt-chat's send through herdr-bridge (dotfiles #81, kbrdn-herdr « say »): the plugin types the message
// into the agent's prompt box, then Herdr presses Enter. It reaches the transcript as typed (origin
// human, no <hc> envelope), so a /command or a skill runs. Checked by say.check.mjs.
//
// The mailbox, under ~/.claude/cache/herdr/:
// - <t>.saytoken.json = { token }: the session's token, drawn by the plugin at session start;
// - <t>.say.json = { id, token, text }: written here, on Kylian's Send only;
// - <t>.said.json = { id, ok, why? }: the plugin's answer. why: "draft" (text in the box, left alone),
//   "dialog" (a dialog is open), "changed" (the box no longer reads the text), "token", "text".
// Enter goes only after { ok: true } for this id. Working, Claude Code queues it as a typed message.

const path = (home, terminal, name) => `${home}/.claude/cache/herdr/${terminal}.${name}.json`;
const parse = (text) => {
  try {
    return JSON.parse(text ?? "null");
  } catch {
    return null;
  }
};

let n = 0;
/** A fresh id for one Send. */
export const sayId = (now = Date.now()) => `say-${now.toString(36)}-${++n}`;

/** The plugin's answer for `id`, or null while it hasn't answered that one. */
export function saidOf(text, id) {
  const s = parse(text);
  if (s?.id !== id) return null;
  return s.ok === true ? { ok: true } : { ok: false, why: typeof s.why === "string" ? s.why : "refused" };
}

/**
 * Sends `text` to `terminal`'s agent: { ok } or { ok: false, why }. why, besides the plugin's: "noBridge"
 * (no session token: herdr-bridge >= the say change isn't running there; nothing written), "timeout"
 * (no answer: the text may sit in the box, never sent), "blocked" (a dialog came up after ok: the
 * text waits in the box, no Enter), "enter" (hc keys failed after ok).
 * io = { home, read(path), write(path, text), hc(args), sleep(ms), blocked(terminal) }: herdr's, or a
 * check's fakes.
 */
export async function say(terminal, text, io, { id = sayId(), tries = 20, every = 150 } = {}) {
  const token = parse(await io.read(path(io.home, terminal, "saytoken")))?.token;
  if (typeof token !== "string" || !token) return { ok: false, why: "noBridge" };
  await io.write(path(io.home, terminal, "say"), JSON.stringify({ id, token, text }));
  for (let i = 0; i < tries; i++) {
    await io.sleep(every);
    const s = saidOf(await io.read(path(io.home, terminal, "said")), id);
    if (!s) continue;
    if (!s.ok) return s;
    // A dialog that came up since ok would take the Enter (hc keys has no guard): none, or no Enter.
    // The text then waits in the box for Kylian, as on a timeout.
    const live = parse(await io.read(`${io.home}/.claude/cache/herdr/${terminal}.json`));
    if (live?.pending || (await io.blocked(terminal))) return { ok: false, why: "blocked" };
    const r = await io.hc(["keys", terminal, "enter"]).catch(() => null);
    return r?.code === 0 ? { ok: true } : { ok: false, why: "enter" };
  }
  return { ok: false, why: "timeout" };
}
