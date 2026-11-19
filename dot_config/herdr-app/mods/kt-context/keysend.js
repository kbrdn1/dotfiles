// keysend.js (kt-chat, #81 L4): the raw-keys route of a Claude Code built-in (complete.js' routeOf: via
// "keys"). Kylian's rule: at rest, prompt empty, the screen read again before Enter. The steps
// (keysSend() runs them with hc): status idle or done; `hc read` -> promptEmpty(); `hc keys <t> …keys`;
// `hc read` -> typedOk() and the command list's chosen row; then `hc keys <t> enter`. Any step that
// fails stops before Enter, and says why (what was typed stays in the terminal's prompt, never sent).
// Measured on a throwaway session (2.1.328, 2026-11-19): `/context` typed key by key, its command list
// opens ABOVE the prompt (its chosen row "  ❯ /context", indented), the prompt keeps its two rules,
// Enter runs it (a new turn, the status stays idle). Vim mode shows « -- INSERT -- » under the prompt;
// in NORMAL the letters would be motions: not at rest. The prompt's ❯ is followed by a no-break space
// (seen on a live session): trim() takes it.
// Shared byte for byte (source kt-chat, a copy in kt-context: its « Compacter », compact.js): no host
// import, the host comes in as `io`. Checked by keysend.check.mjs (kt-chat).

// The prompt's line index in `hc read` text: the last "❯" line framed by ─ rules; -1: none.
function promptAt(lines) {
  for (let i = lines.length - 1; i > 0; i--) {
    if (!lines[i].trimEnd().startsWith("❯")) continue;
    if ((lines[i - 1]?.trim() ?? "").startsWith("─") && (lines[i + 1]?.trim() ?? "").startsWith("─")) return i;
  }
  return -1;
}

// The prompt line of Claude Code's TUI in `hc read` text: the last "❯" line framed by ─ rules. (Not
// attach.js' promptOf (#93), which composes the text a message sends.)
export function promptLine(screen) {
  const lines = String(screen ?? "").split("\n");
  const i = promptAt(lines);
  return i < 0 ? null : lines[i].trimEnd().slice(1).trim(); // no prompt on screen (a dialog, a pager): not at rest
}

/** The command Claude Code's command list has chosen, the one Enter takes: the list opens ABOVE the
 *  prompt's rule while a /command is typed ("  ❯ /context   What fills…", indented), a long description
 *  going on under its row at the description's column (seen on /compact, 2.1.328); null: no list. */
export function listChoice(screen) {
  const lines = String(screen ?? "").split("\n");
  const i = promptAt(lines);
  for (let j = i - 2; i > 0 && j >= 0; j--) {
    const m = /^\s+(❯\s*)?(\/\S+)/.exec(lines[j]);
    if (!m && /^\s{8,}\S/.test(lines[j])) continue; // a description going on
    if (!m) break; // above the list
    if (m[1]) return m[2];
  }
  return null;
}

/** Empty: nothing typed (a fresh session shows its « Try "…" » hint, dim, as text), and not in vim's NORMAL. */
export function promptEmpty(screen) {
  if (/-- NORMAL --/.test(String(screen ?? ""))) return false;
  const p = promptLine(screen);
  return p === "" || (p != null && /^Try ".*"$/.test(p));
}

/** What was typed is exactly the command, nothing before it. */
export const typedOk = (screen, text) => promptLine(screen) === String(text).trim();

/**
 * The bridge's route (complete.js' routeOf({ say })): herdr-bridge 0.5.0 (kbrdn-herdr#8) writes
 * ~/.claude/cache/herdr/<address>.saytoken.json = { token } at each session start (chat-dev). Ready when
 * its token is a non-empty string AND the file is not older than the agent's process (etimeMs): a token
 * left by an earlier run (a Claude restarted, or resumed, without the bridge) would get no answer, a
 * timeout, and nothing sent. text: the file's content (null: none); mtime and sessionStart in ms.
 */
// etime counts whole seconds: now - etime can land up to ~1 s after the real start. A token is written at
// session.start, after the plugins load, so 2 s of slack never lets an earlier run's token through.
const SLACK = 2000;

export function sayReady(text, mtime, sessionStart) {
  let token = null;
  try { token = JSON.parse(text ?? "null")?.token; } catch { token = null; }
  return typeof token === "string" && token.length > 0 && Number(mtime) >= Number(sessionStart) - SLACK;
}

