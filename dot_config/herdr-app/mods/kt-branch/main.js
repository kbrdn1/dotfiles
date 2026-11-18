// kbrdn Threads' branch popup, opened from the status line's checkout item (kt-composer): the
// focused pane's repo, its local branches (latest commit first) and its worktrees, filtered as you
// type (Enter takes the highlighted row, up/down move it).
// A branch: `git switch` in the pane's folder, always confirmed first (kt-confirm, else confirm) and
// refused while the pane's agent is working. The popup closes for the dialog, so the switch itself
// runs in kt-composer, which stays on screen: the dialog answers `kt-composer.switch` and the
// target waits in shared "kt-branch.switch". A worktree: its space if one is there, else a new one.
// Nothing here deletes a branch or a worktree, resets or stashes.
// Data (DATA-SYNC.md, bus.js): it runs no git command that changes the repo (kt-composer switches,
// kt-new makes worktrees, both bump), so it bumps nothing; it listens to git:<root> and git, and
// reads the repo again while open.
// Props: { cwd, machine, terminal, pane }; opened bare (mod.open), the focused pane's.
// Keys (vim.js): it opens typing in the filter (INSERT: the Input types, deletes and submits
// itself); ctrl-n / ctrl-j / ↓ and ctrl-k / ↑ move the highlight, tab / shift-tab jump to the
// worktrees / the branches, Esc goes to NORMAL (the keyboard on the popup's own handle; it stays).
// NORMAL: j / k (↓ ↑, round), gg / G, ctrl-d / ctrl-u move; enter, o or l takes the row; tab /
// shift-tab as above; / or a click in the field types again; q or esc closes; ? the keys (kt-keys,
// Modales). `kt-branch.key:<keys>` feeds keys ("escape j", "g g"), `kt-branch.query:<text>` sets
// the filter: for tests.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, ScrollHandle } from "gpui-base";
import { agents, focused, panes, spaces, theme, props, run, closeOverlay, openOverlay, setShared, exec, home, appHome, readTextFile, checking, nextCommand, settings, shared } from "herdr";
import { Vim, keysOf, step } from "./vim.js";
import { motionState, frame, sheet, leave, leaving } from "./motion.js";
import { ditherBand, TOP } from "./dither.js";
import { refreshOn, gitTopics } from "./bus.js";
import { makeT, relative } from "./i18n.js";
import strings from "./strings.js";

const tr = makeT(strings);
const MONO = "Monaspace Krypton";
// A color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const ICON = (name) => `mods/kt-threads/${name}.svg`;
// Read-only git: no index refresh, no lock, nothing written in a repo others are using.
const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "core.quotePath=false"];
// Tab-separated: a ref name can't hold a control character.
const REFS = ["%(refname:short)", "%(HEAD)", "%(upstream:short)", "%(upstream:track,nobracket)", "%(committerdate:unix)", "%(worktreepath)"].join("%09");

const norm = (p) => (p ?? "").replace(/\/+$/, "");
const lastLine = (s) => (s ?? "").trim().split("\n").filter(Boolean).pop() ?? "";

// Where it acts: its props, else the focused pane and its space's machine.
function target() {
  const p = props() ?? {};
  if (p.cwd) return { cwd: p.cwd, machine: p.machine ?? null, terminal: p.terminal ?? null, pane: p.pane ?? null };
  const f = focused();
  const pane = panes().find((x) => x.pane === f?.pane);
  return { cwd: f?.cwd ?? pane?.cwd ?? null, machine: spaces().find((s) => s.id === f?.space)?.machine ?? null, terminal: f?.terminal ?? null, pane: f?.pane ?? null };
}

