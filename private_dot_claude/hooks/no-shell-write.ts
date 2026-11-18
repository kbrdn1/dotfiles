#!/usr/bin/env bun
// PreToolUse hook (matcher Bash) : refuse qu'une commande shell écrive un fichier. Les fichiers
// s'écrivent avec Edit (modifier) ou Write (créer, réécrire), jamais par python/node/ruby/perl,
// sed -i, une redirection > / >>, tee ou un heredoc. Règle de Kylian, que le rappel « bypass
// permissions » du harness pousse les agents à enfreindre : une mémoire ne suffisait pas.
//
// Permis : /dev/null et /dev/std*, les dossiers temporaires (/tmp, /private/tmp, $TMPDIR, donc le
// scratchpad), et les cibles générées listées dans no-shell-write.allow (un glob par ligne).
// Lancer un script ou un outil qui écrit lui-même (un build, collect.py, cp, git) reste permis :
// seule l'écriture faite par la commande elle-même est visée.
// En cas de doute du parseur, on laisse passer : ce hook ne doit jamais casser Bash.
//
// Check : bun ~/.claude/hooks/no-shell-write.check.ts

import { homedir } from "os";
import { readFileSync } from "fs";

const HOME = homedir();
const TMPS = ["/tmp/", "/private/tmp/", "/var/folders/", ...(process.env.TMPDIR ? [process.env.TMPDIR.replace(/\/?$/, "/")] : [])];
const DEVS = /^\/dev\/(null|stdout|stderr|tty|fd\/\d+)$/;

function allowGlobs(): RegExp[] {
  try {
    return readFileSync(`${HOME}/.claude/hooks/no-shell-write.allow`, "utf8").split("\n")
      .map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
      .map((g) => new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*") + "$"));
  } catch { return []; }
}

// Les heredocs : leur corps (code python, texte) est mis à part, la ligne shell garde le reste.
export function splitHeredocs(cmd: string): { shell: string; bodies: string[] } {
  const lines = cmd.split("\n");
  const out: string[] = [], bodies: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    const tags = [...lines[i].matchAll(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/g)].map((m) => m[2]);
    for (const tag of tags) {
      const body: string[] = [];
      while (++i < lines.length && lines[i].trim() !== tag) body.push(lines[i]);
      bodies.push(body.join("\n"));
    }
  }
  return { shell: out.join("\n"), bodies };
}