/**
 * sayReady's `sessionStart`: when the agent's process started, not its transcript (a `claude --resume`
 * keeps its transcript's first entry: chat-dev). The process is `hc get <t> --json`'s foreground.pid;
 * `ps -o etime= -p <pid>` says how long it has run, "[[dd-]hh:]mm:ss", the same in every locale (lstart
 * is localized). -> ms, or null when unreadable.
 */
export function etimeMs(s) {
  const m = /^\s*(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)\s*$/.exec(String(s ?? ""));
  if (!m) return null;
  const [d, h, mi, se] = [m[1], m[2], m[3], m[4]].map((x) => Number(x ?? 0));
  return (((d * 24 + h) * 60 + mi) * 60 + se) * 1000;
}

/**
 * The step that stops the route, or null: { why: "busy" | "read" | "prompt" | "typed" | "list" }.
 * `before` and `after` are the screens read before and after typing; a key left out is a step not
 * reached yet, but a screen given as null (a read that failed, a timeout) stops it: never type, never
 * Enter, on a prompt nobody read (#81 review: Enter went on a prompt that held « foo »). After typing,
 * the command list's chosen row must name the command itself: Enter takes that row, not the prompt.
 */
export function blockOf(step) {
  const { status, text } = step;
  if (status !== "idle" && status !== "done") return { why: "busy" };
  if ("before" in step && typeof step.before !== "string") return { why: "read" };
  if ("before" in step && !promptEmpty(step.before)) return { why: "prompt" };
  if ("after" in step && typeof step.after !== "string") return { why: "read" };
  if ("after" in step && !typedOk(step.after, text)) return { why: "typed" };
  if ("after" in step) {
    const chosen = listChoice(step.after);
    if (chosen != null && chosen !== String(text).trim().split(/\s+/)[0]) return { why: "list" };
  }
  return null;
}

/**
 * The keys route, run: the screen read (`hc read`), the keys, the screen read again until it reads
 * exactly `text` (6 reads, 120 ms apart: never Enter on a doubt), then Enter. io = { hc(args),
 * status(): the agent's status now, sleep(ms) }. -> { ok } | { ok: false, why: "keys-<blockOf's why>" |
 * "keys-failed" }. A read that failed (thrown, timed out, a non-zero exit) is null: blockOf stops on it.
 */
export async function keysSend(io, address, keys, text) {
  const screen = async () => {
    const r = await io.hc(["read", address]).catch(() => null);
    return r?.code === 0 && typeof r.stdout === "string" ? r.stdout : null;
  };
  let b = blockOf({ status: io.status(), before: await screen(), text });
  if (b) return { ok: false, why: `keys-${b.why}` };
  if ((await io.hc(["keys", address, ...keys]).catch(() => null))?.code !== 0) return { ok: false, why: "keys-failed" };
  for (let i = 0; i < 6; i++) {
    b = blockOf({ status: io.status(), after: await screen(), text });
    if (!b) break;
    await io.sleep(120);
  }
  if (b) return { ok: false, why: `keys-${b.why}` };
  return (await io.hc(["keys", address, "enter"]).catch(() => null))?.code === 0 ? { ok: true } : { ok: false, why: "keys-failed" };
}

/**
 * herdr-bridge can type into this agent's box (sayReady): its session token is there and not older than
 * the agent's process (`hc get` foreground.pid, `ps -o etime=`). No token file: false at once, nothing
 * else asked. This computer's agents only. io = { home, read(path), mtime(path), hc(args), exec(cmd,
 * args), now() }.
 */
export async function sayReadyOf(io, address) {
  if (!address || address.includes("/")) return false;
  const p = `${io.home}/.claude/cache/herdr/${address}.saytoken.json`;
  const text = await io.read(p).catch(() => null);
  if (!text) return false;
  const mtime = await io.mtime(p).catch(() => null);
  let pid = null;
  try {
    pid = JSON.parse((await io.hc(["get", address, "--json"])).stdout)?.foreground?.pid ?? null;
  } catch {
    pid = null;
  }
  const age = pid ? etimeMs((await io.exec("ps", ["-o", "etime=", "-p", String(pid)]).catch(() => null))?.stdout) : null;
  return mtime != null && age != null && sayReady(text, mtime, io.now() - age);
}

/**
 * Why herdr-bridge's say() didn't send (say.js), as the words under the card say it: each has its own
 * (composer.err.say-<why>), what the plugin may add later reads as « refused ». The box may hold the
 * text (timeout, changed, blocked, enter: typed, never submitted) or not (the rest).
 */
export const SAY_FAILS = ["noBridge", "draft", "dialog", "changed", "token", "text", "timeout", "blocked", "enter", "refused"];
export const sayFail = (why) => `say-${SAY_FAILS.includes(why) ? why : "refused"}`;
