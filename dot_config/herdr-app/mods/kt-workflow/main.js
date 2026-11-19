// kbrdn Workflow: Kylian's Claude Code / Herdr workflow, read-only, as a page: the "workflow" child of
// kbrdn-threads' main "view" stack (kt-threads' navigation, Agents group, above Skills).
// Sources (0 token, nothing written under ~/.claude): ~/.claude/WORKFLOW.md (its date, « Outils &
// priorités », « Conventions », « Idées »), the skills and their commands (skills/me/**/SKILL.md,
// skills/{gwm,spec-git-flow-*}/SKILL.md, commands/me/**.md: description, path, mtime, the cale),
// skills/me/loop/*/SKILL.md (« ## Définition »), ~/.claude/settings.json (mode, deny, hooks, model,
// effort, crossSessionInbound; secrets masked: parse.js mask()), `hc templates`, `chezmoi status
// ~/.claude` and the dotfiles source's last commit.
// Top: the band (ansi3) with the facts and « Configurer avec Claude »; a filter row (Tout, Cycle,
// Workflows, Loops, Outils, Garde-fous, Notes). Then, scrolling: the cycle as cards and arrows with
// its side branches (kt-threads' Parcours twig), one card per workflow, the loops table, the tools
// table, the guards, the notes. A step, workflow or loop opens its skill in kt-skills (a dialog,
// props.select); one whose skill or cale is missing shows an alert.
// « Configurer avec Claude » opens ONE session, a tab named « Workflow » (shown again when it lives,
// never a second one); « Modifier avec Claude » adds an intention: in a new session's task, else typed
// into the live one between two turns only (session.js, shared with kt-automation; busy: said here,
// with Réessayer). The Loops head links to kt-automation's page when the stack has it.
// Scans when the page shows (if the last scan is over 10 s old), on Rafraîchir, on a change under
// ~/.claude/skills or ~/.claude/commands (watched while shown) and on the bus (skills, plugins); never
// on a timer. A file is re-read only when its mtime moved.
// Keys (vim.js): j/k gg/G ctrl-d/u move over the steps, branches, workflows and loops; enter/o/l open
// the skill, O Zed, y copies the command, e « Modifier avec Claude », C « Configurer avec Claude »,
// tab / shift-tab the sections, r refresh, p the notes' Aperçu / Brut (markdown.js: Conventions and
// Idées rendered, or their source in Zed's colors), ? kt-keys, q / esc back to the thread.
// Mod commands: kt-workflow.focus, key:<keys>, refresh, configure[:<intention>] (tests).

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { mdState, mdBudget, docOf, view, tabs as mdTabs } from "./markdown.js";
import { exec, hc, readTextFile, theme, spaces, panes, run, layout, home, notify, checking, nextCommand, openOverlay, shared, settings, watchFolder } from "herdr";
import { session, showSession, dedicated, intention } from "./session.js";
import { frontmatter } from "./frontmatter.js";
import { section, table, stripMd, loopDef, mask, updatedOn, isCale } from "./parse.js";
import { makeT, relative } from "./i18n.js";
import strings from "./strings.js";
import { Vim, keysOf, keyOf, step } from "./vim.js";
import { filterRow, filterState } from "./filters.js";
import { dither, iconBtn, bandRow } from "./band.js";
import { motionState, frame, enter, pulse } from "./motion.js";
import { skeleton } from "./skeleton.js";
import { tierOf } from "./tiers.js";
import { refreshOn } from "./bus.js";

const tr = makeT(strings);
const ago = (ms) => relative(ms);
const MONO = "Monaspace Krypton";
const I = (name) => `mods/kt-threads/${name}.svg`;
// A theme color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const tilde = (p) => (p.startsWith(home() + "/") ? `~${p.slice(home().length)}` : p);
const parse = (s) => { try { return JSON.parse(s ?? ""); } catch { return null; } };
// A long description cut at a word, ~3 lines of a card (gpui has no line clamp); Zed shows the rest.
const clock = (ms) => new Date(ms).toTimeString().slice(0, 8);
const clip = (s, n = 210) => (s.length <= n ? s : `${s.slice(0, s.lastIndexOf(" ", n))} …`);
const NAME = "Workflow"; // the session's tab (and new space)

// The page's sections, as the filter row names them (FILTERS.md tints; « Tout » neutral).
const SECS = [["all"], ["cycle", "ansi3"], ["workflows", "ansi4"], ["loops", "ansi5"], ["tools", "ansi2"], ["guards", "accent"], ["notes", "ansi6"]];

// What a step or a workflow stands on, under ~/.claude. `select`: its name in kt-skills. `skill`: its
// SKILL.md; `command`: its slash command's file; `cale`: that command must be a cale reading the skill
// (only skills/me/** need one: CLAUDE.md, « Commandes »). A command alone is the workflow itself.
const ME = (x) => ({ select: `me:${x}`, skill: `skills/me/${x}/SKILL.md`, command: `commands/me/${x}.md`, cale: true });
const LOOP = (x) => ({ select: `me:loop:${x}`, skill: `skills/me/loop/${x}/SKILL.md`, command: `commands/me/loop/${x}.md`, cale: true });
const REFS = {
  "issue-worktree-pr": { select: "me:issue-worktree-pr", command: "commands/me/issue-worktree-pr.md" },
  "issue-branch-pr": { select: "me:issue-branch-pr", command: "commands/me/issue-branch-pr.md" },
  "spec-issue-worktree-pr": { select: "spec-git-flow-worktree", skill: "skills/spec-git-flow-worktree/SKILL.md", command: "commands/me/spec-issue-worktree-pr.md" },
  "spec-issue-branch-pr": { select: "spec-git-flow-branch", skill: "skills/spec-git-flow-branch/SKILL.md", command: "commands/me/spec-issue-branch-pr.md" },
  gwm: { select: "gwm", skill: "skills/gwm/SKILL.md" },
  ...Object.fromEntries(["goal", "dispatch", "release", "merge", "report", "check-reviews"].map((x) => [x, ME(x)])),
  ...Object.fromEntries(["claude-review-pr", "codex-review-pr", "ci-until-green"].map((x) => [`loop:${x}`, LOOP(x)])),
};
const refOf = (id) => REFS[id] ?? (id?.startsWith("loop:") ? LOOP(id.slice(5)) : null);

