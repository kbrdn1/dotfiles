// kt-machine-add: Herdr's « Add a machine » (the shipped machine-add, herdr-app 0.1.16) in kbrdn Threads' words
// and look: the hosts of ~/.ssh/config to pick from (or one typed), each added with `hc machine add`; when the
// machine needs an answer first (a password, a new host key, herdr-core to install there), what to run in a
// terminal; a Mac's Full Disk Access, a server that ends programs at logout.
// A clone of machine-add, to resync by hand after each Herdr update: its logic (shellArg, includeFiles,
// parseConfig, refresh, isAdded, add, checkMac) is machine-add's line for line, but for the known deviations
// that clone.check.mjs lists (its three messages in strings.js, the init's hc and ssh config read behind
// checking()); that check fails as soon as the shipped machine-add changes. Only the words and the look are
// ours: kt-prompt's card (a veil, a dithered head, a dashed rule, the foot), motion.js' sheet, shortcuts.js'
// keys. Opened by kt-machines (its « + » and the linger warning) and kt-project-picker; Herdr's own openings
// (Settings › Machines, the welcome) keep the shipped one.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, TextView } from "gpui-base";
import { hc, exec, home, readTextFile, theme, props, closeOverlay, settings, shared, checking } from "herdr";
import { motionState, frame, sheet, leave, sharpen } from "./motion.js";
import { ditherBand, TOP } from "./dither.js";
import { kbd } from "./shortcuts.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";

const tr = makeT(strings);
const MONO = "Monaspace Krypton";
const CARD = 540;
const SERVER = "mods/kt-machines/server.svg";
// A color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const veil = () => (settings().dark ? alpha("#000000", "8c") : alpha("#0a0a0a", "59"));

