// kt-skills' ways to add a skill (form.js draws them): with the assistant (a new thread running
// /me:skill-create), an empty skeleton (SKILL.md with a minimal frontmatter, then Zed), from a
// folder (a link, by default, or a copy into ~/.claude/skills), from GitHub (cloned --depth 1 into
// ~/.agents/skills/<name>, linked at the first level of ~/.claude/skills: Claude Code doesn't load a
// skill from a sub-folder there), from a plugin (the Plugins page). Every path is checked before the
// confirmation (a name taken, no SKILL.md); values go to the programs as argv.

import { exec, readTextFile, writeTextFile, home, run, spaces, layout, notify } from "herdr";
import { frontmatter } from "./frontmatter.js";
import { githubSource } from "./github.js";
import { tilde } from "./form.js";
import { bump } from "./bus.js";

const T = (name) => `mods/kt-threads/${name}.svg`;
const NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const badName = (n) => (!NAME.test(n) || n.includes("..") ? "Nom : lettres, chiffres, . _ -, sans espace ni /, 64 au plus." : null);
const shq = (s) => (/^[\w@%+=:,./~-]+$/.test(s) ? s : `'${String(s).replace(/'/g, "'\\''")}'`);
const sh = (cmd, args, o = {}) => exec(cmd, args, { timeout: 30e3, ...o }).catch((e) => ({ code: -1, stdout: "", stderr: String(e?.message ?? e) }));
// Something there (a file, a folder, a link, even a broken one)?
const taken = async (p) => (await sh("sh", ["-c", '[ -e "$1" ] || [ -L "$1" ]', "sh", p])).code === 0;
const lastLine = (s) => String(s ?? "").trim().split("\n").filter(Boolean).pop() ?? "";
const fmt = (v) => (Array.isArray(v) ? v.join(", ") : v && typeof v === "object" ? Object.entries(v).map(([k, s]) => `${k}: ${s}`).join(" · ") : String(v ?? ""));
// A SKILL.md's frontmatter, for the confirmation (third-party code is read before it's added).
const preview = (text) => {
  const { meta, body } = frontmatter(text);
  const keys = Object.entries(meta).map(([k, v]) => `${k}: ${fmt(v)}`);
  return (keys.length ? keys : ["(pas de frontmatter)"]).concat("", ...body.trim().split("\n").slice(0, 4)).join("\n");
};
// A YAML scalar in double quotes.
const yq = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
const skillsDir = () => `${home()}/.claude/skills`;
// The bus (DATA-SYNC.md): every Skills copy (and kt-keys' help) reads again, shown or not.
const refresh = () => bump("skills");

function scopes(ctx) {
  const all = [["personal", "personnel · ~/.claude/skills"], ["project", "projet · .claude/skills"]];
  return { id: "scope", label: "Portée", kind: "choice", value: "personal", choices: ctx.root ? all : all.slice(0, 1),
    help: ctx.root ? `projet : ${tilde(ctx.root)}` : "pas de projet affiché : personnel seulement" };
}