// The cycle, in order (WORKFLOW.md, « Workflow — Worktree »), and its side branches. `title`: the
// French one the intentions quote (they go to Claude); shown, a step reads strings.js' step.<id>.
// `cmd` null: its line is words (cmd.<id>), not a command.
const STEPS = [
  { id: "issue", icon: "circle-dashed", title: "Issue", cmd: "/me:issue-worktree-pr", ref: "issue-worktree-pr" }, // i18n: agent
  { id: "worktree", icon: "git-branch", title: "Worktree gwm", cmd: "gwm create · attach", ref: "gwm" }, // i18n: agent
  { id: "impl", icon: "git-commit", title: "Implémentation", cmd: null, ref: null }, // i18n: agent
  { id: "report", icon: "file-text", title: "Rapport", cmd: "/me:report", ref: "report" }, // i18n: agent
  { id: "review", icon: "file-diff", title: "Review", cmd: "/me:loop:claude-review-pr", ref: "loop:claude-review-pr", // i18n: agent
    alt: { cmd: "/me:loop:codex-review-pr", ref: "loop:codex-review-pr" } },
  { id: "ci", icon: "circle-check", title: "CI verte", cmd: "/me:loop:ci-until-green", ref: "loop:ci-until-green" }, // i18n: agent
  { id: "merge", icon: "git-merge", title: "Merge", cmd: "/me:merge", ref: "merge" }, // i18n: agent
  { id: "vault", icon: "archive", title: "Note vault", cmd: null, ref: null }, // i18n: agent
];
const cmdText = (x) => x.cmd ?? tr(`cmd.${x.id}`);
const BRANCHES = [
  { id: "goal", icon: "layout-list", title: "Sprint", cmd: "/me:goal", ref: "goal" }, // i18n: agent
  { id: "dispatch", icon: "bot", title: "Orchestration", cmd: "/me:dispatch", ref: "dispatch" }, // i18n: agent
  { id: "release", icon: "git-pull-request", title: "Release", cmd: "/me:release", ref: "release" }, // i18n: agent
];
const WORKFLOWS = ["issue-worktree-pr", "issue-branch-pr", "spec-issue-worktree-pr", "spec-issue-branch-pr", "goal", "dispatch", "release", "merge", "report", "check-reviews"];

// The session's first message, as written, then the intention when there is one.
const TASK = [
  "Session dédiée à la configuration de mon workflow Claude Code et Herdr. Lis d'abord ~/.claude/WORKFLOW.md, ~/.claude/RULES.md et ~/.claude/CLAUDE.md, puis demande-moi ce que je veux changer (ne change rien avant).", // i18n: agent
  "Règles :", // i18n: agent
  "- ~/.claude est géré par chezmoi : éditer le home puis `chezmoi add <chemins explicites>`, jamais de `chezmoi apply` sans chemin, et ~/.claude doit rester en 0700 ;", // i18n: agent
  "- une skill sous ~/.claude/skills/me/<x> n'est chargée que par sa commande-cale ~/.claude/commands/me/<x>.md, qui lit le SKILL.md avec Read et ne dit jamais « invoque la skill » ;", // i18n: agent
  "- settings.json se modifie par la skill update-config ;", // i18n: agent
  "- un changement de workflow met à jour WORKFLOW.md (section concernée et « Fait récemment ») ;", // i18n: agent
  "- commit et push du dépôt dotfiles seulement quand je le demande, messages Gitmoji + Conventional, sans tiret cadratin.", // i18n: agent
].join("\n");

// One stat for every file the page reads (macOS stat: PATH's may be GNU's); a missing one is absent.
const STAT = `cd "$1" || exit 0; shift; /usr/bin/stat -L -f '%m%t%N' "$@" skills/me/loop/*/SKILL.md commands/me/loop/*.md 2>/dev/null; exit 0`;

function find(node, id) {
  if (node?.id === id) return node;
  for (const c of node?.children ?? []) {
    const f = find(c, id);
    if (f) return f;
  }
  return null;
}
// Shown: kbrdn-threads' main "view" stack is on this page.
function visible() {
  const v = find(layout(), "view");
  return (v?.active ?? v?.children?.[0]?.id) === "workflow";
}

// kt-threads' Parcours twig (copied): a piece of trunk over the row's height `h` and a ╰ bending off it
// 8 px above the middle to the column's right edge; the `last` ends the trunk at its bend.
function twig(t, { h, x, last, color, rest }) {
  const mid = h / 2;
  return div().w(2 * x).h_full().flex_none().relative()
    .child(div().absolute().top(0).left(x).h(mid - 8).border_l(1).border_color(color))
    .when(!last, (el) => el.child(div().absolute().top(mid - 4).bottom(0).left(x).border_l(1).border_color(rest)))
    .child(div().absolute().top(mid - 8).left(x).w(x).h(9).border_l(1).border_b(1).rounded_bl(8).border_color(color));
}
const treeLine = (t) => alpha(t.foreground, settings().dark ? "38" : "4d");

