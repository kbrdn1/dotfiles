#!/usr/bin/env bun
/**
 * zed-tokens : coloration syntaxique au thème Zed actif, par le moteur tree-sitter de @pierre/highlights (celui
 * des diffs de me:report). Pour les vues diff de Herdr : l'API GPUI des mods ne colore que via un Editor complet,
 * sans fonds de ligne ni spans ; ici on sort des runs colorés que le mod dessine lui-même, sous ses fonds +/−.
 *
 * Usage (bun installe @pierre/highlights au premier appel, pas de node_modules) :
 *   bun ~/.claude/scripts/zed-tokens.ts --mode dark --file /abs/src/a.rs
 *   bun ~/.claude/scripts/zed-tokens.ts --mode light --cwd <repo> --rev HEAD --path src/a.rs
 *   echo '{"mode":"dark","cwd":"<repo>","items":[{"id":"new","rev":"HEAD","path":"src/a.rs"},
 *          {"id":"old","rev":"<base>","path":"src/a.rs"}]}' | bun ~/.claude/scripts/zed-tokens.ts --batch
 *   un item peut aussi porter "file" (chemin absolu, côté working tree) ou "text" (contenu, ex. API GitHub),
 *   et "lang" pour forcer la langue.
 *
 * Sortie JSON sur stdout :
 *   { "theme": { "name", "label", "appearance", "fg", "bg" },
 *     "files": { "<id>": { "lang": "rust", "lines": [ [ ["fn ", "#C79BFF", 0], … ], … ] } } }
 * lines[i] = ligne i+1 du fichier ; un run = [texte, couleur, style] avec style 1 italique, 2 gras (somme).
 * lines = null : binaire, au-delà de MAX_BYTES, ou introuvable (champ "error"). Langue inconnue : "text", une
 * couleur. Toujours colorer le fichier ENTIER (avant et après) puis prendre les lignes du hunk par leur numéro :
 * une ligne seule n'a pas son contexte (chaîne ou commentaire ouvert plus haut).
 */
import { codeToTokens, isSupportedLanguage } from "@pierre/highlights@0.3.0";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";

const MAX_BYTES = 2_000_000;
const BUILTIN: Record<string, string> = { "One Dark": "one-dark-pro", "One Light": "one-light" }; // intégrés à Zed, absents du disque
const FILENAMES: Record<string, string> = { dockerfile: "dockerfile", makefile: "make", gnumakefile: "make", ".zshrc": "zsh", ".bashrc": "bash" };

// JSON avec commentaires et virgules finales (réglages Zed), sans toucher aux chaînes
function jsonc(text: string): any {
  let out = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { out += c; if (c === "\\") { out += text[++i] ?? ""; continue; } if (c === '"') q = false; }
    else if (c === '"') { q = true; out += c; }
    else if (text.startsWith("//", i)) { const j = text.indexOf("\n", i); i = j < 0 ? text.length : j - 1; }
    else if (text.startsWith("/*", i)) { const j = text.indexOf("*/", i); i = j < 0 ? text.length : j + 1; }
    else out += c;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

async function resolveTheme(mode: "dark" | "light") {
  let name: string | undefined;
  try {
    const st = jsonc(readFileSync(join(homedir(), ".config/zed/settings.json"), "utf8")).theme;
    name = typeof st === "string" ? st : st?.[mode];
  } catch {}
  const dirs = [join(homedir(), ".config/zed/themes")];
  const ext = join(homedir(), "Library/Application Support/Zed/extensions/installed");
  if (existsSync(ext)) for (const d of readdirSync(ext)) dirs.push(join(ext, d, "themes"));
  for (const dir of dirs) {
    if (!name || !existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      try {
        const t = (JSON.parse(readFileSync(join(dir, f), "utf8")).themes ?? []).find((x: any) => x.name === name);
        if (t) return { theme: t, label: name, approx: false };
      } catch {}
    }
  }
  const slug = (name && BUILTIN[name]) || (mode === "light" ? "one-light" : "one-dark-pro");
  const mod: any = await import(`@pierre/highlights@0.3.0/themes/${slug}`);
  return { theme: mod.default ?? mod, label: name ?? slug, approx: !(name && BUILTIN[name]) };
}

function langOf(path: string): string {
  const b = basename(path).toLowerCase();
  if (FILENAMES[b]) return FILENAMES[b];
  const ext = b.includes(".") ? b.slice(b.lastIndexOf(".") + 1) : "";
  return ext && isSupportedLanguage(ext) ? ext : "text";
}

function read(item: any, cwd?: string): Uint8Array {
  if (typeof item.text === "string") return new TextEncoder().encode(item.text); // contenu déjà en main (API GitHub)
  if (item.file) return readFileSync(item.file);
  const r = Bun.spawnSync(["git", "-C", item.cwd ?? cwd ?? ".", "cat-file", "blob", `${item.rev ?? "HEAD"}:${item.path}`]);
  if (r.exitCode !== 0) throw new Error(new TextDecoder().decode(r.stderr).trim() || "blob introuvable");
  return r.stdout;
}

function tokenize(bytes: Uint8Array, lang: string, theme: any) {
  if (bytes.length > MAX_BYTES) return { lines: null, error: "trop gros" };
  if (bytes.subarray(0, 8000).includes(0)) return { lines: null, error: "binaire" };
  const res: any = codeToTokens(new TextDecoder().decode(bytes), { lang, theme } as any);
  const lines = res.tokens.map((line: any[]) => {
    const runs: [string, string, number][] = [];
    for (const t of line) {
      const color = t.color ?? res.fg, style = t.fontStyle ?? 0, last = runs[runs.length - 1];
      if (last && last[1] === color && last[2] === style) last[0] += t.content;
      else runs.push([t.content, color, style]);
    }
    return runs;
  });
  return { lines, fg: res.fg, bg: res.bg };
}

const argv = process.argv.slice(2), arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const req: any = argv.includes("--batch") ? JSON.parse(await Bun.stdin.text())
  : { mode: arg("mode"), cwd: arg("cwd"), items: [{ id: "file", file: arg("file"), rev: arg("rev"), path: arg("path") }] };
const mode = req.mode === "light" ? "light" : "dark";
const { theme, label, approx } = await resolveTheme(mode);
const out: any = { theme: { name: theme.name, label, approx, appearance: theme.appearance }, files: {} };
for (const item of req.items ?? []) {
  const lang = item.lang ?? langOf(item.path ?? item.file ?? "");
  try {
    const r = tokenize(read(item, req.cwd), lang, theme);
    out.files[item.id] = { lang, lines: r.lines, ...(r.error ? { error: r.error } : {}) };
    out.theme.fg ??= r.fg; out.theme.bg ??= r.bg;
  } catch (e: any) {
    out.files[item.id] = { lang, lines: null, error: String(e?.message ?? e) };
  }
}
process.stdout.write(JSON.stringify(out));