export default class Branches extends View {
  init(_props, cx) {
    this.at = target();
    this.top = null; // the checkout's root
    this.branches = null; // null: still reading
    this.worktrees = [];
    this.error = "";
    this.note = "";
    this.hl = 0;
    this.slots = []; // row -> its child index in the list, to scroll it into view
    this.confirmMod = "kt-confirm";
    this.scroll = ScrollHandle.new();
    this.motion = motionState(); // motion.js sheet(): the card fades in, and out on dismiss
    this.input = InputState.new({ placeholder: tr("filter") });
    this.input.on("change", (_e, cx) => { this.hl = 0; this.note = ""; cx.notify(); });
    this.input.on("submit", (_e, cx) => { const r = this.rows()[this.hl]; if (r) this.pick(r, cx); cx.notify(); });
    // vim's mode follows the keyboard: the field's (INSERT) or the popup's own handle (NORMAL).
    this.handle = cx.focus_handle();
    this.vim = new Vim({ field: true, insert: true });
    this.input.on("focus", (_e, cx) => { this.typing = true; this.vim.edit(); cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.typing = false; this.vim.normal(); cx.notify(); });
    // As the shipped picker: the popup may not be keyed yet in init, so the field asks again
    // (unless the popup's handle has the keyboard by then: Esc, NORMAL).
    this.input.focus();
    cx.timer.after(600, () => { if (!this.handle.is_focused()) this.input.focus(); });
    if (checking()) return;
    this.load(cx);
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c.startsWith("key:")) {
          (this.vim.insert ? this.input : this.handle).focus();
          for (const k of keysOf(c.slice(4))) this.act(this.vim.handle(k), cx);
        } else if (c.startsWith("query:")) {
          this.input.set_value(c.slice(6));
          this.hl = 0;
        }
        cx.notify();
      }
    });
  }

  key(e, cx) {
    if (!this.act(this.vim.handle(e), cx)) return; // not ours (typing in the field, ctrl-b, cmd-*): it goes on
    cx.stop_propagation();
    cx.notify();
  }

  // One vim action; false: not one of ours. In INSERT the Input types, deletes and submits (Enter
  // already goes through its "submit"): those keys go on to it.
  act(a, cx) {
    if (!a || a === "type" || a === "backspace" || a === "submit") return false;
    if (a === "pending" || a === "count") return true;
    const rows = this.rows();
    if (a === "normal") this.handle.focus();
    else if (a === "filter") this.input.focus();
    else if (a === "down" || a === "up") this.move((a === "down" ? 1 : -1) * this.vim.count);
    else if (["top", "bottom", "half-down", "half-up"].includes(a)) this.move(step(a, this.hl, rows.length, this.vim.count, 10) - this.hl);
    else if (a === "tab-next" || a === "tab-prev") {
      // The first worktree row (tab) or the first branch row (shift-tab).
      const i = rows.findIndex((r) => r.kind === (a === "tab-next" ? "worktree" : "branch"));
      if (i >= 0) this.move(i - this.hl);
    } else if (a === "open" || a === "right") { const r = rows[this.hl]; if (r) this.pick(r, cx); }
    else if (a === "escape" || a === "quit") this.dismiss(cx);
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "modals" } });
    else return false;
    return true;
  }

  // Not `close()`: Herdr calls a View's close() when the mod reloads or its overlay goes.
  // motion.js leave(): the card fades out, then the popup closes.
  dismiss(cx) {
    leave(this.motion, cx, "kb", () => closeOverlay(props().overlay));
  }

  load(cx) {
    if (!this.at.cwd) { this.branches = []; this.error = tr("noFolder"); return; }
    this.loading = true;
    cx.spawn(async (cx) => {
      await this.read();
      cx.notify();
    });
  }

  // Reads the repo: its root, its branches (latest commit first), its worktrees. A failure keeps
  // what was read before, and says why. Awaited by the bus (refreshOn in render) too.
  async read() {
    const { cwd, machine } = this.at;
    if (!cwd) return;
    const on = machine ?? undefined;
    const git = (args) => exec("git", [...READ, ...args], { cwd, on });
    this.loading = true;
    try {
      const [top, refs, wts, kc] = await Promise.all([
        git(["rev-parse", "--show-toplevel"]),
        git(["for-each-ref", "--sort=-committerdate", `--format=${REFS}`, "refs/heads"]),
        git(["worktree", "list", "--porcelain"]),
        readTextFile(`${appHome()}/mods/kt-confirm/main.js`).catch(() => null),
      ]);
      if (top.code !== 0) throw new Error(lastLine(top.stderr) || tr("notRepo"));
      this.top = norm(top.stdout.trim());
      this.confirmMod = kc ? "kt-confirm" : "confirm";
      this.branches = refs.stdout.split("\n").filter(Boolean).map((line) => {
        const [name, head, up, track = "", at, wt] = line.split("\t");
        return {
          name, current: head === "*", up: up || null, gone: track === "gone",
          ahead: +(track.match(/ahead (\d+)/)?.[1] ?? 0), behind: +(track.match(/behind (\d+)/)?.[1] ?? 0),
          at: +at || null, wt: norm(wt) || null,
        };
      });
      // Blocks of "key value" lines; a prunable one's folder is gone, so it can't be opened.
      this.worktrees = wts.stdout.split("\n\n").map((block) => {
        const f = {};
        for (const l of block.split("\n").filter(Boolean)) {
          const i = l.indexOf(" ");
          f[i < 0 ? l : l.slice(0, i)] = i < 0 ? true : l.slice(i + 1);
        }
        return { path: norm(f.worktree), branch: typeof f.branch === "string" ? f.branch.replace(/^refs\/heads\//, "") : null, skip: !f.worktree || f.bare || f.prunable };
      }).filter((w) => !w.skip);
      this.error = "";
    } catch (e) {
      this.branches = this.branches ?? [];
      this.error = String(e?.message ?? e);
    }
    this.loading = false;
  }

  tilde(p) {
    const h = home();
    return !this.at.machine && p && (p === h || p.startsWith(`${h}/`)) ? `~${p.slice(h.length)}` : p;
  }

  // The branch rows then the worktree rows that match the filter: what Enter and up/down walk.
  rows() {
    const q = this.input.value().trim().toLowerCase();
    const has = (...s) => !q || s.some((x) => x && x.toLowerCase().includes(q));
    return [
      ...(this.branches ?? []).filter((b) => has(b.name, b.up)).map((b) => ({ kind: "branch", key: b.name, b })),
      ...this.worktrees.filter((w) => has(w.branch, w.path)).map((w) => ({ kind: "worktree", key: w.path, w })),
    ];
  }

  working() {
    const { terminal, pane } = this.at;
    return agents().some((a) => a.status === "working" && ((terminal && a.address === terminal) || (pane && a.pane === pane)));
  }

  pick(r, cx) {
    if (r.kind === "worktree") return this.openWorktree(r.w, cx);
    const b = r.b;
    if (b.current) { this.note = tr("already", { name: b.name }); return; }
    if (b.wt && b.wt !== this.top) { this.note = tr("elsewhere", { name: b.name, path: this.tilde(b.wt) }); return; }
    if (this.working()) { this.note = tr("working"); return; }
    if (this.asking) return;
    this.asking = true;
    const { cwd, machine } = this.at;
    cx.spawn(async (cx) => {
      let st;
      try { st = await exec("git", [...READ, "status", "--porcelain"], { cwd, on: machine ?? undefined }); }
      catch (e) { st = { code: 1, stderr: String(e?.message ?? e) }; }
      this.asking = false;
      if (st.code !== 0) { this.note = lastLine(st.stderr) || tr("statusFailed"); cx.notify(); return; }
      if (this.working()) { this.note = tr("working"); cx.notify(); return; }
      const dirty = st.stdout.split("\n").filter(Boolean);
      const shown = dirty.slice(0, 4).map((l) => l.slice(3)).join(", ") + (dirty.length > 4 ? `, +${dirty.length - 4}` : "");
      const n = dirty.length;
      const detail = n
        ? tr("dirty", { n, path: this.tilde(this.top), files: shown, name: b.name })
        : tr("clean", { name: b.name, path: this.tilde(this.top) });
      // `root`: the checkout's toplevel, for kt-composer to bump git:<root> after its switch.
      setShared("kt-branch.switch", { ...this.at, branch: b.name, root: this.top });
      const own = this.confirmMod === "kt-confirm";
      openOverlay({
        // kt-confirm draws its own veil full window; the shipped confirm keeps its box.
        mod: this.confirmMod, kind: "dialog", ...(own ? { frame: "none", width: 1, height: 1 } : { width: 460, height: n ? 250 : 200 }),
        props: { title: tr("switch.title", { name: b.name }), detail, ...(own ? { label: tr("switch.label"), danger: n > 0 } : {}), command: { name: "kt-composer.switch" } },
      });
      // Closed at once, not by leave(): the confirm takes the keyboard once, in its init, and a popup
      // closing after it would hand the keyboard back to what is under.
      closeOverlay(props().overlay);
    });
  }

  // Its space (one made in it, or with a terminal in it, on the same machine), else a new space there.
  // Not again while the popup leaves: a double click would run it twice (a second space.new).
  openWorktree(w, cx) {
    if (leaving(this.motion, "kb")) return;
    const machine = this.at.machine ?? null;
    const here = (p) => Boolean(p) && norm(p) === w.path;
    const s = spaces().find((s) => (s.machine ?? null) === machine &&
      (here(s.folder) || panes().some((p) => here(p.cwd) && s.tabs.some((t) => t.id === p.tab))));
    if (s) run("space.select", { id: s.id });
    else run("space.new", { folder: w.path, machine: machine ?? "" });
    this.dismiss(cx);
  }

  move(by) {
    const n = this.rows().length;
    if (!n) return;
    this.hl = (((this.hl + by) % n) + n) % n;
    this.scroll.scroll_to_item(this.slots[this.hl] ?? 0);
  }

  render(cx) {
    const t = theme();
    // Another mod (Changes, kt-composer's switch, kt-new, an agent's turn) moved this repo while the
    // popup is open: read it again (DATA-SYNC.md). The rows stay as they are until the new read lands.
    refreshOn(this, cx, "branches", gitTopics(this.top), async () => { await this.read(); });
    const rows = this.rows();
    this.hl = Math.min(this.hl, Math.max(0, rows.length - 1));
    const now = Date.now() / 1000;
    const mono = (size, color) => div().font_family(MONO).text_size(size).text_color(color);
    const section = (label, n) =>
      h_flex().flex_none().px(10).pt(10).pb(4).gap(8).items_center()
        .child(mono(10.5, t.muted).flex_none().child(label))
        .child(mono(10.5, t.dim).flex_none().child(String(n)))
        .child(div().flex_1().h(0).border_t(1).border_dashed().border_color(t.border));
    // A row (radius 12 in the 16 card): the highlighted one sits on the kbrdn.dev ink. It is the
    // keys' cursor: a 1 px accent ring while the popup has the keyboard (field or handle).
    const keyed = this.typing || this.handle.is_focused();
    const row = (r, i, lead, title, right, sub) => {
      const on = i === this.hl;
      return h_flex().id(`kb-${r.kind}-${r.key}`).flex_none().gap(10).px(10).py(6).items_center()
        .rounded(12).border(1).border_color(alpha(t.accent, on ? (keyed ? "99" : "66") : "00")).when(on, (el) => el.bg(t.accent + "24"))
        .cursor_pointer().hover((s) => s.bg(on ? t.accent + "24" : t.hover))
        .on_click((_e, cx) => { this.hl = i; this.pick(r, cx); cx.notify(); })
        .child(lead)
        .child(v_flex().flex_1().min_w(0).gap(2)
          .child(h_flex().gap(8).items_center()
            .child(mono(12, t.foreground).flex_1().min_w(0).truncate().child(title))
            .child(right))
          .child(sub));
    };
    const branchRow = (r, i) => {
      const b = r.b;
      const elsewhere = b.wt && b.wt !== this.top;
      // origin/<same name> reads as "origin": room for the rest.
      const up = b.up?.endsWith(`/${b.name}`) ? b.up.slice(0, -b.name.length - 1) : b.up;
      const sub = h_flex().gap(8).items_center().min_w(0)
        .when(Boolean(b.up), (el) => el.child(mono(10.5, b.gone ? t.ansi1 : t.dim).min_w(0).truncate().child(b.gone ? tr("gone", { up }) : up)))
        .when(!b.up, (el) => el.child(mono(10.5, t.dim).child(tr("noUpstream"))))
        .when(b.ahead > 0, (el) => el.child(mono(10.5, t.ansi2).flex_none().child(`↑${b.ahead}`)))
        .when(b.behind > 0, (el) => el.child(mono(10.5, t.ansi3).flex_none().child(`↓${b.behind}`)))
        .when(Boolean(elsewhere), (el) => el.child(mono(10.5, t.muted).min_w(0).truncate().child(`· ${this.tilde(b.wt)}`)));
      return row(r, i,
        svg(ICON(b.current ? "check" : "git-branch")).size(14).flex_none().text_color(b.current ? t.accent : t.dim),
        b.name,
        mono(10.5, t.dim).flex_none().child(b.at ? relative(b.at * 1000, { bare: true, now: now * 1000 }) : ""),
        sub);
    };
    const worktreeRow = (r, i) => {
      const w = r.w;
      const here = w.path === this.top;
      return row(r, i,
        svg(ICON(here ? "check" : "folder-tree")).size(14).flex_none().text_color(here ? t.accent : t.dim),
        w.branch ?? tr("detached"),
        mono(10.5, here ? t.accent : t.dim).flex_none().child(here ? tr("here") : ""),
        mono(10.5, t.dim).min_w(0).truncate().child(this.tilde(w.path)));
    };
    // The list: each section's rows, and where each row sits among the children (for scrolling).
    const kids = [];
    this.slots = [];
    const branchRows = rows.filter((r) => r.kind === "branch");
    const treeRows = rows.filter((r) => r.kind === "worktree");
    if (branchRows.length) {
      kids.push(section(tr("branches"), branchRows.length));
      branchRows.forEach((r, k) => { this.slots.push(kids.length); kids.push(branchRow(r, k)); });
    }
    if (treeRows.length) {
      kids.push(section(tr("worktrees"), treeRows.length));
      treeRows.forEach((r, k) => { this.slots.push(kids.length); kids.push(worktreeRow(r, branchRows.length + k)); });
    }
    const q = this.input.value().trim();
    // Nothing to list, said plainly: reading, git's refusal, the filter's miss, a repo without commits.
    const state = (icon, color, title, text, detail) => v_flex().id("kb-state").flex_none().px(8).py(12).gap(4)
      .child(h_flex().gap(8).items_center()
        .child(icon === "spinner" ? svg("mods/workspace-chrome/spinner.svg").size(14).flex_none().spin(900).text_color(color) : svg(ICON(icon)).size(14).flex_none().text_color(color))
        .child(div().min_w(0).truncate().text_size(15).font_medium().text_color(t.foreground).child(title)))
      .child(div().pl(22).max_w(340).text_size(13).line_height("20px").text_color(t.muted).child(text))
      .when(Boolean(detail), (el) => el.child(div().pl(22).pt(2).max_w(340).font_family(MONO).text_size(10.5).line_height("16px").text_color(t.dim).child(detail)));
    // git's own words, in English or French (« … n'est un dépôt git »), and ours ("Pas un dépôt git.").
    const notRepo = /not a git repository|un dépôt git/i.test(this.error);
    const empty = this.branches === null
      ? state("spinner", t.working, tr("reading.title"), tr("reading.text"), this.tilde(this.at.cwd))
      : this.error && !this.at.cwd
        ? state("circle-alert", t.ansi1, tr("noFolder.title"), tr("noFolder.text"))
        : this.error
          ? state("circle-alert", t.ansi1, notRepo ? tr("notRepo.title") : tr("failed.title"),
            notRepo ? tr("notRepo.text") : tr("failed.text"),
            `${this.tilde(this.at.cwd)}${notRepo ? "" : ` · ${this.error}`}`)
          : q
            ? state("list-filter", t.dim, tr("noMatch.title"), tr("noMatch.text", { q }))
            : state("git-branch", t.dim, tr("noBranch.title"), tr("noBranch.text"), this.tilde(this.top));
    const pill = (id, icon, label, onClick) =>
      h_flex().id(id).flex_none().h(28).px(12).gap(6).items_center().rounded_full().border(1).border_color(t.border).bg(t.background)
        .font_family(MONO).text_size(11).text_color(t.muted).cursor_pointer().hover((s) => s.text_color(t.foreground).border_color(t.input))
        .on_click(onClick)
        .child(svg(icon).size(12).flex_none())
        .child(label);
    // Under the list, in a band: a note (why a pick did nothing), or a refresh that failed while the
    // branches read before are still shown (an error with nothing listed is the list's own state).
    const failed = Boolean(this.error) && kids.length > 0;
    const message = failed ? this.error : this.note;
    const tone = failed ? t.ansi1 : t.blocked;
    const band = h_flex().flex_none().mx(2).mt(4).gap(8).items_start().px(10).py(7).rounded(12).border(1).border_color(alpha(tone, "4d")).bg(alpha(tone, "14"))
      .child(svg(ICON("circle-alert")).size(13).flex_none().mt(3).text_color(tone))
      .child(div().flex_1().min_w(0).text_size(12.5).line_height("18px").text_color(tone).child(message));
    // The head, Crosstalk's at 40 px: the git tint (ansi2) in the pixel dither, the repo as the title,
    // where it stands in mono below. Its mark turns red when there is no repo to read.
    const branches = this.branches ?? [];
    const current = branches.find((b) => b.current);
    const lost = Boolean(this.error) && !this.top;
    const title = this.branches === null ? tr("title.loading") : lost ? tr("title.lost") : this.top?.split("/").pop() || tr("title.repo");
    const subtitle = (this.branches === null || lost ? [this.tilde(this.at.cwd) || tr("noFolderShort"), this.at.machine]
      : [current ? tr("on", { name: current.name }) : tr("detached"), this.at.machine, tr("count.branches", { n: branches.length }), this.worktrees.length > 1 ? tr("count.worktrees", { n: this.worktrees.length }) : null])
      .filter(Boolean).join(" · ");
    const mark = lost ? t.ansi1 : t.ansi2;
    const head = div()
      .id("kb-head")
      .relative()
      .flex_none()
      .h(40)
      .overflow_hidden()
      .rounded_t(15)
      .on_size_change((size, cx) => {
        if (Math.abs((this.headW ?? 0) - size.width) < 0.5) return;
        this.headW = size.width;
        cx.notify();
      })
      // Inside the inner card's 1 px border: its radius 16 less the border.
      .when(this.headW > 30, (el) => el.child(ditherBand(this.headW, 40, 15, alpha(t.ansi2, settings().dark ? "6b" : "4d"), TOP)))
      .child(h_flex().size_full().px(12).gap(10).items_center()
        .child(h_flex().size(26).flex_none().rounded(8).items_center().justify_center().border(1).border_color(alpha(mark, "4d")).bg(alpha(t.surface, "e6"))
          .child(svg(ICON(lost ? "circle-alert" : "git-branch")).size(13).text_color(mark)))
        .child(v_flex().flex_1().min_w(0)
          .child(div().truncate().text_size(14).line_height("18px").font_semibold().text_color(t.foreground).child(title))
          .child(div().truncate().font_family(MONO).text_size(10.5).line_height("14px").text_color(t.muted).child(subtitle))));
    // The popups' motion (motion.js sheet): the card fades in, once, on its first size report, and out
    // on dismiss; no rise (only veil(), on the card): the card fills the overlay's box, a rise would
    // be clipped. Reduced motion: at once.
    const s = sheet(frame(this.motion, Boolean(shared("kt.reducedMotion"))), "kb", Boolean(this.size));
    // The card (radius 20, 4 px around), its inner card (16) with the head flush on top, then 4 px
    // around the field and rows (12).
    // A popup takes its content's height: the full height is set here (as kt-composer anchors it).
    return s.veil(v_flex()
      .id("kt-branch")
      .w_full()
      .h(460)
      .p(4)
      .rounded(20)
      .bg(t.popover)
      .border(1)
      .border_color(t.border)
      .shadow_lg()
      .on_size_change((size, cx) => {
        this.size = size;
        cx.notify();
      }))
      // NORMAL's keys land on this handle; the field's keys bubble up here too.
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .child(
        v_flex()
          // A press in the card (its head too) never reaches the root's handle: a click beside the
          // field (a pill, the scrollbar, the head) doesn't take the keyboard from it (INSERT stays).
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .flex_1()
          .min_h(0)
          .rounded(16)
          .bg(t.surface)
          .border(1)
          .border_color(t.border)
          .child(head)
          .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(alpha(t.ansi2, "4d")))
          .child(v_flex().flex_1().min_h(0).p(4)
          .child(
            h_flex().flex_none().h(36).px(12).gap(8).items_center().rounded(12).bg(t.background)
              .border(1).border_color(this.typing ? t.accent : t.input).cursor_text()
              .child(svg(ICON("list-filter")).size(14).flex_none().text_color(t.dim))
              .child(Input.new(this.input).flex_1().h_full().font_family(MONO).text_size(12).text_color(t.foreground))
              .when(this.loading && this.branches !== null, (el) => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().spin(900).text_color(t.dim))),
          )
          .child(v_flex().id("kb-list").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).children(kids.length ? kids : [empty]))
          .when(Boolean(message), (el) => el.child(band))
          // The foot, under a dashed rule.
          .child(div().flex_none().mx(6).h(0).border_t(1).border_dashed().border_color(t.border))
          .child(
            h_flex().flex_none().px(4).pt(6).pb(2).gap(8).items_center()
              // Closed at once, not by leave(): kt-new takes the keyboard once, in its init.
              .child(pill("kb-new", ICON("plus"), tr("newWorktree"), () => { closeOverlay(props().overlay); run("mod.open", { name: "kt-new" }); }))
              .child(div().flex_1())
              // vim's mode (kt-keys' pill): INSERT on the ink, NORMAL neutral.
              .when(keyed, (el) => el.child(div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1)
                .border_color(this.typing ? alpha(t.accent, "66") : t.border).bg(this.typing ? alpha(t.accent, "24") : t.background)
                .font_family(MONO).text_size(9).text_color(this.typing ? t.accent : t.muted).child(this.typing ? "INSERT" : "NORMAL")))
              .child(pill("kb-refresh", ICON("refresh-cw"), tr("refresh"), (_e, cx) => { this.note = ""; this.load(cx); cx.notify(); })),
          )),
      );
  }
}
