// auto.js: what kt-automation reads and builds, pure (no herdr, no gpui, no module state), so Bun
// checks it (auto.check.mjs): the scan's files sorted out, a loop's definition, its cale, the loops
// running now (live data in), « Itération N/M » on a screen, where and how a loop is launched, an
// automation script's summary, the dedicated session's task and intentions. Its words to people are
// codes (launch's errors, loopDef's script) that main.js says (I18N.md); what goes to the session stays
// in French.

/** The dedicated session's first message, as written (the intention follows it). */
export const TASK = [
  "Session dédiée à mes automatisations : loops Claude (me:loop:*) et automatisations Herdr (sheprd-automate). Lis ~/.claude/WORKFLOW.md (section Loops) et la skill concernée, puis demande-moi ce que je veux (ne change rien avant).", // i18n: agent
  "Règles :", // i18n: agent
  "- un loop se crée par /me:create-loop (skill + commande-cale qui lit le SKILL.md) ; son eval gate est une commande shell déterministe ; jamais de continue-on-error, de test skippé ni de re-run à l'aveugle ;", // i18n: agent
  "- une automatisation Herdr se crée par la skill herdr-automations : écrire, lancer `sheprd-automate check`, me montrer le plan ; ne jamais l'approuver toi-même ;", // i18n: agent
  "- worktree gwm d'abord : un agent ne travaille jamais dans le checkout principal ;", // i18n: agent
  "- ~/.claude passe par chezmoi (`chezmoi add <chemins>`, jamais d'apply sans chemin, 0700) ; un loop de projet vit dans <repo>/.claude et part par une PR ;", // i18n: agent
  "- commit seulement quand je le demande, Gitmoji + Conventional, sans tiret cadratin.", // i18n: agent
].join("\n");

// The loops that read the PR of their branch: they run in that PR's worktree, never elsewhere.
export const PR_LOOPS = new Set(["claude-review-pr", "codex-review-pr", "ci-until-green", "docs-sync"]);
const NAME = /^[a-z0-9][\w.-]*$/i;

export const trimSlash = (p) => String(p ?? "").replace(/\/+$/, "") || "/";
/** `p` is `root` or inside it. */
export const within = (p, root) => Boolean(p && root) && (trimSlash(p) === trimSlash(root) || trimSlash(p).startsWith(trimSlash(root) + "/"));
export const tilde = (p, home) => (p && home && (p === home || p.startsWith(home + "/")) ? `~${p.slice(home.length)}` : p ?? "");

// ---------- the scan ----------

/** The scan's lines sorted out: "mtime\tpath" (stat), "DIR\tpath" (a folder to watch), "BIN\tpath"
 *  (sheprd-automate), "SHEPRD\tpath" (sheprd, its approval dialog). The loops (global under
 *  `home`/.claude, the project's under `project`/.claude), their cales by loop name, the automation
 *  scripts (a repo's .herdr/automations, or the personal ~/.config/herdr-automate). */
export function classify(lines, { home, project }) {
  const C = `${home}/.claude`;
  const P = project ? `${trimSlash(project)}/.claude` : null;
  const out = { loops: [], cales: {}, scripts: [], bin: null, sheprd: null, dirs: [], mtimes: {} };
  for (const line of String(lines ?? "").split("\n")) {
    const [a, path] = line.split("\t");
    if (!path) continue;
    if (a === "BIN") { out.bin = path.trim(); continue; }
    if (a === "SHEPRD") { out.sheprd = path.trim(); continue; }
    if (a === "DIR") { out.dirs.push(path.trim()); continue; }
    if (!/^\d+$/.test(a)) continue;
    out.mtimes[path] = Number(a);
    let m;
    for (const [base, scope] of [[C, "global"], [P, "projet"]]) {
      if (!base || !path.startsWith(base + "/")) continue;
      const rel = path.slice(base.length + 1);
      if ((m = /^skills\/me\/loop\/([^/]+)\/SKILL\.md$/.exec(rel)) && NAME.test(m[1]) && !m[1].startsWith("_"))
        out.loops.push({ name: m[1], path, scope, repo: scope === "projet" ? trimSlash(project) : null });
      else if ((m = /^commands\/me\/loop\/([^/]+)\.md$/.exec(rel))) (out.cales[m[1]] ??= []).push(path);
    }
    if (/\.luau$/.test(path)) {
      const personal = path.startsWith(`${home}/.config/herdr-automate/automations/`);
      const i = path.indexOf("/.herdr/automations/");
      if (personal || i > 0) out.scripts.push({ path, name: path.split("/").pop().replace(/\.luau$/, ""), repo: personal ? null : path.slice(0, i) });
    }
  }
  // Global first, then the project's; by name.
  out.loops.sort((x, y) => (x.scope === y.scope ? 0 : x.scope === "global" ? -1 : 1) || x.name.localeCompare(y.name));
  out.scripts.sort((x, y) => String(x.repo ?? "").localeCompare(String(y.repo ?? "")) || x.name.localeCompare(y.name));
  return out;
}

