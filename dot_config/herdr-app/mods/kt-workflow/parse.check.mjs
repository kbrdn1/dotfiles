// bun mods/kt-workflow/parse.check.mjs: parse.js on fixtures, then on the real files when they're here.
import { section, cells, table, stripMd, loopDef, mask, updatedOn, isCale, ago } from "./parse.js";
import { readFileSync, readdirSync, existsSync } from "fs";
import { homedir } from "os";

const eq = (a, b, what) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
};

const md = "# T\n\n## 🧰 Outils & priorités\n\n| A | B |\n|---|---|\n| `x\\|y` | **gras** *(note)* |\n| `a|b` | c |\n\nAprès.\n\n```sh\n## pas un titre\n```\n## 📌 Conventions\n- un\n";
eq(section(md, "Outils"), "| A | B |\n|---|---|\n| `x\\|y` | **gras** *(note)* |\n| `a|b` | c |\n\nAprès.\n\n```sh\n## pas un titre\n```", "section stops at the next ## outside code");
eq(section(md, "Conventions"), "- un", "last section");
eq(section(md, "Absent"), null, "no section");
eq(cells("| `a|b` | x\\|y | z |"), ["`a|b`", "x|y", "z"], "cells");
eq(table(section(md, "Outils")), { head: ["A", "B"], rows: [["`x|y`", "**gras** *(note)*"], ["`a|b`", "c"]] }, "table");
eq(stripMd("**gras** *(déprécié : x)* ~~`watch-ci`~~ [lien](http://a) _em_"), "gras (déprécié : x) watch-ci lien em", "stripMd");

const loop = "## Définition\n\n- **goal** : tout **vert**.\n- **max_iterations** : 6\n- **exit_when** : `X=0`.\n- **check_command** (eval gate) : ci-dessous.\n\n## Suite\n- **goal** : autre\n";
eq(loopDef(loop), { goal: "tout vert.", max: "6", exit: "X=0.", check: "shell" }, "loopDef shell");
eq(loopDef("## Définition\n- **check** : deux agents Claude en parallèle\n").check, "agents", "loopDef agents");
eq(loopDef("## Définition\n- **check_command** : par projet. Exemple\n").check, "par projet", "loopDef per project");
eq(loopDef("# rien"), null, "no Définition");

eq(mask("Read(**/*secret*)"), "Read(**/*secret*)", "a deny rule is not a secret");
eq(mask("curl -H 'Authorization: Bearer abc.def'"), "curl -H 'Authorization: ••••••'", "authorization header");
eq(mask("GITHUB_TOKEN=ghp_abcdefghijklmnop123 run"), "GITHUB_TOKEN=•••••• run", "env assignment");
eq(mask("key sk-ant-api03-abcdefghij"), "key sk-ant-••••••", "anthropic key");
eq(mask("x Bearer tok123"), "x Bearer ••••••", "bearer");
eq(mask("/Users/kbrdn1/.claude/scripts/worktree-gwm.sh"), "/Users/kbrdn1/.claude/scripts/worktree-gwm.sh", "a path stays");
eq(mask("id 3f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a"), "id ••••••", "a long hex run");
eq(mask("$GITHUB_TOKEN"), "$GITHUB_TOKEN", "a reference is not a value");

eq(updatedOn("> Dernière mise à jour : 2026-11-18."), "2026-11-18", "updatedOn");
eq(isCale("Lis `~/.claude/skills/me/goal/SKILL.md` avec Read", "skills/me/goal/SKILL.md"), true, "a cale");
eq(isCale("Invoke the `spec-git-flow-worktree` skill", "skills/me/x/SKILL.md"), false, "not a cale");
eq(ago(1000, 1000 + 5 * 60e3), "il y a 5 min", "ago");

// The real files, when this machine has them.
const C = `${homedir()}/.claude`;
if (existsSync(`${C}/WORKFLOW.md`)) {
  const w = readFileSync(`${C}/WORKFLOW.md`, "utf8");
  const tools = table(section(w, "Outils & priorités"));
  if (!tools || tools.head.length !== 4 || tools.rows.length < 5) throw new Error(`WORKFLOW.md tools: ${JSON.stringify(tools)?.slice(0, 200)}`);
  for (const r of tools.rows) if (r.length !== 4) throw new Error(`a tools row has ${r.length} cells: ${r[0]}`);
  if (!section(w, "Conventions") || !section(w, "Idées")) throw new Error("WORKFLOW.md: Conventions or Idées missing");
  for (const x of readdirSync(`${C}/skills/me/loop`).filter((x) => !x.startsWith("_"))) {
    const f = `${C}/skills/me/loop/${x}/SKILL.md`;
    if (!existsSync(f)) continue;
    const d = loopDef(readFileSync(f, "utf8"));
    if (!d?.goal || !d.max || !d.exit || !d.check) throw new Error(`loop ${x}: ${JSON.stringify(d)}`);
  }
  console.log(`real files: ${tools.rows.length} tool rows, loops parsed`);
}
console.log("parse.js ok");