export const METHODS = [
  {
    id: "assistant", label: "Avec l'assistant", hint: "Un thread qui le conçoit avec toi : /me:skill-create", icon: T("sparkles"), badge: "recommandé",
    title: "Créer un skill avec l'assistant",
    intro: "Un nouveau thread dans le projet affiché lance claude sur /me:skill-create, avec ta description : il pose ses questions, puis écrit le skill.",
    fields: [{ id: "desc", label: "Le skill", kind: "text", placeholder: "ce qu'il fait, quand il doit se déclencher" }],
    async plan(v, ctx) {
      const desc = v.desc.trim().replace(/\s+/g, " ");
      if (!desc) return { error: "Décris le skill à créer." };
      const s = spaces().find((x) => x.id === ctx.space) ?? spaces().find((x) => x.active);
      if (!s) return { error: "Aucun espace où ouvrir le thread." };
      const task = `/me:skill-create ${desc}`;
      return { shown: `claude\n# sa première tâche :\n${task}`, cwd: s.folder || home(), label: "Lancer",
        note: `Un nouveau thread dans ${s.name}. Rien n'est écrit avant que l'assistant ne le fasse, avec toi.`,
        run: async () => {
          run("tab.new", { space: s.id, argv: ["claude"], task });
          run("layout.select", { stack: "view", child: "thread" });
          return { level: "success", title: "Thread lancé", body: task };
        } };
    },
  },
  {
    id: "empty", label: "Squelette vide", hint: "Un SKILL.md minimal, ouvert dans Zed", icon: T("square-pen"),
    title: "Créer un squelette de skill",
    intro: "Un dossier et son SKILL.md, avec le frontmatter minimal que Claude Code lit (name, description). Tu l'écris ensuite dans Zed.",
    fields: (ctx) => [
      { id: "name", label: "Nom", kind: "text", placeholder: "mon-skill", help: "le dossier, et /mon-skill" },
      { id: "desc", label: "Description", kind: "text", placeholder: "Ce qu'il fait. À utiliser quand…", help: "c'est elle qui le déclenche" },
      scopes(ctx)],
    async plan(v, ctx) {
      const name = v.name.trim();
      const desc = v.desc.trim().replace(/\s+/g, " ");
      const bad = badName(name) ?? (!desc ? "Il faut une description : Claude Code s'en sert pour le déclencher." : null);
      if (bad) return { error: bad };
      const dir = `${v.scope === "project" && ctx.root ? `${ctx.root}/.claude/skills` : skillsDir()}/${name}`;
      if (await taken(dir)) return { error: `Ce nom est déjà pris : ${tilde(dir)}.` };
      const file = `${dir}/SKILL.md`;
      const text = `---\nname: ${name}\ndescription: ${yq(desc)}\n---\n\n# ${name}\n\n${desc}\n`;
      return { shown: `mkdir -p ${shq(tilde(dir))}\n# puis écrit ${tilde(file)} :\n${text}\nzed ${shq(tilde(file))}`, label: "Créer",
        run: async () => {
          const m = await sh("mkdir", ["-p", dir]);
          if (m.code !== 0) return { level: "error", title: "Dossier non créé", body: lastLine(m.stderr) };
          try { await writeTextFile(file, text, null); }
          catch (e) { return { level: "error", title: "SKILL.md non écrit", body: String(e?.message ?? e) }; }
          exec("zed", [file]).catch(() => exec("open", [`zed://file${file}`]).catch(() => {}));
          refresh();
          return { level: "success", title: `${name} créé`, body: tilde(file) };
        } };
    },
  },
  {
    id: "folder", label: "Depuis un dossier", hint: "Un dossier qui a un SKILL.md : lié ou copié", icon: T("folder"),
    title: "Ajouter un skill depuis un dossier",
    intro: "Le dossier doit avoir un SKILL.md. Un lien (par défaut) le garde où il est, ~/.agents/skills par exemple ; une copie le fige dans ~/.claude/skills.",
    fields: [
      { id: "dir", label: "Dossier", kind: "folder", mono: true, placeholder: "~/.agents/skills/mon-skill" },
      { id: "name", label: "Nom", kind: "text", placeholder: "le nom du dossier", help: "facultatif" },
      { id: "mode", label: "Comment", kind: "choice", value: "link", choices: [["link", "Lien symbolique"], ["copy", "Copie"]] }],
    async plan(v) {
      let dir = v.dir.trim().replace(/\/+$/, "");
      if (dir.startsWith("~/")) dir = home() + dir.slice(1);
      if (!dir.startsWith("/")) return { error: "Un chemin absolu, ou en ~/ : le bouton Choisir… en donne un." };
      const text = await readTextFile(`${dir}/SKILL.md`).catch(() => null);
      if (text == null) return { error: `Pas de SKILL.md dans ${tilde(dir)}.` };
      const name = v.name.trim() || dir.split("/").pop();
      const bad = badName(name);
      if (bad) return { error: bad };
      const target = `${skillsDir()}/${name}`;
      if (target === dir || dir.startsWith(target + "/")) return { error: "Ce dossier est déjà dans ~/.claude/skills." };
      if (await taken(target)) return { error: `Ce nom est déjà pris : ${tilde(target)}.` };
      const args = v.mode === "copy" ? ["cp", "-R", dir, target] : ["ln", "-s", dir, target];
      return { shown: args.map((a, i) => (i ? shq(tilde(a)) : a)).join(" "), preview: preview(text), previewLabel: "SKILL.md · frontmatter", label: "Ajouter",
        run: async () => {
          await sh("mkdir", ["-p", skillsDir()]);
          const r = await sh(args[0], args.slice(1));
          if (r.code !== 0) return { level: "error", title: `${name} non ajouté`, body: lastLine(r.stderr) };
          refresh();
          return { level: "success", title: `${name} ajouté`, body: v.mode === "copy" ? `copié dans ${tilde(target)}` : `${tilde(target)} → ${tilde(dir)}` };
        } };
    },
  },
  {
    id: "github", label: "Depuis GitHub", hint: "owner/repo[/chemin] : cloné, puis lié", icon: "mods/kt-skills/github.svg",
    title: "Ajouter un skill depuis GitHub",
    intro: "git clone --depth 1 dans ~/.agents/skills/<nom>, puis un lien au premier niveau de ~/.claude/skills. Le dépôt est d'abord cloné à part, pour lire son SKILL.md avant de valider.",
    fields: [
      { id: "src", label: "Source", kind: "text", mono: true, placeholder: "owner/repo/chemin, ou https://github.com/…", help: "le dossier qui a le SKILL.md" },
      { id: "name", label: "Nom", kind: "text", placeholder: "le dernier dossier du chemin", help: "facultatif" }],
    async plan(v) {
      const src = githubSource(v.src);
      if (src.error) return { error: src.error };
      const name = v.name.trim() || src.path.split("/").pop() || src.repo;
      const bad = badName(name);
      if (bad) return { error: bad };
      const dest = `${home()}/.agents/skills/${name}`;
      const link = `${skillsDir()}/${name}`;
      if (await taken(dest)) return { error: `Ce nom est déjà pris : ${tilde(dest)}.` };
      if (await taken(link)) return { error: `Ce nom est déjà pris : ${tilde(link)}.` };
      // A temporary clone, on the same disk as ~ ($TMPDIR): read before anything is added.
      const mk = await sh("sh", ["-c", 'mktemp -d "${TMPDIR:-/tmp}/kt-skill.XXXXXX"']);
      const tmp = mk.code === 0 ? mk.stdout.trim().replace(/\/+$/, "") : "";
      if (!/\/kt-skill\.[A-Za-z0-9]+$/.test(tmp)) return { error: "Dossier temporaire non créé." };
      const cancel = () => sh("rm", ["-rf", tmp]);
      const clone = ["git", "clone", "--depth", "1", ...(src.ref ? ["--branch", src.ref] : []), src.url];
      const c = await sh(clone[0], [...clone.slice(1), `${tmp}/repo`], { timeout: 180e3 });
      if (c.code !== 0) { await cancel(); return { error: `git clone a échoué : ${lastLine(c.stderr)}` }; }
      const inner = src.path ? `${tmp}/repo/${src.path}` : `${tmp}/repo`;
      // The folder, links resolved, must still be inside the clone.
      const real = await sh("sh", ["-c", 'cd "$1" 2>/dev/null && pwd -P', "sh", inner]);
      const top = await sh("sh", ["-c", 'cd "$1" && pwd -P', "sh", `${tmp}/repo`]);
      const text = real.code === 0 && real.stdout.trim().startsWith(top.stdout.trim()) ? await readTextFile(`${inner}/SKILL.md`).catch(() => null) : null;
      if (text == null) { await cancel(); return { error: `Pas de SKILL.md dans ${src.owner}/${src.repo}${src.path ? `/${src.path}` : ""}.` }; }
      const target = src.path ? `${dest}/${src.path}` : dest;
      return {
        shown: [`# déjà fait, pour lire son SKILL.md :`, `${clone.join(" ")} ${shq(tilde(tmp))}/repo`, `# à la confirmation :`,
          `mkdir -p ~/.agents/skills`, `mv ${shq(tilde(tmp))}/repo ${shq(tilde(dest))}`, `ln -s ${shq(tilde(target))} ${shq(tilde(link))}`].join("\n"),
        preview: preview(text), previewLabel: `${src.owner}/${src.repo}${src.path ? `/${src.path}` : ""}/SKILL.md · frontmatter`, label: "Ajouter",
        note: "Code tiers : un skill guide l'agent et peut lui faire lancer des commandes. Lis-le avant de l'ajouter. Annuler supprime le clone temporaire.",
        cancel,
        run: async () => {
          await sh("mkdir", ["-p", `${home()}/.agents/skills`, skillsDir()]);
          const mv = await sh("mv", [`${tmp}/repo`, dest]);
          if (mv.code !== 0) { await cancel(); return { level: "error", title: `${name} non ajouté`, body: lastLine(mv.stderr) }; }
          await cancel();
          const ln = await sh("ln", ["-s", target, link]);
          if (ln.code !== 0) return { level: "error", title: `${name} cloné, lien non créé`, body: `${tilde(dest)} : ${lastLine(ln.stderr)}` };
          refresh();
          return { level: "success", title: `${name} ajouté`, body: `${tilde(link)} → ${tilde(target)}` };
        },
      };
    },
  },
  {
    id: "plugin", label: "Depuis un plugin", hint: "Les skills d'un plugin : la page Plugins", icon: T("puzzle"),
    direct() {
      const find = (n, id) => (n?.id === id ? n : (n?.children ?? []).map((c) => find(c, id)).find(Boolean) ?? null);
      if (find(layout(), "plugins")) run("layout.select", { stack: "view", child: "plugins" });
      else notify({ title: "Pas de page Plugins", body: "Elle n'est pas encore dans ce layout : claude plugin install, ou /plugin dans une session.", level: "info", timeout: 6000 });
    },
  },
];