const I = (name) => `mods/workspace-chrome/${name}.svg`;
const shellArg = (target) => /^[a-z0-9_@%+=:,./-]+$/i.test(target) ? target : "'" + target.replace(/'/g, "'\\''") + "'";

// An Include's files, as ssh finds them: ~ is home, a relative path is
// under ~/.ssh, and a pattern matches files (through sh; none where there's no sh).
async function includeFiles(value) {
  const paths = (value.match(/"[^"]*"|\S+/g) ?? [])
    .map((p) => p.replace(/^"|"$/g, ""))
    .map((p) => (p.startsWith("~/") ? `${home()}/${p.slice(2)}` : p.startsWith("/") || /^[a-z]:[\\/]/i.test(p) ? p : `${home()}/.ssh/${p}`));
  const files = [];
  for (const p of paths) {
    if (!/[*?[]/.test(p)) {
      files.push(p);
      continue;
    }
    // From a Windows program, Git's sh gets the pattern already expanded, one
    // argument per file, unless a space made it quoted: then sh expands it, and
    // takes a backslash as an escape. So read every argument, never split one
    // at its spaces, and give sh slashes.
    const glob = /^[a-z]:/i.test(p) ? p.replace(/\\/g, "/") : p;
    const r = await exec("sh", ["-c", 'IFS=; for p in "$@"; do for f in $p; do [ -f "$f" ] && printf "%s\\n" "$f"; done; done', "sh", glob]).catch(() => null);
    files.push(...(r?.stdout ?? "").split("\n").filter(Boolean));
  }
  return files;
}

// Host entries people can pick: named ones, not patterns, from the file
// and the files it includes (ssh stops 16 deep).
async function parseConfig(text, hosts = [], depth = 0) {
  let cur = null;
  for (const raw of (text ?? "").split("\n")) {
    const m = raw.trim().match(/^([^\s#=]+)\s*=?\s*(.*)$/);
    if (!m) continue;
    const [key, value] = [m[1].toLowerCase(), m[2].trim()];
    if (key === "host" || key === "match") {
      const names = key === "host" ? value.split(/\s+/).filter((h) => h && !/[*?!]/.test(h) && !hosts.some((x) => x.alias === h || x.aliases.includes(h))) : [];
      cur = names.length ? { alias: names[0], aliases: names.slice(1), hostname: null, user: null } : null;
      if (cur) hosts.push(cur);
    } else if (key === "include" && depth < 16) {
      for (const f of await includeFiles(value)) await parseConfig(await readTextFile(f).catch(() => null), hosts, depth + 1);
    } else if (cur && key === "hostname") cur.hostname = value;
    else if (cur && key === "user") cur.user = value;
  }
  return hosts;
}

export default class MachineAdd extends View {
  init(_props, cx) {
    this.hosts = null;
    this.added = [];
    this.state = {}; // target -> "adding" | error text
    this.pending = new Set();
    this.refreshing = false;
    this.typed = "";
    this.input = InputState.new({ placeholder: "user@host" }); // i18n: tech
    this.input.on("change", (_e, cx) => { this.typed = this.input.value(); cx.notify(); });
    this.input.on("submit", (_e, cx) => this.add(this.typed, cx));
    this.inputFocused = true;
    this.input.on("focus", (_e, cx) => { this.inputFocused = true; cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.inputFocused = false; cx.notify(); });
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
    this.macs = {}; // target -> { name, core } for an added Mac
    this.opened = {};
    this.handle = cx.focus_handle();
    this.motion = motionState(); // ANIMATIONS.md: the veil fades in, the card rises 6 px; out on dismiss
    // A known deviation (clone.check.mjs): `herdr-app check` runs init for real, and nothing may reach a
    // machine during a check, so machine-add's hc and ~/.ssh/config read wait for the live window.
    if (!checking()) {
      cx.spawn(async (cx) => {
        this.hosts = await parseConfig(await readTextFile(`${home()}/.ssh/config`).catch(() => null));
        await this.refresh();
        cx.notify();
      });
      cx.timer.every(3000, (cx) => {
        if ((!this.pending.size && !this.added.length) || this.refreshing) return;
        this.refreshing = true;
        cx.spawn(async (cx) => {
          try {
            await this.refresh();
            cx.notify();
          } finally {
            this.refreshing = false;
          }
        });
      });
    }
  }

  async refresh() {
    const r = await hc(["machine", "ls", "--json"]).catch(() => null);
    try {
      this.added = r?.code === 0 ? (JSON.parse(r.stdout).machines ?? []).filter((m) => !m.temporary) : [];
    } catch {
      this.added = [];
    }
    for (const target of this.pending) {
      if (!this.isAdded(target)) continue;
      this.pending.delete(target);
      delete this.state[target];
      if (this.typed.trim() === target) {
        this.input.set_value("");
        this.typed = "";
      }
      await this.checkMac(target);
    }
  }

  isAdded(target) {
    return this.added.some((m) => m.target === target || m.name === target || m.host === target);
  }

  add(target, cx) {
    target = target.trim();
    if (!target || this.state[target] === "adding") return;
    if (target.startsWith("-")) { this.state[target] = tr("dashTarget", { target }); cx.notify(); return; } // never an option to hc (-oProxyCommand=…): not in machine-add 0.1.16
    this.pending.delete(target);
    this.state[target] = "adding";
    cx.notify();
    cx.spawn(async (cx) => {
      const r = await hc(["machine", "add", target, "--json"]).catch((e) => ({ code: 1, stderr: String(e), stdout: "" }));
      let why = null;
      try {
        why = r.code === 0 ? null : (JSON.parse(r.stdout || r.stderr).error ?? { message: (r.stderr || r.stdout).trim() });
      } catch {
        why = { message: (r.stderr || r.stdout || tr("noAnswer")).trim() };
      }
      if (!why) {
        delete this.state[target];
        this.input.set_value("");
        this.typed = "";
        await this.refresh();
        await this.checkMac(target);
      } else if (["hc_missing", "incompatible", "login_needed", "auth_failed", "host_key"].includes(why.kind) || /password|passphrase|host key|permission denied|login/i.test(why.message ?? "")) {
        const quoted = shellArg(target);
        this.pending.add(target);
        this.state[target] = tr("needsAnswer", { target, command: `hc machine add ${quoted}` });
      } else this.state[target] = why.message || tr("failed");
      await this.refresh();
      cx.notify();
    });
  }

  // macOS asks on its own screen before anything reads Desktop, Documents
  // or Downloads, and the asking program waits: say so once, with the way
  // to allow it for good.
  async checkMac(target) {
    const m = this.added.find((x) => x.target === target || x.name === target);
    if (!m) return;
    const r = await exec("sh", ["-c", 'uname; command -v herdr-core || echo "$HOME/.local/bin/herdr-core"'], { on: m.name }).catch(() => null);
    const [os, core] = (r?.stdout ?? "").trim().split("\n");
    if (os === "Darwin") this.macs[target] = { name: m.name, core: core ?? "~/.local/bin/herdr-core" };
  }

  // motion.js leave(): the veil fades out and the card sinks, then the dialog closes.
  dismiss(cx) {
    leave(this.motion, cx, "kma", () => closeOverlay(props().overlay));
  }

  // A small hairline pill (kt-machines'), or a solid one: an action in a row, a card or the foot. A click on it
  // stays its own (not the row's).
  pill(t, id, label, onClick, solid = false) {
    return h_flex().id(id).flex_none().h(24).px(9).items_center().rounded_full().border(1)
      .border_color(solid ? t.solid : t.border).bg(solid ? t.solid : alpha(t.background, "00"))
      .font_family(MONO).text_size(10.5).text_color(solid ? t.solid_foreground : t.muted).cursor_pointer()
      .hover((s) => (solid ? s.opacity(0.88) : s.bg(t.hover).text_color(t.foreground)))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click((e, cx) => { cx.stop_propagation(); onClick(e, cx); })
      .child(label.toUpperCase());
  }

  // A warning inside a row (the blocked tint): its title, then what to do.
  warning(t, id, title, children) {
    return v_flex().id(id).mx(12).mb(10).p(12).gap(8).rounded(10)
      .bg(alpha(t.blocked, "14")).border(1).border_color(alpha(t.blocked, "40"))
      .child(div().text_size(12.8).font_semibold().text_color(t.foreground).child(title))
      .children(children);
  }

  logoutCard(t, m) {
    const command = `sudo loginctl enable-linger -- ${shellArg(m.logout_linger_user ?? "<user>")}`; // i18n: tech
    return this.warning(t, `kma-logout-${m.name}`, tr("logout.title", { name: m.name }), [
      div().text_size(12.5).line_height("18px").text_color(t.muted).child(tr("logout.text")),
      div().text_size(12.5).text_color(t.muted).child(tr("logout.run", { name: m.name })),
      h_flex().gap(8).items_center()
        .child(div().flex_1().min_w(0).font_family(MONO).text_size(11.5).text_color(t.foreground).child(command))
        .child(this.pill(t, `kma-logout-copy-${m.name}`, this.copiedCommand === command ? tr("copied") : tr("copy"),
          (_e, cx) => { cx.write_to_clipboard(command); this.copiedCommand = command; cx.notify(); })),
    ]);
  }

  macCard(t, target) {
    const mac = this.macs[target];
    return this.warning(t, `kma-mac-card-${target}`, tr("mac.title", { name: mac.name }), [
      div().text_size(12.5).line_height("18px").text_color(t.muted).child(tr("mac.text")),
      div().px(8).py(4).rounded(6).bg(t.background).border(1).border_color(t.border).font_family(MONO).text_size(11.5).text_color(t.foreground).child(mac.core),
      h_flex().gap(8).items_center()
        .child(this.pill(t, `kma-mac-${target}`, tr("mac.open", { name: mac.name }), (_e, cx) => {
          exec("open", ["x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"], { on: mac.name }).catch(() => null);
          this.opened[target] = true;
          cx.notify();
        }, true))
        .when(Boolean(this.opened[target]), (el) => el.child(div().text_size(12).text_color(t.dim).child(tr("mac.opened")))),
    ]);
  }

  message(t, target) {
    const text = String(this.state[target]).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const command = `hc machine add ${shellArg(target)}`;
    return v_flex().gap(6)
      // In light, blocked is 4.1:1 (FILTERS.md, #81): foreground words, the hue on a dot before them.
      .child(h_flex().gap(6).items_start()
        .when(!settings().dark, (el) => el.child(div().size(6).mt(5).flex_none().rounded_full().bg(t.blocked)))
        .child(div().flex_1().min_w(0).text_size(12).line_height("17px").text_color(settings().dark ? t.blocked : t.foreground)
          .child(TextView.html(`kma-message-${target}`, `<span>${text}</span>`).selectable(true)))) // i18n: tech
      .when(this.pending.has(target), (el) => el.child(h_flex().child(this.pill(t, `kma-copy-${target}`, this.copiedCommand === command ? tr("copied") : tr("copy"),
        (_e, cx) => { cx.write_to_clipboard(command); this.copiedCommand = command; cx.notify(); }))));
  }

  // One machine to add, or added (kt-machines' card): the server mark, its name, how ssh reaches it, then Add,
  // Connecting or Added; under it, why it failed, a Mac's setting, a logout warning.
  row(t, target, label, sub) {
    const st = this.state[target];
    const done = this.isAdded(target);
    const machine = this.added.find(m => m.target === target || m.name === target || m.host === target);
    const right = done
      ? h_flex().flex_none().gap(5).items_center().font_family(MONO).text_size(10.5).text_color(t.ansi2).child(svg(I("circle-check")).size(13)).child(tr("added").toUpperCase())
      : st === "adding"
        ? h_flex().flex_none().gap(6).items_center().font_family(MONO).text_size(10.5).text_color(t.muted).child(svg(I("spinner")).size(12).text_color(t.working).spin(900)).child(tr("connecting").toUpperCase())
        : this.pill(t, `kma-add-${target}`, tr("add"), (_e, cx) => this.add(target, cx));
    const idle = !done && !st;
    return v_flex().flex_none().rounded(12).border(1).border_color(t.border).bg(t.background)
      .child(h_flex().id(`kma-row-${target}`).h(42).px(12).gap(10).items_center().rounded(12)
        .hover((s) => s.bg(t.hover))
        .when(idle, (el) => el.cursor_pointer().on_click((_e, cx) => this.add(target, cx)))
        .child(svg(SERVER).size(15).flex_none().text_color(t.muted))
        .child(div().flex_none().max_w(200).truncate().text_size(13.5).font_medium().text_color(t.foreground).child(label))
        .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(11).text_color(t.dim).child(sub ?? ""))
        .child(right))
      .when(typeof st === "string" && st !== "adding", (el) => el.child(div().px(12).pb(10).child(this.message(t, target))))
      .when(Boolean(this.macs[target]), (el) => el.child(this.macCard(t, target)))
      .when(machine?.keeps_running_after_logout === false, (el) => el.child(this.logoutCard(t, machine)));
  }

  render() {
    const t = theme();
    const hosts = this.hosts ?? [];
    const typed = this.typed.trim();
    const still = Boolean(shared("kt.reducedMotion"));
    const s = sheet(frame(this.motion, still), "kma", still || Boolean(this.size));
    const dark = settings().dark;
    // The head (kt-confirm's): a 60 px band over the pixel dither, in the accent; the mark, the title, a mono
    // line, esc.
    const head = div().id("kma-head").relative().flex_none().h(60).overflow_hidden().rounded_t(15)
      .on_size_change((size, cx) => {
        if (Math.abs((this.headW ?? 0) - size.width) < 0.5) return;
        this.headW = size.width;
        cx.notify();
      })
      .when(this.headW > 30, (el) => el.child(ditherBand(this.headW, 60, 15, alpha(t.accent, dark ? "6b" : "4d"), TOP)))
      .child(h_flex().size_full().px(14).gap(12).items_center()
        .child(h_flex().size(32).flex_none().rounded(10).items_center().justify_center().border(1).border_color(alpha(t.accent, "4d")).bg(alpha(t.surface, "e6"))
          .child(svg(SERVER).size(16).text_color(t.accent)))
        .child(v_flex().flex_1().min_w(0).gap(2)
          .child(sharpen(this.motion, "kma-title", () => div().truncate().text_size(14).font_semibold().text_color(t.foreground).child(tr("title"))))
          .child(div().truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child(tr("sub"))))
        .child(kbd(t, "escape"))); // i18n: tech
    const label = (text) => div().pt(6).font_family(MONO).text_size(10.5).text_color(t.dim).child(text.toUpperCase());
    // The field, form.js' ring and box (kt-prompt's): the accent ring while it has the keyboard.
    const field = div().flex_1().min_w(0).p(3).rounded(15).bg(this.inputFocused ? alpha(t.accent, "33") : alpha(t.accent, "00"))
      .child(Input.new(this.input).w_full().h(36).px(12).rounded(12).border(1).border_color(this.inputFocused ? t.accent : t.input)
        .bg(t.background).text_size(13).text_color(t.foreground));
    const addTyped = h_flex().id("kma-add-typed").flex_none().h(36).px(14).items_center().rounded_full().border(1).border_color(t.solid)
      .bg(t.solid).text_color(t.solid_foreground).font_family(MONO).text_size(11).when(!typed, (el) => el.opacity(0.4))
      .cursor_pointer().hover((x) => x.opacity(0.88)).on_click((_e, cx) => this.add(this.typed, cx)).child(tr("add").toUpperCase());
    const body = v_flex().id("kma-body").p(16).gap(8).min_h(0).max_h(Math.max(240, (this.size?.height ?? 900) - 200)).overflow_y_scroll()
      .child(div().text_size(12.8).line_height("19px").text_color(t.muted).child(tr("intro")))
      .child(label(hosts.length ? tr("hosts.title") : this.hosts === null ? tr("hosts.reading") : tr("hosts.none")))
      .children(hosts.filter(h => !this.isAdded(h.alias)).map((h) => this.row(t, h.alias, h.alias, [h.user, h.hostname].filter(Boolean).join("@") || (h.aliases.length ? tr("hosts.also", { names: h.aliases.join(", ") }) : ""))))
      .children(this.added.map(m => this.row(t, m.target, m.name, m.target)))
      .child(label(tr("typed.title")))
      .child(h_flex().gap(8).items_center().child(field).child(addTyped))
      .when(Boolean(typed && this.state[typed]), (el) => el.child(div().pt(2).child(this.message(t, typed))));
    const hint = (k, what) => h_flex().gap(5).items_center().child(kbd(t, k)).child(div().child(what));
    const card = v_flex().id("kma-card")
      // A press in the card never reaches the veil.
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .w(CARD).max_w_full().min_h(0).p(4).rounded(20).bg(t.popover).border(1).border_color(t.border).shadow_lg().text_size(13)
      .child(v_flex().min_h(0).rounded(16).bg(t.surface).border(1).border_color(t.border)
        .child(head)
        .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(alpha(t.accent, "4d")))
        .child(body)
        .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(t.border))
        .child(h_flex().flex_none().px(12).py(10).gap(10).items_center().text_size(11).text_color(t.dim)
          .when(Boolean(typed), (el) => el.child(hint("enter", tr("foot.add"))))
          .child(hint("escape", tr("foot.close")))));
    return s.veil(div().id("kma-veil").size_full().flex().items_center().justify_center())
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key !== "escape") return;
        this.dismiss(cx);
        cx.stop_propagation();
      })
      .on_size_change((size, cx) => {
        this.size = size;
        cx.notify();
      })
      // A press, not on_click: on the element holding the keyboard, GPUI turns Space and Enter into a click.
      .bg(veil())
      .on_mouse_down("left", (_e, cx) => this.dismiss(cx))
      .child(s.card(card));
  }
}