export default class Workflow extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.vim = new Vim({ field: false });
    this.motion = motionState();
    this.filt = filterState();
    this.scroll = ScrollHandle.new();
    this.sec = "all";
    this.d = null; // the last scan (load())
    this.md = mdState(); // Conventions and Idées: Aperçu / Brut, their colors and parses
    this.cache = new Map(); // relative path -> { mtime, text }
    this.busy = false;
    this.again = false;
    this.error = null;
    this.scannedAt = 0;
    this.watches = [];
    this.shown = false;
    this.headW = 0;
    this.width = 1100;
    this.tier = "wide"; // tiers.js, from the width, each render
    this.cur = null; // the keys' cursor: an item id
    this.items = []; // the cursor's items, as the last render listed them
    this.reveal = null; // an item to scroll to once drawn
    this.notice = null; // { intent, why }: an intention that could not go to the live session
    if (checking()) return;
    // A hidden stack child doesn't render (ANIMATIONS.md): notice the page went, stop watching, give the
    // keyboard back to the thread; and redraw the cursor when the keyboard left without a render.
    cx.timer.every(1000, (cx) => {
      if (!visible()) {
        if (this.shown) {
          this.shown = false;
          this.unwatch();
          if (this.handle.is_focused()) this.focusThread();
        }
        this.keyed = false; // hidden: nothing to redraw, and no notify every second from here on
        return;
      }
      if (this.keyed !== this.handle.is_focused()) cx.notify();
    });
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "focus") this.focusIn();
        else if (c.startsWith("key:")) {
          this.focusIn();
          for (const k of keysOf(c.slice(4))) this.press(k, cx);
        } else if (c === "refresh") this.scan(cx, "commande");
        else if (c === "configure") this.configure(null, cx);
        else if (c.startsWith("configure:")) this.configure(c.slice(10), cx);
        cx.notify();
      }
    });
  }

  // ---------- data ----------

  scan(cx, why) {
    if (checking()) return;
    if (this.busy) { this.again = true; return; }
    this.busy = true;
    console.log(`kt-workflow: scan (${why})`);
    cx.spawn(async (cx) => {
      do {
        this.again = false;
        try {
          await this.load();
          this.error = null;
        } catch (e) {
          this.error = String(e?.message ?? e); // the last data stays shown
        }
      } while (this.again);
      this.busy = false;
      this.scannedAt = Date.now();
      cx.notify();
    });
  }

  async load() {
    const H = home(), C = `${H}/.claude`;
    const rels = [...new Set(["WORKFLOW.md", "settings.json", ...Object.values(REFS).flatMap((r) => [r.skill, r.command])].filter(Boolean))];
    const [st, chez, log, tpl] = await Promise.all([
      exec("sh", ["-c", STAT, "sh", C, ...rels]),
      exec(`${H}/.nix-profile/bin/chezmoi`, ["status", C], { timeout: 20e3 }).catch((e) => ({ code: -1, stdout: "", stderr: String(e?.message ?? e) })),
      exec("git", ["-C", `${H}/.local/share/chezmoi`, "log", "-1", "--format=%h %s · %cr"]).catch(() => null),
      hc(["templates", "--json"]).catch(() => null),
    ]);
    const files = new Map();
    await Promise.all(st.stdout.split("\n").map(async (line) => {
      const [m, rel] = line.split("\t");
      if (!rel) return;
      const mtime = Number(m);
      const c = this.cache.get(rel);
      if (c?.mtime === mtime) return void files.set(rel, c);
      const v = { mtime, text: await readTextFile(`${C}/${rel}`).catch(() => null) };
      this.cache.set(rel, v);
      files.set(rel, v);
    }));
    const md = files.get("WORKFLOW.md")?.text ?? null;
    const s = parse(files.get("settings.json")?.text);
    const loops = [...files.keys()].map((k) => /^skills\/me\/loop\/([^/_][^/]*)\/SKILL\.md$/.exec(k)?.[1]).filter(Boolean).sort()
      .map((x) => ({ id: `loop:${x}`, name: `me:loop:${x}`, ...(loopDef(files.get(`skills/me/loop/${x}/SKILL.md`).text) ?? {}) }));
    const lines = chez.stdout.split("\n").filter((l) => l.trim());
    this.d = {
      files,
      md,
      updated: updatedOn(md),
      mdTime: files.get("WORKFLOW.md")?.mtime ?? null,
      // i18n: tech (WORKFLOW.md's own headings)
      tools: table(section(md, "Outils & priorités")),
      conventions: section(md, "Conventions"), // i18n: tech
      ideas: section(md, "Idées"), // i18n: tech
      loops,
      settings: s,
      settingsRaw: files.has("settings.json"),
      chez: chez.code === 0 ? { n: lines.length, lines } : { error: (chez.stderr || chez.stdout || `code ${chez.code}`).trim().split("\n")[0] },
      commit: log?.code === 0 ? log.stdout.trim() : null,
      templates: tpl?.code === 0 ? (parse(tpl.stdout)?.templates ?? []).map((x) => x?.name ?? String(x)) : null,
    };
  }

  // A ref's state: what's missing (alerts), whether its command is a copy rather than a cale, its
  // description (the skill's, else the command's), its file and that file's mtime.
  state(id) {
    const r = refOf(id);
    const f = this.d?.files;
    if (!r || !f) return null;
    const miss = [];
    const noCommand = Boolean(r.command && !f.has(r.command));
    if (r.skill && !f.has(r.skill)) miss.push(tr("missSkill", { path: r.skill }));
    if (noCommand) miss.push(tr(r.cale ? "missCale" : "missCommand", { path: r.command }));
    const copy = Boolean(r.cale && f.has(r.command) && !isCale(f.get(r.command).text, r.skill));
    const main = r.skill && f.has(r.skill) ? r.skill : r.command && f.has(r.command) ? r.command : null;
    const desc = [r.skill, r.command].map((p) => p && f.get(p)?.text).filter(Boolean)
      .map((x) => String(frontmatter(x).meta.description ?? "").trim()).find(Boolean) ?? "";
    return { r, miss, noCommand, copy, desc, path: main ? `${home()}/.claude/${main}` : null, mtime: main ? f.get(main).mtime : null };
  }

  // ---------- actions ----------

  openSkill(select) {
    if (!select || checking()) return;
    openOverlay({ mod: "kt-skills", kind: "dialog", frame: "none", width: 0.9, height: 0.88, props: { select } });
  }

  // Zed's CLI when it's there, else its URL scheme.
  zed(path) {
    if (path) exec("zed", [path]).catch(() => exec("open", [`zed://file${path}`]).catch(() => {}));
  }

  copy(text, cx) {
    cx.write_to_clipboard(text);
    notify({ title: tr("copied"), body: text, level: "success", timeout: 2000 });
  }

  // « Configurer avec Claude » (intent null) and « Modifier avec Claude » (intent: "le loop …"): the one
  // « Workflow » session (session.js, shared with kt-automation): shown, or opened in ~/.claude on the
  // task; an intention typed only between two turns (idle, done), else said here with Réessayer.
  configure(intent, cx) {
    if (checking()) return;
    cx.spawn(async (cx) => {
      const r = await dedicated({ name: NAME, folder: `${home()}/.claude`, task: TASK, intent });
      this.notice = r.why ? { intent, why: r.why } : null;
      if (r.done === "sent") notify({ title: tr("sent"), body: intent, level: "success", timeout: 2500 });
      cx.notify();
    });
  }

  focusThread() {
    const sp = spaces().find((s) => s.active);
    const tab = sp?.tabs.find((c) => c.active)?.id;
    const pane = panes().find((p) => p.tab === tab && p.focused)?.pane;
    if (pane) run("pane.focus", { pane });
  }

  watch(cx) {
    if (this.watches.length) return;
    for (const dir of [`${home()}/.claude/skills`, `${home()}/.claude/commands`]) {
      cx.spawn(async (cx) => {
        for (;;) {
          const w = watchFolder(dir);
          this.watches.push(w);
          let paths;
          try { paths = await w; } catch { return; }
          this.watches = this.watches.filter((x) => x !== w);
          if (!paths.length) return; // cancelled
          this.scan(cx, "fichiers");
        }
      });
    }
  }

  unwatch() {
    for (const w of this.watches) w.cancel();
    this.watches = [];
  }

  // ---------- keys (vim.js; kt-keys lists them) ----------

  focusIn() {
    this.handle.focus();
    this.vim.normal();
    if (!this.items.some((x) => x.id === this.cur)) this.cur = this.items[0]?.id ?? null;
    this.reveal = this.cur;
  }

  key(e, cx) {
    if (!this.press(e, cx)) return; // not ours: ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  press(k, cx) {
    const name = keyOf(k).name;
    const x = this.items.find((i) => i.id === this.cur) ?? this.items[0] ?? null;
    if (name === "e") { if (x?.intent) this.configure(x.intent, cx); return true; }
    if (name === "C") { this.configure(null, cx); return true; }
    if (name === "p") { this.vim.normal(); this.md.raw = !this.md.raw; return true; }
    const a = this.vim.handle(k);
    if (!a) return false;
    if (a === "pending" || a === "count") return true;
    const i = x ? this.items.indexOf(x) : -1;
    if (["down", "up", "top", "bottom", "half-down", "half-up", "next", "prev"].includes(a)) {
      const to = this.items[step(a === "next" ? "down" : a === "prev" ? "up" : a, i, this.items.length, this.vim.count, 10)];
      if (to) { this.cur = to.id; this.reveal = to.id; }
    } else if (a === "tab-next" || a === "tab-prev") {
      const k2 = SECS.findIndex(([id]) => id === this.sec);
      this.sec = SECS[(k2 + (a === "tab-next" ? 1 : SECS.length - 1)) % SECS.length][0];
      this.cur = null;
    } else if (a === "open" || a === "right") this.openSkill(x?.select);
    else if (a === "open-alt") this.zed(x?.path);
    else if (a === "yank") { if (x?.cmd) this.copy(x.cmd, cx); }
    else if (a === "refresh") this.scan(cx, "r");
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "pages" } });
    else if (a === "quit" || a === "escape") {
      run("layout.select", { stack: "view", child: "thread" });
      this.focusThread();
    } else return false;
    return true;
  }

  // ---------- pieces ----------

  card(t) {
    return v_flex().min_h(0).rounded(16).border(1).border_color(t.border).bg(t.background);
  }

  eyebrow(t, text, color) {
    return div().font_family(MONO).text_size(11).text_color(color ?? t.muted).child(String(text).toUpperCase());
  }

  // kbrdn.dev `.tag`: pill, border 30% / fill 10% of its own color.
  tag(t, color, text) {
    return h_flex().flex_none().h(18).px(7).items_center().rounded_full().border(1).border_color(alpha(color, "4d")).bg(alpha(color, "1a"))
      .text_color(color).font_family(MONO).text_size(10).child(String(text).toUpperCase());
  }

  // A small round icon button; it keeps its click from the row.
  icon(t, id, icon, tip, fn) {
    return div().id(id).p(4).rounded_full().flex_none().text_color(t.muted).cursor_pointer()
      .hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tip)
      .on_click((_e, cx) => { cx.stop_propagation(); fn(cx); cx.notify(); })
      .child(svg(icon).size(13));
  }

  // A section's head: its name and count on a dashed rule, « Modifier avec Claude » for the section.
  head(t, id, label, n, intent, first, extra) {
    return h_flex().px(8).pt(first ? 6 : 18).pb(6).gap(10).items_center()
      .child(this.eyebrow(t, n == null ? label : `${label} · ${n}`).flex_none())
      .child(div().flex_1().h(0).border_t(1).border_dashed().border_color(t.border))
      .when(Boolean(extra), (el) => el.child(extra))
      .when(Boolean(intent), (el) => el.child(this.icon(t, `ktw-edit-${id}`, I("square-pen"), tr("editWith", { intent }), (cx) => this.configure(intent, cx))));
  }

  // The cursor's look: a 1 px accent ring with the ink, while the page has the keyboard.
  ring(el, t, on) {
    return el.border_color(on ? alpha(t.accent, "99") : t.border).bg(on ? alpha(t.accent, "24") : t.background);
  }

  dot(t, st) {
    if (!st) return null;
    const bad = st.miss.length > 0;
    return div().size(8).flex_none().rounded_full().bg(bad ? t.ansi1 : st.copy ? t.ansi3 : t.done);
  }

  tip(st, fallback) {
    if (!st) return fallback;
    if (st.miss.length) return st.miss.join("\n");
    if (st.copy) return tr("copyTip", { fallback, skill: st.r.skill });
    return fallback;
  }

  // ---------- header ----------

  header(t) {
    const d = this.d;
    const chez = d?.chez;
    // Before the first scan, each fact's value as a bar (skeleton.js), breathing.
    const S = skeleton(t, this.m);
    const bar = (id, w) => S.pulse(S.line(w, { h: 7, lh: 15 }).id(id));
    const chezText = !d ? bar("ktw-f-chez-sk", 110) : chez.error ? tr("chezError", { error: chez.error }) : chez.n ? tr("drift", { n: chez.n }) : tr("upToDate");
    const chezColor = !d ? t.dim : chez.error ? t.ansi1 : chez.n ? t.ansi3 : t.done;
    // At least 150 px each: on a narrow page, the facts go to the next line rather than to nothing.
    const fact = (id, label, value, color, tip) => v_flex().id(id).flex_1().min_w(150).gap(2).px(10).py(6)
      .when(Boolean(tip), (el) => el.tooltip(tip))
      .child(this.eyebrow(t, label, t.dim))
      .child(div().truncate().font_family(MONO).text_size(11.5).text_color(color ?? t.foreground).child(value));
    const items = SECS.map(([key, tint]) => ({ key, label: tr(`sec.${key}`), tint, count: this.count(key) }));
    const seg = filterRow({ id: "ktw-seg", t, state: this.filt, active: this.sec, items, reduced: Boolean(shared("kt.reducedMotion")),
      onPick: (k) => { this.sec = k; this.cur = null; } });
    // Narrow (tiers.js): the icon alone, its tooltip says it.
    const narrow = this.tier === "narrow";
    const configure = h_flex().id("ktw-configure").flex_none().h(30).px(narrow ? 8 : 13).gap(6).items_center().rounded_full()
      .bg(t.solid).text_color(t.solid_foreground).text_size(12.5).font_medium().cursor_pointer()
      .hover((s) => s.bg(alpha(t.solid, "d9"))).tooltip(tr("configureTip"))
      .on_click((_e, cx) => { this.configure(null, cx); cx.notify(); })
      .child(svg(I("bot")).size(13)).when(!narrow, (el) => el.child(tr("configure")));
    const live = session(NAME);
    return this.card(t).id("ktw-head").relative().flex_none().px(4).pb(4).gap(4)
      .on_size_change((s, cx) => { if (s.width !== this.headW) { this.headW = s.width; cx.notify(); } })
      .children([dither(this.headW, 60, 16, t.ansi3)].filter(Boolean))
      .child(bandRow(t, { m: this.m, color: t.ansi3, icon: I("workflow"), title: "Workflow", // i18n: tech
        dot: live?.agent ? ({ working: t.working, blocked: t.blocked }[live.agent.status] ?? t.done) : null,
        sub: [tr("sub"), tr("readOnly"), this.scannedAt ? tr("readAt", { time: clock(this.scannedAt) }) : null, live ? tr("sessionOpen", { name: NAME }) : null],
        buttons: [
          iconBtn(t, "ktw-b-zed", I("external-link"), tr("zedTip"), () => this.zed(`${home()}/.claude/WORKFLOW.md`)),
          iconBtn(t, "ktw-b-refresh", I("refresh-cw"), this.busy ? tr("scanningTip") : tr("refreshTip"), (cx) => this.scan(cx, "bouton")), // i18n: tech
          div().w(4).flex_none(),
          configure] }))
      .child(div().flex_none().mx(-4).h(0).border_t(1).border_dashed().border_color(alpha(t.ansi3, "4d")))
      .child(h_flex().flex_none().flex_wrap().gap(4).items_center()
        .child(fact("ktw-f-md", "WORKFLOW.md", !d ? bar("ktw-f-md-sk", 150) : d.md == null ? tr("notFound")
          : [d.updated ? tr("updated", { date: d.updated }) : null, d.mdTime ? tr("modified", { ago: ago(d.mdTime * 1000) }) : null].filter(Boolean).join(" · "),
          d && d.md == null ? t.ansi1 : null))
        .child(fact("ktw-f-chez", "chezmoi · ~/.claude", chezText, chezColor, chez?.lines?.length ? chez.lines.join("\n") : null)) // i18n: tech
        .child(fact("ktw-f-git", "dotfiles", !d ? bar("ktw-f-git-sk", 70) : d.commit ?? tr("noSource"), d && !d.commit ? t.dim : null, d?.commit))
        .when(this.busy, (el) => el.child(pulse(this.m, div().px(8).font_family(MONO).text_size(11).text_color(t.dim).child(tr("scanning")), true))))
      .when(Boolean(this.notice), (el) => el.child(this.noticeRow(t)))
      .child(div().px(4).pb(2).child(seg));
  }

  // An intention that couldn't go to the live session: why, Réessayer, the session, dismiss.
  noticeRow(t) {
    const n = this.notice;
    const btn = (id, label, fn) => h_flex().id(id).flex_none().h(26).px(10).items_center().rounded_full().border(1).border_color(alpha(t.ansi3, "66"))
      .text_size(12).text_color(t.foreground).cursor_pointer().hover((s) => s.bg(alpha(t.ansi3, "24")))
      .on_click((_e, cx) => { fn(cx); cx.notify(); }).child(label);
    return enter(this.m, h_flex().mx(4).px(10).py(6).gap(8).items_center().rounded(12).border(1).border_color(alpha(t.ansi3, "66")).bg(alpha(t.ansi3, "14")), "ktw-notice", { dy: 0 })
      .child(svg(I("circle-alert")).size(14).flex_none().text_color(t.ansi3))
      .child(v_flex().flex_1().min_w(0).gap(1)
        .child(div().text_size(12.5).text_color(t.foreground).child(n.why))
        .child(div().truncate().font_family(MONO).text_size(11).text_color(t.muted).child(intention(n.intent))))
      .child(btn("ktw-n-retry", tr("retry"), (cx) => this.configure(n.intent, cx)))
      .child(btn("ktw-n-show", tr("seeSession"), () => { const s = session(NAME); if (s) showSession(s); }))
      .child(this.icon(t, "ktw-n-x", I("x"), tr("dismiss"), () => { this.notice = null; }));
  }

  count(key) {
    const d = this.d;
    if (!d) return null;
    if (key === "cycle") return STEPS.length + BRANCHES.length;
    if (key === "workflows") return WORKFLOWS.length;
    if (key === "loops") return d.loops.length;
    if (key === "tools") return d.tools?.rows.length ?? 0;
    return null;
  }

  // ---------- sections (each returns the scroll area's direct children) ----------

  cycle(t, kids) {
    const rest = treeLine(t);
    const card = (x, i) => {
      const st = this.state(x.ref);
      const alt = x.alt ? this.state(x.alt.ref) : null;
      const on = this.keyed && this.cur === `step:${x.id}`;
      this.item(kids, { id: `step:${x.id}`, select: st?.r.select, path: st?.path, cmd: x.cmd?.startsWith("/") ? x.cmd : null,
        intent: `l'étape « ${x.title} » du cycle${x.ref ? ` (${x.cmd})` : ""}` }); // i18n: agent
      const bad = (st?.miss.length ?? 0) + (alt?.miss.length ?? 0) > 0;
      return this.ring(v_flex().id(`ktw-step-${x.id}`).w(148).h(96).flex_none().p(10).gap(3).rounded(12).border(1), t, on)
        .when(bad && !on, (el) => el.border_color(alpha(t.ansi1, "80")))
        .when(Boolean(st), (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => { this.cur = `step:${x.id}`; this.openSkill(st.r.select); cx.notify(); }))
        .tooltip(this.tip(st, x.ref ? tr("openEnter", { what: st?.r.select ?? x.ref }) : tr("noSkill")))
        .child(h_flex().gap(6).items_center()
          .child(svg(I(x.icon)).size(13).flex_none().text_color(t.ansi3))
          .child(div().flex_1().font_family(MONO).text_size(10).text_color(t.dim).child(String(i + 1).padStart(2, "0")))
          .when(bad, (el) => el.child(svg(I("circle-alert")).size(12).text_color(t.ansi1)))
          .children([this.dot(t, st)].filter(Boolean)))
        .child(div().truncate().text_size(13).font_semibold().text_color(t.foreground).child(tr(`step.${x.id}`)))
        .child(div().truncate().font_family(MONO).text_size(10.5).text_color(st || !x.ref ? t.muted : t.dim).child(cmdText(x)))
        .when(Boolean(x.alt), (el) => el.child(div().id(`ktw-alt-${x.id}`).truncate().font_family(MONO).text_size(10).text_color(alt?.miss.length ? t.ansi1 : t.dim)
          .cursor_pointer().hover((s) => s.text_color(t.foreground)).tooltip(this.tip(alt, tr("open", { what: alt?.r.select ?? "" })))
          .on_click((_e, cx) => { cx.stop_propagation(); this.openSkill(alt?.r.select); cx.notify(); })
          .child(tr("altReview", { cmd: x.alt.cmd }))));
    };
    const arrow = () => svg(I("chevron-right")).size(14).flex_none().text_color(t.dim);
    // i18n: agent (the intention, below)
    kids.push(this.head(t, "cycle", tr("sec.cycle"), STEPS.length, "le cycle (issue → note vault) et ses branches", kids.length === 0));
    kids.push(h_flex().px(8).flex_wrap().gap(6).items_center()
      .children(STEPS.flatMap((x, i) => (i ? [arrow(), card(x, i)] : [card(x, i)]))));
    // The side branches, on kbrdn.dev's Parcours (kt-threads' twig).
    const H = 44, X = 12;
    BRANCHES.forEach((x, i) => {
      const st = this.state(x.ref);
      const on = this.keyed && this.cur === `branch:${x.id}`;
      this.item(kids, { id: `branch:${x.id}`, select: st?.r.select, path: st?.path, cmd: x.cmd, intent: `la branche « ${x.title} » (${x.cmd})` }); // i18n: agent
      const bad = st?.miss.length > 0;
      kids.push(h_flex().id(`ktw-branch-${x.id}`).h(H).px(8).gap(8).items_center().rounded(12)
        .when(i === 0, (el) => el.mt(10))
        .bg(on ? alpha(t.accent, "24") : alpha(t.background, "00")).cursor_pointer().hover((s) => s.bg(t.hover))
        .tooltip(this.tip(st, tr("openEnter", { what: st?.r.select ?? x.ref })))
        .on_click((_e, cx) => { this.cur = `branch:${x.id}`; this.openSkill(st?.r.select); cx.notify(); })
        .child(twig(t, { h: H, x: X, last: i === BRANCHES.length - 1, color: alpha(t.ansi3, "99"), rest }))
        .child(div().size(26).flex_none().rounded(8).border(1).border_color(on ? alpha(t.accent, "99") : alpha(t.ansi3, "4d")).bg(alpha(t.ansi3, "1a"))
          .flex().items_center().justify_center().child(svg(I(x.icon)).size(13).text_color(t.ansi3)))
        .child(div().w(110).flex_none().text_size(13).font_semibold().text_color(t.foreground).child(tr(`branch.${x.id}`)))
        .child(div().w(130).flex_none().font_family(MONO).text_size(11).text_color(t.muted).child(x.cmd))
        .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.dim).child(tr(`note.${x.id}`)))
        .when(bad, (el) => el.child(svg(I("circle-alert")).size(12).text_color(t.ansi1)))
        .children([this.dot(t, st)].filter(Boolean)));
    });
  }

  workflows(t, kids) {
    // i18n: agent (the intention)
    kids.push(this.head(t, "workflows", tr("sec.workflows"), WORKFLOWS.length, "les points d'entrée du workflow (/me:*)", kids.length === 0));
    const cols = { wide: 3, medium: 2, narrow: 1 }[this.tier]; // tiers.js
    const card = (id) => {
      const st = this.state(id);
      const r = st.r;
      const cmd = `/me:${id}`;
      const on = this.keyed && this.cur === `wf:${id}`;
      const intent = `le workflow ${cmd}`; // i18n: agent
      this.item(kids, { id: `wf:${id}`, select: r.select, path: st.path, cmd, intent });
      const cale = !r.command ? null : st.noCommand ? [t.ansi1, r.cale ? tr("caleMissing") : tr("commandMissing")]
        : st.copy ? [t.ansi3, tr("copyNotCale")] : [t.done, r.cale ? tr("cale") : tr("command")];
      return this.ring(v_flex().id(`ktw-wf-${id}`).flex_1().min_w(0).p(12).gap(6).rounded(12).border(1), t, on)
        .when(st.miss.length > 0 && !on, (el) => el.border_color(alpha(t.ansi1, "80")))
        .cursor_pointer().when(!on, (el) => el.hover((s) => s.bg(t.hover)))
        .on_click((_e, cx) => { this.cur = `wf:${id}`; this.openSkill(r.select); cx.notify(); })
        .child(h_flex().gap(8).items_center()
          .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(13).font_medium().text_color(t.foreground).child(cmd))
          .when(Boolean(cale), (el) => el.child(this.tag(t, cale[0], cale[1]))))
        .child(div().text_size(12.5).line_height("18px").text_color(st.desc ? t.muted : t.dim).child(clip(st.desc) || tr("noDescription")))
        .child(div().flex_1())
        .child(h_flex().gap(8).items_center()
          .child(v_flex().flex_1().min_w(0).gap(1)
            .child(div().truncate().font_family(MONO).text_size(10.5).text_color(st.miss.length ? t.ansi1 : t.dim)
              .child(st.miss.length ? st.miss[0] : tilde(st.path ?? "")))
            .child(div().font_family(MONO).text_size(10.5).text_color(t.dim).child(st.mtime ? tr("modified", { ago: ago(st.mtime * 1000) }) : "—")))
          .child(this.icon(t, `ktw-wf-open-${id}`, "mods/kt-skills/eye.svg", tr("openSkills"), () => this.openSkill(r.select)))
          .child(this.icon(t, `ktw-wf-zed-${id}`, I("external-link"), tr("openZed"), () => this.zed(st.path)))
          .child(this.icon(t, `ktw-wf-edit-${id}`, I("square-pen"), tr("editE"), (cx) => this.configure(intent, cx))));
    };
    for (let i = 0; i < WORKFLOWS.length; i += cols) {
      const row = WORKFLOWS.slice(i, i + cols).map(card);
      while (row.length < cols) row.push(div().flex_1().min_w(0));
      kids.push(h_flex().px(4).pb(4).gap(4).items_stretch().children(row));
    }
  }

  // A table cell on a narrow page (tiers.js): its column's name, then the cell.
  stacked(t, label, el) {
    return h_flex().gap(10).items_start()
      .child(this.eyebrow(t, label, t.dim).w(80).flex_none().pt(2))
      .child(div().flex_1().min_w(0).child(el));
  }

  loops(t, kids) {
    const loops = this.d.loops;
    // kt-automation's page, pre-filtered on its loops (its command reaches the shown copy: after the select).
    const auto = find(layout(), "view")?.children?.some((c) => c.id === "automation")
      ? this.icon(t, "ktw-loops-auto", I("refresh-cw"), tr("manageLoops"), () => {
        run("layout.select", { stack: "view", child: "automation" });
        run("kt-automation.filter:loops");
      }) : null;
    // i18n: agent (the intention)
    kids.push(this.head(t, "loops", tr("sec.loops"), loops.length, "les loops me:loop:*", kids.length === 0, auto));
    const COLS = [["name", 200], ["goal", null], ["max", 44], ["exit", null], ["check", 92]];
    // Narrow (tiers.js): no columns, each loop stacked: its name and check, then goal, exit, max.
    const narrow = this.tier === "narrow";
    const row = (cells, extra) => (narrow
      ? v_flex().px(12).py(8).gap(4)
        .child(h_flex().gap(8).items_center().child(cells[0].flex_1()).child(cells[4]))
        .children([1, 3, 2].map((i) => this.stacked(t, tr(`col.${COLS[i][0]}`), cells[i])))
      : h_flex().px(12).py(8).gap(12).items_start().children(cells.map((c, i) => {
        const w = COLS[i][1];
        return (w ? div().w(w).flex_none() : div().flex_1().min_w(0)).child(c);
      }))).when(Boolean(extra), extra);
    if (!narrow) kids.push(row(COLS.map(([h]) => this.eyebrow(t, tr(`col.${h}`), t.dim))));
    if (!loops.length) kids.push(div().px(12).py(8).text_size(12.5).text_color(t.dim).child(tr("noLoop")));
    for (const x of loops) {
      const st = this.state(x.id);
      const on = this.keyed && this.cur === x.id;
      this.item(kids, { id: x.id, select: x.name, path: st?.path, cmd: `/${x.name}`, intent: `le loop ${x.name}` }); // i18n: agent
      const color = { shell: t.ansi2, agents: t.ansi5 }[x.check] ?? t.dim;
      kids.push(row([
        h_flex().gap(6).items_center().min_w(0)
          .children([this.dot(t, st)].filter(Boolean))
          .child(div().min_w(0).truncate().font_family(MONO).text_size(12).font_medium().text_color(t.foreground).child(x.name.replace(/^me:loop:/, ""))),
        div().text_size(12).line_height("17px").text_color(t.muted).child(x.goal || "—"),
        div().font_family(MONO).text_size(12).text_color(t.foreground).child(x.max ?? "—"),
        div().text_size(12).line_height("17px").text_color(t.muted).child(x.exit || "—"),
        x.check ? h_flex().child(this.tag(t, color, x.check === "par projet" ? tr("perProject") : x.check)) : div().text_size(12).text_color(t.dim).child("—"), // i18n: tech
      ], (el) => el.id(`ktw-loop-${x.id}`).mx(4).rounded(12).border(1)
        .border_color(on ? alpha(t.accent, "99") : alpha(t.border, "00")).bg(on ? alpha(t.accent, "24") : alpha(t.background, "00"))
        .cursor_pointer().when(!on, (e) => e.hover((s) => s.bg(t.hover)))
        .tooltip(this.tip(st, tr("openLoop", { name: x.name })))
        .on_click((_e, cx) => { this.cur = x.id; this.openSkill(x.name); cx.notify(); })));
    }
  }

  tools(t, kids) {
    const tb = this.d.tools;
    // i18n: agent (the intention)
    kids.push(this.head(t, "tools", tr("tools"), tb?.rows.length ?? 0, "les outils et priorités (WORKFLOW.md, « Outils & priorités »)", kids.length === 0));
    if (!tb) return void kids.push(div().px(12).py(8).text_size(12.5).text_color(t.dim).child(tr("noTable")));
    const n = tb.head.length;
    // Narrow (tiers.js): no columns, each row stacked: its first cell as the title, then each other
    // under its column's name.
    const narrow = this.tier === "narrow";
    const row = (cells, head, i) => {
      const cell = (k) => {
        const text = stripMd(cells[k] ?? "");
        const box = narrow ? div() : k === 0 ? div().w(200).flex_none() : div().flex_1().min_w(0);
        return head ? box.child(this.eyebrow(t, text, t.dim))
          : box.text_size(12).line_height("17px").text_color(k === 0 ? t.foreground : t.muted).when(k === 0, (el) => el.font_medium()).child(text || "—");
      };
      return (narrow
        ? v_flex().px(12).py(8).gap(4).child(cell(0))
          .children(Array.from({ length: n - 1 }, (_, k) => this.stacked(t, stripMd(tb.head[k + 1] ?? ""), cell(k + 1))))
        : h_flex().px(12).py(head ? 6 : 8).gap(12).items_start().children(Array.from({ length: n }, (_, k) => cell(k))))
        .when(!head && i > 0, (el) => el.border_t(1).border_color(alpha(t.border, "99")));
    };
    if (!narrow) kids.push(row(tb.head, true));
    tb.rows.forEach((r, i) => kids.push(row(r, false, i)));
  }

  guards(t, kids) {
    const s = this.d.settings;
    kids.push(this.head(t, "guards", tr("sec.guards"), null, null, kids.length === 0));
    const box = (id, title, intent, ...body) => v_flex().mx(4).mb(4).p(12).gap(8).rounded(12).border(1).border_color(t.border)
      .child(h_flex().gap(8).items_center()
        .child(div().flex_1().text_size(13).font_semibold().text_color(t.foreground).child(title))
        .child(this.icon(t, `ktw-g-edit-${id}`, I("square-pen"), tr("editWith", { intent }), (cx) => this.configure(intent, cx))))
      .children(body);
    // A settings key as written (camelCase), not an eyebrow. Narrow (tiers.js): above its value.
    const narrow = this.tier === "narrow";
    const pairBox = () => (narrow ? v_flex().gap(2) : h_flex().gap(10).items_start());
    const key = (k, color) => div().when(!narrow, (el) => el.w(170).flex_none()).pt(1).font_family(MONO).text_size(11).text_color(color ?? t.dim).child(k);
    const kv = (k, v, color) => pairBox()
      .child(key(k))
      .child(div().flex_1().min_w(0).font_family(MONO).text_size(12).text_color(color ?? t.foreground).child(mask(v ?? "—")));
    const chip = (text, color) => div().flex_none().px(8).py(3).rounded(8).border(1).border_color(alpha(color ?? t.border, "66")).bg(alpha(color ?? t.dim, "14"))
      .font_family(MONO).text_size(11).text_color(t.foreground).child(mask(text));
    if (!s) {
      kids.push(div().px(12).py(8).text_size(12.5).text_color(this.d.settingsRaw ? t.ansi1 : t.dim)
        .child(this.d.settingsRaw ? tr("badSettings") : tr("noSettings")));
    } else {
      const p = s.permissions ?? {};
      const mode = String(p.defaultMode ?? "default");
      // i18n: agent (the intention)
      kids.push(box("perms", "Permissions", "les permissions (settings.json, permissions)",
        kv("defaultMode", mode, mode === "bypassPermissions" ? t.ansi3 : null),
        kv(tr("rules"), `${(p.allow ?? []).length} allow · ${(p.ask ?? []).length} ask · ${(p.deny ?? []).length} deny`), // i18n: tech
        this.eyebrow(t, "deny", t.dim), // i18n: tech
        (p.deny ?? []).length ? h_flex().flex_wrap().gap(4).children((p.deny ?? []).map((x) => chip(String(x), t.ansi1)))
          : div().text_size(12).text_color(t.dim).child(tr("noDeny"))));
      // i18n: agent (the intention)
      kids.push(box("model", tr("model"), "le modèle, l'effort et crossSessionInbound (settings.json)",
        kv("model", s.model),
        kv("effortLevel", s.effortLevel ?? s.effort),
        kv("crossSessionInbound", s.crossSessionInbound)));
      const hooks = Object.entries(s.hooks ?? {});
      // i18n: agent (the intention)
      kids.push(box("hooks", tr("hooks", { n: hooks.length }), "les hooks (settings.json)",
        ...(hooks.length ? hooks.map(([ev, arr]) => pairBox()
          .child(key(ev, /^Worktree/.test(ev) ? t.ansi2 : null))
          .child(v_flex().flex_1().min_w(0).gap(2).children((Array.isArray(arr) ? arr : []).flatMap((m) => (m?.hooks ?? []).map((h) =>
            div().font_family(MONO).text_size(11.5).line_height("17px").text_color(t.foreground)
              .child(`${m.matcher ? `[${mask(m.matcher)}] ` : ""}${mask(h.command ?? h.prompt ?? h.type ?? "").split(`${home()}/`).join("~/")}`))))))
          : [div().text_size(12).text_color(t.dim).child(tr("noHook"))])));
    }
    const tpl = this.d.templates;
    // i18n: agent (the intention; « Templates hc » is hc's name)
    kids.push(box("templates", `Templates hc${tpl?.length ? ` · ${tpl.length}` : ""}`, "les templates hc (~/.config/herdr-core/templates)",
      tpl == null ? div().text_size(12).text_color(t.ansi1).child(tr("noTemplates"))
        : tpl.length ? h_flex().flex_wrap().gap(4).children(tpl.map((x) => chip(x, t.ansi5)))
          : div().text_size(12).text_color(t.dim).child(tr("emptyTemplates"))));
  }

  // Conventions and Idées by markdown.js: Aperçu or Brut (this.md.raw, the chips in each head, or p);
  // Aperçu at most 820 px wide, Brut as wide as the page (it soft-wraps).
  notes(t, kids, cx) {
    const budget = mdBudget(); // one for both sections: a render has ~50 ms (markdown.js)
    // `section`: WORKFLOW.md's heading, as the file writes it.
    const md = (id, section, text, intent) => {
      kids.push(this.head(t, id, tr(id), null, intent, kids.length === 0, text ? mdTabs(t, `ktw-md-tabs-${id}`, this.md) : null));
      kids.push(div().px(12).pb(8).when(!this.md.raw, (el) => el.max_w(820)).text_size(13).line_height("21px").text_color(t.foreground)
        .child(text ? view(t, this.m, cx, this.md, { id: `ktw-md-${id}`, mod: "kt-workflow", doc: docOf(this.md, text), budget })
          : div().text_color(t.dim).child(tr("noSection", { section }))));
    };
    md("conventions", "Conventions", this.d.conventions, "les conventions transverses (WORKFLOW.md)"); // i18n: agent
    md("ideas", "Idées", this.d.ideas, "les idées et le à faire (WORKFLOW.md)"); // i18n: agent
  }

  // The cursor's items, each built just before the scroll child that holds it is pushed: that child's
  // index is kids.length then (scroll_to_item counts direct children).
  item(kids, x) {
    this.items.push({ ...x, child: kids.length });
  }

  body(t, cx) {
    const kids = [];
    this.items = [];
    if (!this.d) {
      // Before the first scan: a section's head and its cards as bars (skeleton.js), breathing.
      const S = skeleton(t, this.m);
      kids.push(this.error ? div().p(16).text_size(13).text_color(t.ansi1).child(this.error)
        : S.pulse(v_flex().id("ktw-body-sk").gap(6).child(div().px(8).pt(6).pb(2).child(S.line(110, { h: 7, lh: 16 })))
          .children([96, 72, 120].map((h) => S.block(null, h).mx(4)))));
    } else {
      for (const [k, fn] of [["cycle", this.cycle], ["workflows", this.workflows], ["loops", this.loops], ["tools", this.tools], ["guards", this.guards], ["notes", this.notes]])
        if (this.sec === "all" || this.sec === k) fn.call(this, t, kids, cx);
      if (this.error) kids.push(div().px(12).py(8).text_size(12).text_color(t.ansi1).child(tr("lastFailed", { error: this.error })));
    }
    const to = this.reveal && this.items.find((x) => x.id === this.reveal);
    if (to) {
      this.scroll.scroll_to_item(to.child);
      this.reveal = null;
    }
    // A section or a width tier (tiers.js) changes: the body fades in (the scroll stays, its handle).
    return enter(this.m, v_flex().flex_1().min_h(0), `ktw-in-${this.sec}-${this.tier}`, { dy: 0 })
      .child(v_flex().id("ktw-body").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).p(4).pb(16).gap(2).children(kids));
  }

  render(cx) {
    this.m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    const vis = visible();
    if (!checking()) {
      // The bus (DATA-SYNC.md): a skill or plugin added elsewhere rescans, shown or not.
      refreshOn(this, cx, "data", ["skills", "plugins"], async (cx) => this.scan(cx, "bus"));
      if (vis) this.watch(cx);
      if (vis && !this.shown) {
        // The thread's terminal is hidden under this page: take the keyboard (NORMAL), after the app
        // has settled its own focus on the switch.
        cx.timer.after(150, (cx) => {
          if (visible() && !this.handle.is_focused()) this.focusIn();
          cx.notify();
        });
        // Back on the page: read again when the last read is more than 10 s old (DATA-SYNC.md).
        if (Date.now() - this.scannedAt > 10e3) this.scan(cx, "page");
      }
    }
    this.shown = vis;
    this.keyed = this.handle.is_focused();
    const t = theme();
    this.tier = tierOf(this.width); // tiers.js: the root's width
    // No frame of its own: the layout's center column (chrome, radius 20, padding 4) holds it.
    return v_flex().id("ktw-root").size_full().gap(4).text_color(t.foreground)
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .on_size_change((size, cx) => { if (size.width !== this.width) { this.width = size.width; cx.notify(); } })
      .child(this.header(t))
      .child(this.card(t).flex_1().min_h(0).overflow_hidden().child(this.body(t, cx)));
  }
}
