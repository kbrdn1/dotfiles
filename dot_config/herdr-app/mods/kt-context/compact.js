// compact.js (#81, Kylian 2026-11-19): « Compacter », by the Chat's ctx ring (kt-chat, the line under the
// composer) and in Context's head (kt-context), one code for both. A press asks first (kt-confirm, the ask's
// own id, askRoute's way: a cancelled ask is never answered, another copy's yes never runs it). Once said
// yes, /compact goes at rest: the agent working, at the end of its turn (said under the button; a press
// meanwhile cancels it; a wait whose session or terminal went is dropped). Then herdr-bridge types it when
// its session token is fresh (say.js), else the keys route (keysend.js: prompt empty and read again,
// Enter only on « /compact » and on a command list that chose it). Its turn is followed to its end (`hc
// get`'s count): « Session compactée », or why not (a session too short: « rien à compacter »), and the
// gauge falls. Measured on a throwaway session (haiku, 2.1.328, 2026-11-19): the status works while it
// compacts, then done; the status line's ctx_pct reads null until the next call.
// Shared byte for byte (source kt-chat, a copy in kt-context) with compact.strings.js, keysend.js and
// say.js; no host import: the mod hands herdr's functions in. Checked by compact.check.mjs (kt-chat).
import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { keysSend, sayReadyOf, sayFail } from "./keysend.js";
import { say } from "./say.js";
import { makeT } from "./i18n.js";
import strings from "./compact.strings.js";

const tr = makeT(strings);
export const COMPACT = "/compact";
export const TTL = 300000; // an ask answered later than this sends nothing
export const WAIT = 1800000; // a compaction waiting for the end of a turn longer than this is dropped
export const SHOWN = 60000; // « Session compactée » or a failure stays this long at most
const WHYS = new Set(Object.keys(strings.fr).filter((k) => k.startsWith("why.")).map((k) => k.slice(4)));

/** When /compact may go for an agent's status: "now" (idle, done), "later" (working; blocked: its dialog
 *  answered and the turn over), null (no agent). */
export const whenOf = (status) => (status === "idle" || status === "done" ? "now" : status === "working" || status === "blocked" ? "later" : null);

/**
 * The io keysSend, sayReadyOf and say.js take, from herdr's functions handed in (h = { agents, hc, exec,
 * home, readTextFile, writeTextFile, stat }) and the task's cx (its timer: a check's fake runs it at once).
 */
export function ioOf(h, cx, address) {
  const st = () => h.agents().find((a) => a.address === address)?.status ?? null;
  return {
    home: h.home(),
    read: (p) => h.readTextFile(p).catch(() => null),
    write: async (p, s) => h.writeTextFile(p, s, await h.readTextFile(p).catch(() => null)),
    mtime: (p) => h.stat(p).then((s) => s.mtimeMs),
    hc: (args) => h.hc(args),
    exec: (c, a) => h.exec(c, a),
    now: () => Date.now(),
    sleep: (ms) => new Promise((done) => cx.timer.after(ms, () => done())),
    status: st,
    blocked: async (t) => h.agents().find((a) => a.address === t)?.status === "blocked",
  };
}

/** /compact into the agent's prompt: herdr-bridge's say when ready, else the keys route. -> { ok } |
 *  { ok: false, why } (keysSend's "keys-…", or sayFail's "say-…"). */
export async function compactNow(io, address) {
  if (await sayReadyOf(io, address)) {
    const s = await say(address, COMPACT, io);
    return s.ok ? s : { ok: false, why: sayFail(s.why) };
  }
  return keysSend(io, address, [...COMPACT], COMPACT);
}

/** The agent's turn count (`hc get`), or null. A /compact is a turn of its own (measured, 2.1.328: the
 *  status works while it compacts, then done, the count one more). */
export async function turnOf(io, address) {
  try {
    const n = JSON.parse((await io.hc(["get", address, "--json"])).stdout)?.turn;
    return Number.isInteger(n) ? n : null;
  } catch {
    return null;
  }
}

/** What the terminal answered the last /compact on its screen: "empty" when it had nothing to compact
 *  (« Not enough messages to compact. », measured on a fresh session), else "done". */
export function answerOf(screen) {
  const lines = String(screen ?? "").split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!/^❯\s*\/compact\s*$/.test(lines[i].trimEnd())) continue;
    return lines.slice(i + 1, i + 4).some((l) => /Not enough messages to compact/.test(l)) ? "empty" : "done";
  }
  return "done";
}

/** Waits for the turn /compact opened to end (its count past `turn0`, the agent at rest: one look a
 *  second, 5 min at most), then reads the screen once: "done" | "empty" | null (gone, or no end seen). */
export async function endOf(io, address, turn0) {
  for (let i = 0; i < 300; i++) {
    await io.sleep(1000);
    const st = io.status();
    if (st == null) return null;
    if (whenOf(st) !== "now") continue;
    const n = await turnOf(io, address);
    if (n == null || n <= turn0) continue;
    const r = await io.hc(["read", address]).catch(() => null);
    return answerOf(r?.code === 0 ? r.stdout : "");
  }
  return null;
}

/**
 * One per view. mod: the view's mod ("kt-chat" | "kt-context"): kt-confirm calls back
 * `<mod>.compact-ok:<id>` (its nextCommand hands yes() the id). h: herdr's functions (ioOf's, and
 * openOverlay). The compactions by terminal: { id, session, at, phase: "asking" | "later" | "going" |
 * "sent" | "done" | "failed", why?, track? }.
 */