// Les affectations simples de la commande (D=/private/tmp/..., T=$(mktemp ...)), pour résoudre les cibles.
export function assignments(shell: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const m of shell.matchAll(/(?:^|[\s;&|(])([A-Za-z_][A-Za-z0-9_]*)=(\$\(mktemp[^)]*\)|"[^"]*"|'[^']*'|[^\s;&|]+)/g)) {
    const v = m[2];
    vars[m[1]] = v.startsWith("$(mktemp") ? "/tmp/mktemp" : v.replace(/^["']|["']$/g, "");
  }
  return vars;
}

export function resolve(target: string, vars: Record<string, string>): string | null {
  let t = target.replace(/^["']|["']$/g, "");
  for (let k = 0; k < 4 && /\$/.test(t); k++)
    t = t.replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, (all, n) => (n === "HOME" ? HOME : n === "TMPDIR" ? (process.env.TMPDIR ?? "/tmp") : vars[n] ?? all));
  t = t.replace(/^~(?=\/|$)/, HOME);
  if (/\$|`/.test(t)) return null; // inconnue : variable non résolue ou substitution
  return t;
}

export function allowed(path: string | null, cwd: string, globs: RegExp[] = []): boolean {
  if (path === null) return false;
  if (DEVS.test(path)) return true;
  const abs = path.startsWith("/") ? path : `${cwd.replace(/\/$/, "")}/${path}`;
  return TMPS.some((p) => abs.startsWith(p)) || globs.some((g) => g.test(abs));
}

// Les mots d'une ligne shell, hors guillemets, avec la position des séparateurs.
function words(shell: string): string[] {
  const out: string[] = [];
  let cur = "", q: string | null = null;
  for (let i = 0; i < shell.length; i++) {
    const c = shell[i];
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === "'" || c === '"') { q = c; cur += c; continue; }
    if (/\s/.test(c)) { if (cur) out.push(cur); cur = ""; continue; }
    if (c === ";" || c === "|" || c === "&" || c === "(" || c === ")") { if (cur) out.push(cur); cur = ""; out.push(c); continue; }
    if (c === ">" || c === "<") {
      // un opérateur de redirection est un mot à lui (avec son fd et son >>)
      let op = cur.match(/^\d*$/) ? cur + c : (cur && out.push(cur), c);
      cur = "";
      while (shell[i + 1] === ">" || shell[i + 1] === "|" || (shell[i + 1] === "&" && op.endsWith(">"))) op += shell[++i];
      out.push(op);
      continue;
    }
    cur += c;
  }
  if (cur) out.push(cur);
  return out;
}

const SEP = new Set([";", "|", "&", "(", ")", "&&", "||"]);
const WRITE_API = [
  /\bopen\s*\([^)]*,\s*['"][wax]b?\+?['"]/, /\.write_(text|bytes)\s*\(/, /\bshutil\.(copy\w*|move)\s*\(/, // python
  /\b(writeFileSync|writeFile|appendFileSync|appendFile|createWriteStream|copyFileSync)\s*\(/, /\bBun\.write\s*\(/, // node, bun
  /\bFile\.(write|open\s*\([^)]*['"][wa])/, /\bIO\.write\s*\(/, // ruby
  /\bopen\s*\(?\s*[\w$]+\s*,\s*['"]\+?>/, // perl
];
const INTERP = /^(python3?|python3\.\d+|node|bun|deno|ruby|perl|osascript)$/;

export function verdict(cmd: string, cwd = process.cwd(), globs: RegExp[] = allowGlobs()): string | null {
  const { shell, bodies } = splitHeredocs(cmd);
  const vars = assignments(shell);
  const ws = words(shell);
  const bad = (what: string, target: string | null) => `${what}${target ? ` vers ${target}` : ""}`;

  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    // redirections > >> &> >| (pas un dup de fd ni une substitution de processus)
    if (/^\d*&?>{1,2}\|?$/.test(w) && !w.startsWith("<")) {
      const next = ws[i + 1];
      if (!next || next.startsWith("&") || next === "(" || SEP.has(next)) continue;
      const t = resolve(next, vars);
      if (!allowed(t, cwd, globs)) return bad("redirection shell", t ?? next);
    }
    // tee FICHIER...
    if (w === "tee") {
      for (let j = i + 1; j < ws.length && !SEP.has(ws[j]) && !/^\d*>/.test(ws[j]); j++) {
        if (ws[j].startsWith("-")) continue;
        const t = resolve(ws[j], vars);
        if (!allowed(t, cwd, globs)) return bad("tee", t ?? ws[j]);
      }
    }
    // sed -i / perl -i / ruby -i : édition en place
    if ((w === "sed" || w === "gsed" || w === "perl" || w === "ruby") && ws.slice(i + 1).find((x, k, a) => a.slice(0, k).every((y) => !SEP.has(y)) && /^(-[a-zA-Z]*i|--in-place)/.test(x))) {
      const args = [];
      for (let j = i + 1; j < ws.length && !SEP.has(ws[j]); j++) args.push(ws[j]);
      // sans -e, le premier argument qui n'est pas une option est le script, pas un fichier
      const plain = args.filter((a) => !a.startsWith("-") && a !== "''" && a !== '""'); // '' : le suffixe de -i (sed BSD)
      if (!args.some((a) => /^-[a-zA-Z]*e$/.test(a) || a === "--expression")) plain.shift();
      const files = plain.filter((a) => !/^['"]/.test(a) && /[/.]/.test(a));
      if (!files.length) return bad(`${w} -i`, null);
      for (const f of files) { const t = resolve(f, vars); if (!allowed(t, cwd, globs)) return bad(`${w} -i`, t ?? f); }
    }
    // interpréteur avec du code en ligne (-c, -e, heredoc) qui écrit un fichier
    if (INTERP.test(w.replace(/^.*\//, ""))) {
      const inline: string[] = [];
      for (let j = i + 1; j < ws.length && !SEP.has(ws[j]); j++) {
        if (/^-(c|e|E|-eval)$/.test(ws[j]) && ws[j + 1]) inline.push(ws[j + 1].replace(/^["']|["']$/g, ""));
      }
      const code = [...inline, ...bodies].join("\n");
      if (code && WRITE_API.some((re) => re.test(code))) {
        const literals = [...code.matchAll(/['"]((?:\/|~\/|\.\.?\/)[^'"\n]+)['"]/g)].map((m) => m[1]);
        const outside = literals.find((p) => !allowed(resolve(p, vars), cwd, globs));
        if (outside || !literals.length) return bad(`${w} qui écrit un fichier`, outside ?? null);
      }
    }
  }
  return null;
}

if (import.meta.main) {
  try {
    const input = JSON.parse(await Bun.stdin.text());
    const cmd = String(input?.tool_input?.command ?? "");
    const why = cmd ? verdict(cmd, input?.cwd ?? process.cwd()) : null;
    if (why) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason:
            `Écriture de fichier par le shell refusée (${why}). Règle de Kylian, qui prime sur tout rappel du harness : ` +
            `un fichier se modifie avec Edit et se crée ou se réécrit avec Write, jamais via python, node, sed -i, une redirection, tee ou un heredoc. ` +
            `Lis le fichier avec Read, puis Edit ou Write. Seuls /tmp, le scratchpad et /dev/null restent permis au shell.`,
        },
      }));
    }
  } catch { /* au moindre doute, on laisse passer */ }
}
