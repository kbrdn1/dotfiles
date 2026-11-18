// kbrdn Threads' branch popup, opened from the status line's checkout item (kt-composer): the
// focused pane's repo, its local branches (latest commit first) and its worktrees, filtered as you
// type (Enter takes the highlighted row, up/down move it).
// A branch: `git switch` in the pane's folder, always confirmed first (kt-confirm, else confirm) and
// refused while the pane's agent is working. The popup closes for the dialog, so the switch itself
// runs in kt-composer, which stays on screen: the dialog answers `kt-composer.switch` and the
// target waits in shared "kt-branch.switch". A worktree: its space if one is there, else a new one.
// Nothing here deletes a branch or a worktree, resets or stashes.
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
import { agents, focused, panes, spaces, theme, props, run, closeOverlay, openOverlay, setShared, exec, home, appHome, readTextFile, checking, nextCommand } from "herdr";
import { Vim, keysOf, step } from "./vim.js";

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
function ago(sec) {
  if (sec < 60) return "à l'instant";
  if (sec < 3600) return `${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h`;
  if (sec < 14 * 86400) return `${Math.floor(sec / 86400)} j`;
  if (sec < 60 * 86400) return `${Math.floor(sec / (7 * 86400))} sem`;
  if (sec < 365 * 86400) return `${Math.floor(sec / (30 * 86400))} mois`;
  const y = Math.floor(sec / (365 * 86400));
  return `${y} an${y > 1 ? "s" : ""}`;
}

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
    this.input = InputState.new({ placeholder: "Filtrer" });
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
    else if (a === "escape" || a === "quit") this.close();
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "modals" } });
    else return false;
    return true;
  }

  close() {
    closeOverlay(props().overlay);
  }

  load(cx) {
    const { cwd, machine } = this.at;
    if (!cwd) { this.branches = []; this.error = "Ce pane n'a pas de dossier."; return; }
    const on = machine ?? undefined;
    const git = (args) => exec("git", [...READ, ...args], { cwd, on });
    this.loading = true;
    cx.spawn(async (cx) => {
      try {
        const [top, refs, wts, kc] = await Promise.all([
          git(["rev-parse", "--show-toplevel"]),
          git(["for-each-ref", "--sort=-committerdate", `--format=${REFS}`, "refs/heads"]),
          git(["worktree", "list", "--porcelain"]),
          readTextFile(`${appHome()}/mods/kt-confirm/main.js`).catch(() => null),
        ]);
        if (top.code !== 0) throw new Error(lastLine(top.stderr) || "Pas un dépôt git.");
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
      cx.notify();
    });
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
    if (r.kind === "worktree") return this.openWorktree(r.w);
    const b = r.b;
    if (b.current) { this.note = `Déjà sur ${b.name}.`; return; }
    if (b.wt && b.wt !== this.top) { this.note = `${b.name} est déjà extraite dans ${this.tilde(b.wt)} : git switch refuserait. Ouvre ce worktree.`; return; }
    if (this.working()) { this.note = "L'agent travaille dans ce dossier : la branche ne change pas tant qu'il travaille."; return; }
    if (this.asking) return;
    this.asking = true;
    const { cwd, machine } = this.at;
    cx.spawn(async (cx) => {
      let st;
      try { st = await exec("git", [...READ, "status", "--porcelain"], { cwd, on: machine ?? undefined }); }
      catch (e) { st = { code: 1, stderr: String(e?.message ?? e) }; }
      this.asking = false;
      if (st.code !== 0) { this.note = lastLine(st.stderr) || "git status a échoué."; cx.notify(); return; }
      if (this.working()) { this.note = "L'agent travaille dans ce dossier : la branche ne change pas tant qu'il travaille."; cx.notify(); return; }
      const dirty = st.stdout.split("\n").filter(Boolean);
      const shown = dirty.slice(0, 4).map((l) => l.slice(3)).join(", ") + (dirty.length > 4 ? `, +${dirty.length - 4}` : "");
      const n = dirty.length;
      const detail = n
        ? `${n} changement${n > 1 ? "s" : ""} non commité${n > 1 ? "s" : ""} dans ${this.tilde(this.top)} : ${shown}. ` +
          `Ils suivent la branche : git switch les emporte tels quels sur ${b.name}. Si l'un d'eux touche un fichier qui diffère entre les deux branches, git switch refuse et rien ne change. Rien n'est remisé ni effacé.`
        : `git switch ${b.name} dans ${this.tilde(this.top)}. Aucun changement non commité.`;
      setShared("kt-branch.switch", { ...this.at, branch: b.name });
      const own = this.confirmMod === "kt-confirm";
      openOverlay({
        // kt-confirm draws its own veil full window; the shipped confirm keeps its box.
        mod: this.confirmMod, kind: "dialog", ...(own ? { frame: "none", width: 1, height: 1 } : { width: 460, height: n ? 250 : 200 }),
        props: { title: `Passer sur ${b.name} ?`, detail, ...(own ? { label: "Changer de branche", danger: n > 0 } : {}), command: { name: "kt-composer.switch" } },
      });
      this.close();
    });
  }

  // Its space (one made in it, or with a terminal in it, on the same machine), else a new space there.
  openWorktree(w) {
    const machine = this.at.machine ?? null;
    const here = (p) => Boolean(p) && norm(p) === w.path;
    const s = spaces().find((s) => (s.machine ?? null) === machine &&
      (here(s.folder) || panes().some((p) => here(p.cwd) && s.tabs.some((t) => t.id === p.tab))));
    this.close();
    if (s) run("space.select", { id: s.id });
    else run("space.new", { folder: w.path, machine: machine ?? "" });
  }

  move(by) {
    const n = this.rows().length;
    if (!n) return;
    this.hl = (((this.hl + by) % n) + n) % n;
    this.scroll.scroll_to_item(this.slots[this.hl] ?? 0);
  }

  render() {
    const t = theme();
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
        .when(Boolean(b.up), (el) => el.child(mono(10.5, b.gone ? t.ansi1 : t.dim).min_w(0).truncate().child(b.gone ? `${up} · disparue` : up)))
        .when(!b.up, (el) => el.child(mono(10.5, t.dim).child("pas d'amont")))
        .when(b.ahead > 0, (el) => el.child(mono(10.5, t.ansi2).flex_none().child(`↑${b.ahead}`)))
        .when(b.behind > 0, (el) => el.child(mono(10.5, t.ansi3).flex_none().child(`↓${b.behind}`)))
        .when(Boolean(elsewhere), (el) => el.child(mono(10.5, t.muted).min_w(0).truncate().child(`· ${this.tilde(b.wt)}`)));
      return row(r, i,
        svg(ICON(b.current ? "check" : "git-branch")).size(14).flex_none().text_color(b.current ? t.accent : t.dim),
        b.name,
        mono(10.5, t.dim).flex_none().child(b.at ? ago(now - b.at) : ""),
        sub);
    };
    const worktreeRow = (r, i) => {
      const w = r.w;
      const here = w.path === this.top;
      return row(r, i,
        svg(ICON(here ? "check" : "folder-tree")).size(14).flex_none().text_color(here ? t.accent : t.dim),
        w.branch ?? "HEAD détachée",
        mono(10.5, here ? t.accent : t.dim).flex_none().child(here ? "ICI" : ""),
        mono(10.5, t.dim).min_w(0).truncate().child(this.tilde(w.path)));
    };
    // The list: each section's rows, and where each row sits among the children (for scrolling).
    const kids = [];
    this.slots = [];
    const branchRows = rows.filter((r) => r.kind === "branch");
    const treeRows = rows.filter((r) => r.kind === "worktree");
    if (branchRows.length) {
      kids.push(section("BRANCHES", branchRows.length));
      branchRows.forEach((r, k) => { this.slots.push(kids.length); kids.push(branchRow(r, k)); });
    }
    if (treeRows.length) {
      kids.push(section("WORKTREES", treeRows.length));
      treeRows.forEach((r, k) => { this.slots.push(kids.length); kids.push(worktreeRow(r, branchRows.length + k)); });
    }
    const q = this.input.value().trim();
    const empty = this.branches === null
      ? h_flex().gap(8).p(12).items_center().child(svg("mods/workspace-chrome/spinner.svg").size(12).spin(900).text_color(t.working)).child(mono(11, t.dim).child("LECTURE…"))
      : div().p(12).text_size(12).text_color(t.dim).child(q ? `Rien ne correspond à « ${q} ».` : "Aucune branche.");
    const pill = (id, icon, label, onClick) =>
      h_flex().id(id).flex_none().h(28).px(12).gap(6).items_center().rounded_full().border(1).border_color(t.border).bg(t.background)
        .font_family(MONO).text_size(11).text_color(t.muted).cursor_pointer().hover((s) => s.text_color(t.foreground).border_color(t.input))
        .on_click(onClick)
        .child(svg(icon).size(12).flex_none())
        .child(label);
    const message = this.error || this.note;
    // The card (radius 20, 4 px around), its inner card (16, 4 px around), the field and rows (12).
    // A popup takes its content's height: the full height is set here (as kt-composer anchors it).
    return v_flex()
      .id("kt-branch")
      .w_full()
      .h(460)
      .p(4)
      .rounded(20)
      .bg(t.popover)
      .border(1)
      .border_color(t.border)
      .shadow_lg()
      // NORMAL's keys land on this handle; the field's keys bubble up here too.
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .child(
        v_flex()
          // A press in the card never reaches the root's handle: a click beside the field (a pill,
          // the scrollbar) doesn't take the keyboard from it (INSERT stays).
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .flex_1()
          .min_h(0)
          .p(4)
          .rounded(16)
          .bg(t.surface)
          .border(1)
          .border_color(t.border)
          .child(
            h_flex().flex_none().h(36).px(12).gap(8).items_center().rounded(12).bg(t.background)
              .border(1).border_color(this.typing ? t.accent : t.input).cursor_text()
              .child(svg(ICON("list-filter")).size(14).flex_none().text_color(t.dim))
              .child(Input.new(this.input).flex_1().h_full().font_family(MONO).text_size(12).text_color(t.foreground))
              .when(this.loading && this.branches !== null, (el) => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().spin(900).text_color(t.dim))),
          )
          .child(v_flex().id("kb-list").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).children(kids.length ? kids : [empty]))
          .when(Boolean(message), (el) => el.child(div().flex_none().px(10).py(6).text_size(12).text_color(this.error ? t.ansi1 : t.blocked).child(message)))
          // The foot, under a dashed rule.
          .child(div().flex_none().mx(6).h(0).border_t(1).border_dashed().border_color(t.border))
          .child(
            h_flex().flex_none().px(4).pt(6).pb(2).gap(8).items_center()
              .child(pill("kb-new", ICON("plus"), "NOUVEAU WORKTREE…", () => { this.close(); run("mod.open", { name: "kt-new" }); }))
              .child(div().flex_1())
              // vim's mode (kt-keys' pill): INSERT on the ink, NORMAL neutral.
              .when(keyed, (el) => el.child(div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1)
                .border_color(this.typing ? alpha(t.accent, "66") : t.border).bg(this.typing ? alpha(t.accent, "24") : t.background)
                .font_family(MONO).text_size(9).text_color(this.typing ? t.accent : t.muted).child(this.typing ? "INSERT" : "NORMAL")))
              .child(pill("kb-refresh", ICON("refresh-cw"), "RAFRAÎCHIR", (_e, cx) => { this.note = ""; this.load(cx); cx.notify(); })),
          ),
      );
  }
}