export class Compactor {
  constructor(mod, h) {
    this.mod = mod;
    this.h = h;
    this.by = new Map();
  }

  status(address) {
    return this.h.agents().find((a) => a.address === address)?.status ?? null;
  }

  /** The button pressed for `address` (`session`: its session id, a wait is dropped if it changes):
   *  waiting, the press cancels it; going, nothing; otherwise kt-confirm asks. -> "asked" | "cancelled" | null. */
  press(address, session, now = Date.now(), rnd = Math.random()) {
    const s = this.by.get(address);
    if (s?.phase === "later") {
      this.by.delete(address);
      return "cancelled";
    }
    const when = whenOf(this.status(address));
    if (!address || !when || s?.phase === "going") return null;
    const id = `${address}~${now.toString(36)}${Math.floor(rnd * 1e9).toString(36)}`;
    this.by.set(address, { id, session: session ?? null, at: now, phase: "asking" });
    this.h.openOverlay({ mod: "kt-confirm", kind: "dialog", width: 1, height: 1, frame: "none", props: {
      title: tr("ask.title"), detail: when === "later" ? `${tr("ask.detail")}\n\n${tr("ask.later")}` : tr("ask.detail"),
      label: tr("ask.label"), tone: "info", command: { name: `${this.mod}.compact-ok:${id}` } } });
    return "asked";
  }

  /** kt-confirm said yes to `id`: that ask only, while fresh; it goes at the next tick at rest, else waits. */
  yes(id, now = Date.now()) {
    for (const [address, s] of this.by) {
      if (s.phase !== "asking" || !id || s.id !== id) continue;
      if (now - s.at > TTL) this.by.delete(address);
      else this.by.set(address, { ...s, phase: "later", at: now });
      return now - s.at <= TTL;
    }
    return false;
  }

  /**
   * From a render or a timer (both may call it: one send an ask, its phase moves before the task).
   * shown: { address, session } the view follows now (a wait for that address whose session changed is
   * dropped). cx: a view's context (spawn, notify, timer). -> true when what shows changed.
   */
  tick(cx, shown = {}, now = Date.now()) {
    let changed = false;
    for (const [address, s] of [...this.by]) {
      const status = this.status(address);
      const drop = () => { this.by.delete(address); changed = true; };
      if (s.phase === "asking") { if (now - s.at > TTL) drop(); continue; }
      if (s.phase === "later") {
        const other = shown.address === address && shown.session != null && s.session != null && shown.session !== s.session;
        if (status == null || other || now - s.at > WAIT) { drop(); continue; }
        if (whenOf(status) !== "now") continue;
        this.by.set(address, { ...s, phase: "going", at: now });
        changed = true;
        // The send, then its turn followed to its end: « Compaction en cours », then « Session compactée »,
        // or why not (« Not enough messages to compact. » on a session too short).
        cx.spawn(async (cx) => {
          const io = ioOf(this.h, cx, address);
          const set = (patch) => {
            const cur = this.by.get(address);
            if (cur?.id === s.id) this.by.set(address, { ...cur, ...patch, at: Date.now() });
            cx.notify();
          };
          const turn0 = await turnOf(io, address);
          const r = await compactNow(io, address);
          if (!r.ok) return set({ phase: "failed", why: r.why });
          set({ phase: "sent", track: turn0 != null });
          if (turn0 == null) return;
          const end = await endOf(io, address, turn0);
          if (end === "empty") set({ phase: "failed", why: "empty" });
          else if (end === "done") set({ phase: "done" });
          else set({ phase: "sent", track: false }); // no end seen: it fades as an untracked send
        });
        continue;
      }
      // Its own task ends a tracked send; an untracked one (no turn count) goes after SHOWN.
      if (s.phase === "sent" && !s.track && (status == null || now - s.at > SHOWN)) drop();
      if ((s.phase === "failed" || s.phase === "done") && now - s.at > SHOWN) drop();
    }
    return changed;
  }

  /** What shows for `address`: { label, tip, note, error, press: false while it goes }. */
  words(address) {
    const s = this.by.get(address);
    const ph = s?.phase;
    const why = s?.why && WHYS.has(s.why) ? s.why : "say-refused";
    return {
      label: ph === "later" ? tr("button.cancel") : ph === "going" || ph === "sent" ? tr("button.going") : tr("button"),
      tip: ph === "later" ? tr("button.cancelTip") : tr("button.tip"),
      note: ph === "later" ? tr("note.later") : ph === "going" ? tr("note.going") : ph === "sent" ? tr("note.sent")
        : ph === "done" ? tr("note.done") : ph === "failed" ? tr("note.failed", { why: tr(`why.${why}`) }) : null,
      error: ph === "failed",
      press: ph !== "going" && ph !== "sent",
    };
  }
}

/** The button, the same in both views: a small pill (h 22) that never moves its line. */
export function compactButton(t, id, words, onPress) {
  return h_flex().id(id).flex_none().h(22).px(8).items_center().rounded(6).border(1).border_color(t.border)
    .text_size(11.5).text_color(words.press ? t.muted : t.dim).tooltip(words.tip)
    .when(words.press, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => { cx.stop_propagation(); onPress(cx); cx.notify(); }))
    .child(div().truncate().child(words.label));
}
