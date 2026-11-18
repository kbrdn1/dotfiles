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
import { makeT } from "./i18n.js";
import strings from "./strings.js";

// A method's words are getters (I18N.md): form.js reads them when it draws, in the language then.
const tr = makeT(strings);
const T = (name) => `mods/kt-threads/${name}.svg`;
const NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const badName = (n) => (!NAME.test(n) || n.includes("..") ? tr("badName") : null);
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
  return (keys.length ? keys : [tr("noFrontmatter")]).concat("", ...body.trim().split("\n").slice(0, 4)).join("\n");
};
// A YAML scalar in double quotes.
const yq = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
const skillsDir = () => `${home()}/.claude/skills`;
// The bus (DATA-SYNC.md): every Skills copy (and kt-keys' help) reads again, shown or not.
const refresh = () => bump("skills");

function scopes(ctx) {
  const all = [["personal", tr("scope.personal")], ["project", tr("scope.project")]];
  return { id: "scope", label: tr("scope.label"), kind: "choice", value: "personal", choices: ctx.root ? all : all.slice(0, 1),
    help: ctx.root ? tr("scope.help", { path: tilde(ctx.root) }) : tr("scope.personalOnly") };
}

export const METHODS = [
  {
    id: "assistant", icon: T("sparkles"),
    get label() { return tr("assistant.label"); },
    get hint() { return tr("assistant.hint"); },
    get badge() { return tr("assistant.badge"); },
    get title() { return tr("assistant.title"); },
    get intro() { return tr("assistant.intro"); },
    get fields() { return [{ id: "desc", label: tr("assistant.field"), kind: "text", placeholder: tr("assistant.placeholder") }]; },
    async plan(v, ctx) {
      const desc = v.desc.trim().replace(/\s+/g, " ");
      if (!desc) return { error: tr("describe") };
      const s = spaces().find((x) => x.id === ctx.space) ?? spaces().find((x) => x.active);
      if (!s) return { error: tr("noSpace") };
      const task = `/me:skill-create ${desc}`; // i18n: agent
      return { shown: `claude\n${tr("firstTask")}\n${task}`, cwd: s.folder || home(), label: tr("launch"),
        note: tr("assistant.note", { name: s.name }),
        run: async () => {
          run("tab.new", { space: s.id, argv: ["claude"], task });
          run("layout.select", { stack: "view", child: "thread" });
          return { level: "success", title: tr("threadLaunched"), body: task };
        } };
    },
  },
  {
    id: "empty", icon: T("square-pen"),
    get label() { return tr("empty.label"); },
    get hint() { return tr("empty.hint"); },
    get title() { return tr("empty.title"); },
    get intro() { return tr("empty.intro"); },
    fields: (ctx) => [
      { id: "name", label: tr("name.label"), kind: "text", placeholder: tr("name.placeholder"), help: tr("name.help") },
      { id: "desc", label: tr("desc.label"), kind: "text", placeholder: tr("desc.placeholder"), help: tr("desc.help") },
      scopes(ctx)],
    async plan(v, ctx) {
      const name = v.name.trim();
      const desc = v.desc.trim().replace(/\s+/g, " ");
      const bad = badName(name) ?? (!desc ? tr("needDesc") : null);
      if (bad) return { error: bad };
      const dir = `${v.scope === "project" && ctx.root ? `${ctx.root}/.claude/skills` : skillsDir()}/${name}`;
      if (await taken(dir)) return { error: tr("taken", { path: tilde(dir) }) };
      const file = `${dir}/SKILL.md`;
      // i18n: tech
      const text = `---\nname: ${name}\ndescription: ${yq(desc)}\n---\n\n# ${name}\n\n${desc}\n`;
      return { shown: `mkdir -p ${shq(tilde(dir))}\n${tr("thenWrites", { path: tilde(file) })}\n${text}\nzed ${shq(tilde(file))}`, label: tr("create"),
        run: async () => {
          const m = await sh("mkdir", ["-p", dir]);
          if (m.code !== 0) return { level: "error", title: tr("noFolder"), body: lastLine(m.stderr) };
          try { await writeTextFile(file, text, null); }
          catch (e) { return { level: "error", title: tr("noWrite"), body: String(e?.message ?? e) }; }
          exec("zed", [file]).catch(() => exec("open", [`zed://file${file}`]).catch(() => {}));
          refresh();
          return { level: "success", title: tr("created", { name }), body: tilde(file) };
        } };
    },
  },
  {
    id: "folder", icon: T("folder"),
    get label() { return tr("folder.label"); },
    get hint() { return tr("folder.hint"); },
    get title() { return tr("folder.title"); },
    get intro() { return tr("folder.intro"); },
    get fields() {
      return [
        { id: "dir", label: tr("dir.label"), kind: "folder", mono: true, placeholder: tr("dir.placeholder") },
        { id: "name", label: tr("name.label"), kind: "text", placeholder: tr("folderName.placeholder"), help: tr("optional") },
        { id: "mode", label: tr("mode.label"), kind: "choice", value: "link", choices: [["link", tr("mode.link")], ["copy", tr("mode.copy")]] }];
    },
    async plan(v) {
      let dir = v.dir.trim().replace(/\/+$/, "");
      if (dir.startsWith("~/")) dir = home() + dir.slice(1);
      if (!dir.startsWith("/")) return { error: tr("absolute") };
      const text = await readTextFile(`${dir}/SKILL.md`).catch(() => null);
      if (text == null) return { error: tr("noSkillMd", { path: tilde(dir) }) };
      const name = v.name.trim() || dir.split("/").pop();
      const bad = badName(name);
      if (bad) return { error: bad };
      const target = `${skillsDir()}/${name}`;
      if (target === dir || dir.startsWith(target + "/")) return { error: tr("alreadyThere") };
      if (await taken(target)) return { error: tr("taken", { path: tilde(target) }) };
      const args = v.mode === "copy" ? ["cp", "-R", dir, target] : ["ln", "-s", dir, target];
      return { shown: args.map((a, i) => (i ? shq(tilde(a)) : a)).join(" "), preview: preview(text), previewLabel: tr("frontmatterLabel"), label: tr("add"),
        run: async () => {
          await sh("mkdir", ["-p", skillsDir()]);
          const r = await sh(args[0], args.slice(1));
          if (r.code !== 0) return { level: "error", title: tr("notAdded", { name }), body: lastLine(r.stderr) };
          refresh();
          return { level: "success", title: tr("added", { name }), body: v.mode === "copy" ? tr("copiedTo", { path: tilde(target) }) : `${tilde(target)} → ${tilde(dir)}` };
        } };
    },
  },
  {
    id: "github", icon: "mods/kt-skills/github.svg",
    get label() { return tr("github.label"); },
    get hint() { return tr("github.hint"); },
    get title() { return tr("github.title"); },
    get intro() { return tr("github.intro"); },
    get fields() {
      return [
        { id: "src", label: tr("src.label"), kind: "text", mono: true, placeholder: tr("src.placeholder"), help: tr("src.help") },
        { id: "name", label: tr("name.label"), kind: "text", placeholder: tr("githubName.placeholder"), help: tr("optional") }];
    },
    async plan(v) {
      const src = githubSource(v.src);
      if (src.error) return { error: tr(`gh.${src.error}`) };
      const name = v.name.trim() || src.path.split("/").pop() || src.repo;
      const bad = badName(name);
      if (bad) return { error: bad };
      const dest = `${home()}/.agents/skills/${name}`;
      const link = `${skillsDir()}/${name}`;
      if (await taken(dest)) return { error: tr("taken", { path: tilde(dest) }) };
      if (await taken(link)) return { error: tr("taken", { path: tilde(link) }) };
      // A temporary clone, on the same disk as ~ ($TMPDIR): read before anything is added.
      const mk = await sh("sh", ["-c", 'mktemp -d "${TMPDIR:-/tmp}/kt-skill.XXXXXX"']);
      const tmp = mk.code === 0 ? mk.stdout.trim().replace(/\/+$/, "") : "";
      if (!/\/kt-skill\.[A-Za-z0-9]+$/.test(tmp)) return { error: tr("noTmp") };
      const cancel = () => sh("rm", ["-rf", tmp]);
      const clone = ["git", "clone", "--depth", "1", ...(src.ref ? ["--branch", src.ref] : []), src.url];
      const c = await sh(clone[0], [...clone.slice(1), `${tmp}/repo`], { timeout: 180e3 });
      if (c.code !== 0) { await cancel(); return { error: tr("cloneFailed", { why: lastLine(c.stderr) }) }; }
      const inner = src.path ? `${tmp}/repo/${src.path}` : `${tmp}/repo`;
      // The folder, links resolved, must still be inside the clone.
      const real = await sh("sh", ["-c", 'cd "$1" 2>/dev/null && pwd -P', "sh", inner]);
      const top = await sh("sh", ["-c", 'cd "$1" && pwd -P', "sh", `${tmp}/repo`]);
      const text = real.code === 0 && real.stdout.trim().startsWith(top.stdout.trim()) ? await readTextFile(`${inner}/SKILL.md`).catch(() => null) : null;
      if (text == null) { await cancel(); return { error: tr("noSkillMd", { path: `${src.owner}/${src.repo}${src.path ? `/${src.path}` : ""}` }) }; }
      const target = src.path ? `${dest}/${src.path}` : dest;
      return {
        shown: [tr("alreadyDone"), `${clone.join(" ")} ${shq(tilde(tmp))}/repo`, tr("atConfirm"),
          `mkdir -p ~/.agents/skills`, `mv ${shq(tilde(tmp))}/repo ${shq(tilde(dest))}`, `ln -s ${shq(tilde(target))} ${shq(tilde(link))}`].join("\n"),
        preview: preview(text), previewLabel: `${src.owner}/${src.repo}${src.path ? `/${src.path}` : ""}/SKILL.md · frontmatter`, label: tr("add"), // i18n: tech
        note: tr("github.note"),
        cancel,
        run: async () => {
          await sh("mkdir", ["-p", `${home()}/.agents/skills`, skillsDir()]);
          const mv = await sh("mv", [`${tmp}/repo`, dest]);
          if (mv.code !== 0) { await cancel(); return { level: "error", title: tr("notAdded", { name }), body: lastLine(mv.stderr) }; }
          await cancel();
          const ln = await sh("ln", ["-s", target, link]);
          if (ln.code !== 0) return { level: "error", title: tr("clonedNoLink", { name }), body: `${tilde(dest)} : ${lastLine(ln.stderr)}` };
          refresh();
          return { level: "success", title: tr("added", { name }), body: `${tilde(link)} → ${tilde(target)}` };
        },
      };
    },
  },
  {
    id: "plugin", icon: T("puzzle"),
    get label() { return tr("plugin.label"); },
    get hint() { return tr("plugin.hint"); },
    direct() {
      const find = (n, id) => (n?.id === id ? n : (n?.children ?? []).map((c) => find(c, id)).find(Boolean) ?? null);
      if (find(layout(), "plugins")) run("layout.select", { stack: "view", child: "plugins" });
      else notify({ title: tr("noPluginsPage"), body: tr("noPluginsBody"), level: "info", timeout: 6000 });
    },
  },
];