// ---------- a loop ----------

/** Markdown inline marks out: **bold**, `code`, [text](url). */
export const stripMd = (s) => String(s ?? "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\*\*|`/g, "").replace(/\s+/g, " ").trim();

/** The body of the "## " section whose title contains `needle`, up to the next "## " outside code. */
export function section(md, needle) {
  const lines = String(md ?? "").split("\n");
  let fence = null, from = -1, to = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const f = /^\s*(```|~~~)/.exec(lines[i]);
    if (f) { fence = fence ? (f[1] === fence ? null : fence) : f[1]; continue; }
    if (fence || !/^## /.test(lines[i])) continue;
    if (from < 0 && lines[i].includes(needle)) from = i + 1;
    else if (from >= 0) { to = i; break; }
  }
  return from < 0 ? null : lines.slice(from, to).join("\n");
}

/** A loop's SKILL.md: its frontmatter description, its dimensions (the intro's « **mode:** closed ·
 *  **trigger:** self-pace · **exécution:** single », wherever written) and its « ## Définition »
 *  (goal, max_iterations, exit_when, check_command or check). Missing parts are null. */
export function loopDef(md) {
  const text = String(md ?? "");
  const fm = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
  const description = /^description:\s*(.*)$/m.exec(fm)?.[1]?.trim().replace(/^(["'])([\s\S]*)\1$/, "$2") ?? null;
  const dim = (k) => new RegExp(`\\*\\*${k}:?\\*\\*:?\\s*\`?([\\w-]+)`, "i").exec(text)?.[1] ?? null;
  const body = section(text, "Définition"); // i18n: tech (the loop file's heading)
  const d = {};
  for (const l of String(body ?? "").split("\n")) {
    const m = /^- \*\*([\w-]+)\*\*\s*(?:\([^)]*\))?\s*:\s*(.*)$/.exec(l.trim());
    if (m && !(m[1] in d)) d[m[1]] = m[2].trim();
  }
  // A check written as a fenced script under the Définition ("ci-dessous"): its language and length,
  // said by main.js.
  const fence = /^\s*(```|~~~)(\w*)\s*\n([\s\S]*?)^\s*\1/m.exec(String(body ?? ""));
  const script = fence ? { lang: fence[2] || "shell", n: fence[3].trimEnd().split("\n").length } : null;
  const check = d.check_command ?? d.check ?? null;
  return {
    description,
    mode: dim("mode"), trigger: dim("trigger"), exec: dim("(?:exécution|execution)"),
    defined: body != null,
    goal: d.goal ? stripMd(d.goal) : null,
    max: d.max_iterations ? stripMd(d.max_iterations) : null,
    exit: d.exit_when ? stripMd(d.exit_when) : null,
    check: check ? stripMd(check) : null,
    script: check ? script : null,
  };
}

/** A command file is the cale of the loop `name`: it reads its SKILL.md and never says to invoke the
 *  skill (which loops back on the cale: CLAUDE.md, « Commandes »). */
export function isCale(text, name) {
  const t = String(text ?? "");
  return t.includes(`skills/me/loop/${name}/SKILL.md`) && !/invoque[rz]? la skill|invoke the `?[\w:.-]+`? skill/i.test(t);
}

// ---------- loops running now ----------

/** The loops running now, from live data: an agent whose thread is named `loop:<name>` (how this page
 *  launches them), or a terminal labelled `loop=<name>` (hc run --label role=loop --label loop=<name>).
 *  Each: { name, address, status, cwd, space, tab, via }. */
export function running({ agents = [], panes = [], terminals = [] }) {
  const out = new Map();
  const cwdOf = (addr) => panes.find((p) => p.terminal === addr)?.cwd ?? terminals.find((t) => t.address === addr)?.cwd ?? null;
  for (const a of agents) {
    const m = /^loop:([a-z0-9][\w.-]*)$/i.exec(a.tab_name ?? "");
    if (m) out.set(a.address, { name: m[1], address: a.address, status: a.status, cwd: cwdOf(a.address), space: a.space, tab: a.tab, via: "thread" });
  }
  for (const t of terminals) {
    const name = t.labels?.loop;
    if (!name || !NAME.test(name) || out.has(t.address) || t.state === "finished") continue;
    const a = agents.find((x) => x.address === t.address);
    out.set(t.address, { name, address: t.address, status: a?.status ?? (typeof t.status === "string" ? t.status : null),
      cwd: cwdOf(t.address), space: a?.space ?? t.labels["herdr.space"] ?? null, tab: a?.tab ?? t.labels["herdr.tab"] ?? null, via: "label" });
  }
  return [...out.values()];
}

/** The last « Itération N/M » (or « itération N sur M ») on a screen: { n, m }, or null. */
export function iteration(text) {
  let last = null;
  for (const m of String(text ?? "").matchAll(/it[ée]ration\s*(\d+)\s*(?:\/|sur)\s*(\d+)/gi)) last = { n: Number(m[1]), m: Number(m[2]) };
  return last;
}

// ---------- launching a loop ----------

/** The worktrees a loop may run in: gwm's, never the main checkout (a loop is an agent at work). */
export function targets(wts, project) {
  return (wts ?? []).filter((w) => w && !w.is_main && w.path).map((w) => ({ ...w, path: trimSlash(w.path), project }));
}

/** The local space that already shows `path`: its folder, or one of its panes working inside it. */
export function spaceFor(path, spaces, panes) {
  const ids = (sp) => new Set((sp.tabs ?? []).map((x) => x.id));
  return spaces.find((sp) => !sp.machine && trimSlash(sp.folder) === path)
    ?? spaces.find((sp) => !sp.machine && panes.some((p) => p.terminal && within(p.cwd, path) && ids(sp).has(p.tab)))
    ?? null;
}

/** How the loop `name` starts in the worktree `wt` ({ path, branch, is_main }): `pr` is its PR number
 *  (gh pr view, in the worktree) or null. One of: { error, name?, where? } (refused: "name", "noWorktree",
 *  "main" or "noPr", said by main.js), { show } (the same loop already runs there: show it),
 *  { command, task, space } (the app command kt-confirm runs). */
export function launch({ name, wt, pr, spaces = [], panes = [], live = [] }) {
  if (!NAME.test(String(name ?? ""))) return { error: "name", name }; // i18n: tech
  if (!wt?.path) return { error: "noWorktree" }; // i18n: tech
  if (wt.is_main) return { error: "main" }; // i18n: tech
  const path = trimSlash(wt.path);
  const twin = live.find((r) => r.name === name && within(r.cwd, path));
  if (twin) return { show: twin };
  if (PR_LOOPS.has(name) && !pr) return { error: "noPr", where: wt.branch ?? path }; // i18n: tech
  const task = `/me:loop:${name}`;
  const space = spaceFor(path, spaces, panes);
  const tab = `loop:${name}`;
  const command = space
    ? { name: "tab.new", args: { space: space.id, name: tab, folder: path, argv: ["claude"], task } }
    : { name: "space.new", args: { folder: path, tab, argv: ["claude"], task, machine: "" } };
  return { command, task, space };
}

// ---------- automations (Luau) ----------

/** A script's summary, read from its text (sheprd-automate check's plan is the truth): its triggers
 *  { kind, spec, name }, its caps, and whether it starts agents or worktrees (they spend tokens). */
export function luau(text) {
  const src = String(text ?? "").replace(/--\[(=*)\[[\s\S]*?\]\1\]/g, "").replace(/--[^\n]*/g, "");
  const triggers = [];
  for (const m of src.matchAll(/herdr\.(at|every|cron|manual)\s*\(([\s\S]*?)\bfunction\b/g)) {
    const args = m[2];
    triggers.push({ kind: m[1], spec: /"([^"]*)"/.exec(args.replace(/name\s*=\s*"[^"]*"/, ""))?.[1] ?? null,
      name: /name\s*=\s*"([^"]*)"/.exec(args)?.[1] ?? null });
  }
  const caps = /herdr\.caps\s*\{([^}]*)\}/.exec(src)?.[1]?.replace(/\s+/g, " ").trim() ?? null;
  const has = (step) => new RegExp(`(^|[^\\w.])${step}\\s*[({"]`).test(src);
  return { triggers, caps, agent: has("agent"), worktree: has("worktree"), steps: ["pull", "run", "sh", "worktree", "agent", "notify"].filter(has) };
}

// ---------- the session's intentions (they go to Claude: in French) ----------

export const intents = {
  // i18n: agent
  createLoop: (desc, repo) => `/me:create-loop ${desc} (portée : ${repo ? `projet, ${repo}/.claude ; il part par une PR` : "globale, ~/.claude"})`,
  editLoop: (name, path) => `modifier le loop me:loop:${name} (${path})`, // i18n: agent
  // i18n: agent
  createAutomation: (desc, repo) => `créer une automatisation Herdr avec la skill herdr-automations, ${repo ? `dans ${repo}/.herdr/automations` : "personnelle, dans ~/.config/herdr-automate/automations"} : ${desc}`,
  editAutomation: (path) => `modifier l'automatisation Herdr ${path} (puis sheprd-automate check, et me montrer le plan)`, // i18n: agent
};
