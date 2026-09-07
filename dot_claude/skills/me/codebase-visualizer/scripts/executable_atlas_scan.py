#!/usr/bin/env python3
"""atlas_scan.py — mesure un dépôt pour le skill me:codebase-visualizer.

Sort un JSON : LOC par module, graphe d'imports **avec provenance**
(`import` = dépendance de compilation, `design` = mention en commentaire),
stats de bandeau, méta git.

    atlas_scan.py                          # scan du repo courant → JSON
    atlas_scan.py --rev v1.7.0             # même scan à une révision passée
    atlas_scan.py --inject atlas.html      # réinjecte loc/stats dans un atlas
    atlas_scan.py --inject atlas.html --rev v1.7.0   # + locPrev (mode diff)
    atlas_scan.py --workspace ~/Projects   # un bloc par repo enfant
    atlas_scan.py --stack                  # dossier technique seul (manifestes, CI…)
    atlas_scan.py --stack-for atlas.html   # même dossier, en `const STACK = {…}`

Zéro dépendance : stdlib + git. `tokei` est utilisé s'il est là, sinon wc.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

EXT_LANG = {
    ".rs": "rust", ".ts": "ts", ".tsx": "ts", ".js": "ts", ".jsx": "ts", ".mjs": "ts",
    ".py": "python", ".go": "go", ".php": "php",
}
SKIP_DIRS = {"target", "node_modules", "vendor", "dist", "build", ".git", "__pycache__"}
# une ligne de commentaire par langage — sert à séparer import réel et mention de doc
COMMENT = {
    "rust": re.compile(r"^\s*(//|/\*|\*)"),
    "ts": re.compile(r"^\s*(//|/\*|\*)"),
    "python": re.compile(r"^\s*#"),
    "go": re.compile(r"^\s*(//|/\*|\*)"),
    "php": re.compile(r"^\s*(//|/\*|\*|#)"),
}
REF = {
    "rust": re.compile(r"crate::((?:[a-z_][a-z0-9_]*::)*[a-z_][a-z0-9_]*)"),
    "ts": re.compile(r"""(?:from|require\()\s*['"]([^'"]+)['"]"""),
    "python": re.compile(r"^\s*(?:from\s+([.\w]+)|import\s+([.\w]+))", re.M),
    "go": re.compile(r"""['"]([\w./-]+)['"]"""),
    "php": re.compile(r"^\s*use\s+([A-Z][\w\\]*(?:\\\{[^}]*\})?)", re.M),
}
# Dépendances *externes* citées par un fichier : le pendant de REF, qui lui ne
# voit que l'intérieur du dépôt. C'est ce qui relie un bloc du dessin à une
# ligne de manifeste — sans ça la liste des deps n'est qu'un `cat Cargo.toml`.
EXT_REF = {
    "rust": re.compile(r"^\s*(?:pub\s+)?use\s+([a-z_][a-z0-9_]*)::|^\s*extern\s+crate\s+(\w+)", re.M),
    "ts": re.compile(r"""(?:from|require\()\s*['"](@[\w.-]+/[\w.-]+|[a-z][\w.-]*)['"]"""),
    "python": re.compile(r"^\s*(?:from\s+([a-z_]\w*)|import\s+([a-z_]\w*))", re.M),
    "go": re.compile(r"""['"]([\w-]+\.[\w-]+[\w./-]*)['"]"""),
    # trois segments : `Laravel\Sanctum` et `Laravel\Socialite` sont deux paquets
    # que la racine confondrait, et un `Symfony\Component\HttpFoundation` en
    # demande trois. `pkg_of` raccourcit ensuite jusqu'au préfixe déclaré.
    "php": re.compile(r"^\s*use\s+(?:function\s+|const\s+)?([A-Z]\w*(?:\\[A-Z]\w*){0,2})\\", re.M),
}
RUST_STD = {"crate", "self", "super", "std", "core", "alloc", "proc_macro"}
# Les binaires que le code appelle : une dépendance de *runtime*, invisible de
# tout manifeste, et souvent la plus structurante (gwm n'édite aucun token
# parce qu'il shelle `gh`).
BIN_CALL = {
    "rust": re.compile(r'Command::new\(\s*"([^"]+)"'),
    "go": re.compile(r'exec\.Command\(\s*"([^"]+)"'),
    "php": re.compile(r"""(?:new\s+Process\(\s*\[|Process::fromShellCommandline\(|\bexec\(|\bshell_exec\(|\bproc_open\()\s*['"]([^'"\s]+)"""),
    "ts": re.compile(r"""(?:spawnSync|spawn|execSync|execFileSync|execa)\(\s*['"]([^'"\s]+)"""),
    "python": re.compile(r"""subprocess\.\w+\(\s*\[?\s*['"]([^'"\s]+)"""),
}
MANIFEST_ECO = {
    "Cargo.toml": "cargo", "composer.json": "composer", "package.json": "npm",
    "go.mod": "go", "pyproject.toml": "pip",
}


def sh(args: list[str], cwd: Path) -> str:
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True).stdout


# --------------------------------------------------------------------------- files


def list_files(root: Path, rev: str | None) -> list[str]:
    if rev:
        out = sh(["git", "ls-tree", "-r", "--name-only", rev], root)
    else:
        out = sh(["git", "ls-files"], root)
    paths = [p for p in out.splitlines() if p]
    if not paths:  # pas un dépôt git — on marche l'arbre
        paths = [
            str(p.relative_to(root))
            for p in root.rglob("*")
            if p.is_file() and not SKIP_DIRS & set(p.parts)
        ]
    return [p for p in paths if not SKIP_DIRS & set(Path(p).parts)]


def read(root: Path, path: str, rev: str | None) -> str:
    if rev:
        return sh(["git", "show", f"{rev}:{path}"], root)
    try:
        return (root / path).read_text(errors="replace")
    except OSError:
        return ""


def detect_lang(paths: list[str]) -> str:
    c = Counter(EXT_LANG[e] for p in paths if (e := Path(p).suffix) in EXT_LANG)
    return c.most_common(1)[0][0] if c else "ts"


# --------------------------------------------------------------------------- modules


def psr4_roots(root: Path, rev: str | None) -> dict[str, str]:
    """{dossier: namespace} depuis composer.json — l'équivalent PHP du nom de crate.
    Sans ça, `use App\\Models\\User` ne retrouve jamais `app/Models/User.php`."""
    try:
        c = json.loads(read(root, "composer.json", rev) or "{}")
    except json.JSONDecodeError:
        return {}
    out = {}
    for key in ("autoload", "autoload-dev"):
        for ns, paths in (c.get(key, {}).get("psr-4") or {}).items():
            for p in [paths] if isinstance(paths, str) else paths:
                out[p.strip("/")] = ns.strip("\\")
    return out


def module_name(path: str, lang: str, roots: dict[str, str] | None = None) -> str:
    """Nom canonique d'un module. `src/tui/mod.rs` → `tui`, `src/tui/ui.rs` → `tui::ui`,
    et avec PSR-4 `app/Models/User.php` → `App::Models::User`."""
    p = Path(path)
    parts = list(p.parts)
    if roots:  # PSR-4 : le namespace déclaré remplace le préfixe de dossier
        for dirp in sorted(roots, key=len, reverse=True):
            pre = Path(dirp).parts
            if tuple(parts[:len(pre)]) == pre:
                tail = parts[len(pre):]
                if not tail:
                    return roots[dirp]
                return "::".join([roots[dirp].replace("\\", "::"), *tail[:-1], Path(tail[-1]).stem])
    for root_dir in ("src", "lib", "app", "internal", "pkg"):
        if parts and parts[0] == root_dir:
            parts = parts[1:]
            break
    if not parts:
        return p.stem
    stem = Path(parts[-1]).stem
    head = parts[:-1]
    if stem in ("mod", "index", "__init__"):  # le fichier EST son dossier
        return "::".join(head) if head else stem
    return "::".join(head + [stem])


def build_index(paths: list[str], lang: str, roots: dict[str, str] | None = None) -> dict[str, str]:
    exts = {e for e, l in EXT_LANG.items() if l == lang}
    return {
        module_name(p, lang, roots): p for p in paths if Path(p).suffix in exts
    }


def crate_name(root: Path, rev: str | None) -> str:
    """Nom sous lequel le crate se référence lui-même (`use gwm::…`)."""
    section, names = "", {}
    for line in read(root, "Cargo.toml", rev).splitlines():
        s = line.strip()
        if s.startswith("[") and s.endswith("]"):
            section = s.strip("[]")
        elif (m := re.match(r'name\s*=\s*"([^"]+)"', s)) and section in ("package", "lib"):
            names.setdefault(section, m.group(1))
    return (names.get("lib") or names.get("package") or "crate").replace("-", "_")


def rust_refs(blob: str, crate: str, module: str) -> list[str]:
    """Refs Rust canoniques. Gère `crate::`, `self::`, `super::`, `<crate>::`
    et la forme groupée `use x::{a, b as c}` — sans elles le graphe rate
    l'entrée du binaire et tout l'intérieur d'un dossier de modules."""
    parent = module.rsplit("::", 1)[0] if "::" in module else ""

    def base_of(head: str, mid: str) -> str:
        root = {"self": module, "super": parent}.get(head, "")
        return "::".join(x for x in (root, mid.strip(":")) if x)

    pref = rf"(?:crate|super|self|{re.escape(crate)})"
    seg = r"(?:::[a-z_]\w*)*"
    out = []
    for m in re.finditer(rf"\b({pref})({seg})::\{{([^}}]*)\}}", blob):
        base = base_of(m.group(1), m.group(2))
        for item in m.group(3).split(","):
            item = item.strip().split(" as ")[0].strip()
            if re.match(r"^[a-z_]\w*$", item):
                out.append(f"{base}::{item}" if base else item)
    for m in re.finditer(rf"\b({pref})((?:::[a-z_]\w*)+)", blob):
        base = base_of(m.group(1), "")
        tail = m.group(2).strip(":")
        out.append(f"{base}::{tail}" if base else tail)
    return out


def resolve(ref: str, index: dict[str, str], lang: str, from_path: str) -> str | None:
    """Résout une référence vers le module le plus spécifique qui existe."""
    if lang in ("ts", "python") and ref.startswith("."):
        base = Path(from_path).parent
        cand = os.path.normpath(base / ref.lstrip(".").replace(".", "/")) if lang == "python" \
            else os.path.normpath(base / ref)
        for name, path in index.items():
            if Path(path).with_suffix("").as_posix() == Path(cand).as_posix():
                return name
        return None
    parts = ref.replace("/", "::").replace("\\", "::").replace(".", "::").split("::")
    while parts:  # préfixe le plus long d'abord — corrige la granularité du grep naïf
        cand = "::".join(parts)
        if cand in index:
            return cand
        parts.pop()
    return None


# --------------------------------------------------------------------------- stack


def toml_sections(text: str) -> dict[str, list[tuple[str, str]]]:
    """Sections TOML → [(clé, valeur brute)]. Suffit pour un manifeste : les
    tables inline des dépendances tiennent sur une ligne. Un tableau multiligne
    (`[project] dependencies`) est manqué — d'où le regex dédié pour pyproject."""
    out: dict[str, list[tuple[str, str]]] = {}
    cur = ""
    for line in text.splitlines():
        s = line.split("#")[0].strip()
        if not s:
            continue
        if s.startswith("[") and s.endswith("]"):
            cur = s.strip("[]").strip()
            out.setdefault(cur, [])
        elif "=" in s:
            k, _, v = s.partition("=")
            out.setdefault(cur, []).append((k.strip().strip('"'), v.strip()))
    return out


def dep_ver(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("{"):
        if m := re.search(r'version\s*=\s*"([^"]+)"', raw):
            return m.group(1)
        for kind in ("path", "git", "workspace"):
            if re.search(rf"\b{kind}\s*=", raw):
                return kind
        return ""
    m = re.match(r'"([^"]+)"', raw)
    return m.group(1) if m else ""


def parse_cargo(text: str) -> dict:
    sec = toml_sections(text)
    pkg = {k: v.strip('"') for k, v in sec.get("package", [])}
    deps = []
    for name, dev in (("dependencies", 0), ("workspace.dependencies", 0),
                      ("dev-dependencies", 1), ("build-dependencies", 1)):
        for k, v in sec.get(name, []):
            deps.append({"n": k, "v": dep_ver(v), "dev": dev})
    tool = {k: pkg[k] for k in ("edition", "rust-version") if k in pkg}
    bins = [v.strip('"') for k, v in sec.get("bin", []) + sec.get("lib", []) if k == "path"]
    return {"name": pkg.get("name", ""), "version": pkg.get("version", ""),
            "toolchain": tool, "deps": deps, "scripts": {}, "entry": bins}


def parse_json_manifest(text: str, eco: str) -> dict | None:
    try:
        c = json.loads(text or "{}")
    except json.JSONDecodeError:
        return None
    deps, tool, entry = [], {}, []
    keys = (("require", 0), ("require-dev", 1)) if eco == "composer" \
        else (("dependencies", 0), ("devDependencies", 1))
    for key, dev in keys:
        for k, v in (c.get(key) or {}).items():
            if k in ("php", "node"):
                tool[k] = v
            elif k.startswith("ext-"):
                tool.setdefault("php-ext", []).append(k[4:])
            else:
                deps.append({"n": k, "v": v if isinstance(v, str) else "", "dev": dev})
    for k, v in (c.get("engines") or {}).items():
        tool[k] = v
    scripts = {k: (v if isinstance(v, str) else " ; ".join(map(str, v)))
               for k, v in (c.get("scripts") or {}).items()}
    for k in ("main", "module", "bin"):
        v = c.get(k)
        if isinstance(v, str):
            entry.append(v)
        elif isinstance(v, dict):
            entry += [x for x in v.values() if isinstance(x, str)]
    return {"name": c.get("name", ""), "version": c.get("version", ""),
            "toolchain": tool, "deps": deps, "scripts": scripts, "entry": entry}


def parse_gomod(text: str) -> dict:
    deps, tool, mod, block = [], {}, "", False
    for raw in text.splitlines():
        s = raw.split("//")[0].strip()
        if s.startswith("module "):
            mod = s.split(None, 1)[1].strip()
        elif s.startswith("go ") and "go" not in tool:
            tool["go"] = s.split(None, 1)[1].strip()
        elif s.startswith("require ("):
            block = True
        elif block and s == ")":
            block = False
        elif (block or s.startswith("require ")) and "indirect" not in raw:
            if m := re.match(r"(?:require\s+)?([\w./~-]+)\s+(v[\w.+-]+)", s):
                deps.append({"n": m.group(1), "v": m.group(2), "dev": 0})
    return {"name": mod, "version": "", "toolchain": tool, "deps": deps,
            "scripts": {}, "entry": []}


def parse_pyproject(text: str) -> dict:
    sec = toml_sections(text)
    proj = {k: v.strip('"') for k, v in sec.get("project", [])}
    tool = {k: proj[k] for k in ("requires-python",) if k in proj}
    deps = []
    # `dependencies = [ … ]` s'étale sur plusieurs lignes : hors de portée du
    # mini-parser, donc repris au regex sur le texte entier.
    if m := re.search(r"^dependencies\s*=\s*\[(.*?)\]", text, re.S | re.M):
        for item in re.findall(r'["\']([^"\']+)["\']', m.group(1)):
            n = re.split(r"[<>=!~^\[;\s]", item, maxsplit=1)[0]
            deps.append({"n": n, "v": item[len(n):].strip(), "dev": 0})
    for k, v in sec.get("tool.poetry.dependencies", []):
        (tool.update({"python": v.strip('"')}) if k == "python"
         else deps.append({"n": k, "v": dep_ver(v), "dev": 0}))
    return {"name": proj.get("name", ""), "version": proj.get("version", ""),
            "toolchain": tool, "deps": deps, "scripts": {}, "entry": []}


def manifests(root: Path, rev: str | None, paths: list[str]) -> list[dict]:
    """Un manifeste par écosystème présent, pas seulement celui de la racine.

    Un dépôt PHP qui embarque un migrateur Go a deux manifestes ; n'en lire
    qu'un a déjà caché 27k lignes sur un vrai dépôt.
    """
    found = sorted(
        ((p, MANIFEST_ECO[Path(p).name]) for p in paths if Path(p).name in MANIFEST_ECO),
        key=lambda x: (len(Path(x[0]).parts), x[0]))
    out, over = [], max(0, len(found) - 16)
    for p, eco in found[:16]:
        text = read(root, p, rev)
        m = (parse_cargo(text) if eco == "cargo"
             else parse_gomod(text) if eco == "go"
             else parse_pyproject(text) if eco == "pip"
             else parse_json_manifest(text, eco))
        if not m:
            continue
        m["deps"].sort(key=lambda d: (d["dev"], d["n"]))
        out.append({"path": p, "eco": eco, **m})
    if over:
        out.append({"path": "", "eco": "…", "name": f"+{over} manifestes non lus",
                    "version": "", "toolchain": {}, "deps": [], "scripts": {}, "entry": []})
    return out


def _yaml_keys(lines: list[str], key: str) -> list[str]:
    """Clés de *premier* niveau sous `key:` — assez pour `on:` et `jobs:`.

    L'indentation du premier enfant fixe le niveau : sans ça, `branches:` sous
    `push:` remonte comme s'il était un déclencheur.
    """
    out, inside, depth = [], False, None
    for l in lines:
        if re.match(rf"^{key}\s*:", l):
            inside = True
            if rest := l.split(":", 1)[1].strip():
                return [x.strip().strip("'\"") for x in rest.strip("[]").split(",") if x.strip()]
            continue
        if not inside or not l.strip():
            continue
        if not l.startswith((" ", "\t")):
            break
        if m := re.match(r"^(\s+)([\w-]+)\s*:", l):
            if depth is None:
                depth = len(m.group(1))
            if len(m.group(1)) == depth:
                out.append(m.group(2))
    return out


def ci_workflows(root: Path, rev: str | None, paths: list[str]) -> list[dict]:
    out = []
    for p in paths:
        if not re.match(r"\.(github/workflows|gitlab-ci)", p) or not p.endswith((".yml", ".yaml")):
            continue
        lines = read(root, p, rev).splitlines()
        name = next((l.split(":", 1)[1].strip().strip("'\"")
                     for l in lines if l.startswith("name:")), Path(p).stem)
        on, jobs = _yaml_keys(lines, "on"), _yaml_keys(lines, "jobs")
        # un workflow entièrement commenté se lit comme un fichier vide : le
        # dire vaut mieux que l'afficher comme une CI qui tourne
        out.append({"path": p, "name": name, "on": on[:6], "jobs": jobs[:14],
                    **({"off": 1} if not on and not jobs else {})})
    return out


def make_targets(root: Path, rev: str | None, paths: list[str]) -> dict[str, list[str]]:
    """Recettes Makefile / justfile — souvent la vraie interface de build."""
    out = {}
    for p in paths:
        base = Path(p).name.lower()
        if base not in ("makefile", "justfile", "taskfile.yml") or len(Path(p).parts) > 2:
            continue
        names = [m.group(1) for m in re.finditer(r"^([a-z][\w.-]*)\s*:(?!=)", read(root, p, rev), re.M)]
        if names:
            out[p] = sorted(dict.fromkeys(names))[:24]
    return out


def vendor_ns(root: Path) -> dict[str, str]:
    """{préfixe de namespace: paquet composer} depuis vendor/composer/installed.json.

    Le dossier n'est pas commité : best-effort. Sans lui, un import PHP reste
    un namespace — toujours juste, seulement moins précis qu'un nom de paquet.
    La clé garde le préfixe *complet* déclaré : `Laravel\\Sanctum` et
    `Laravel\\Socialite` sont deux paquets que la racine seule confondrait.
    """
    out: dict[str, str] = {}
    try:
        d = json.loads((root / "vendor/composer/installed.json").read_text())
    except (OSError, json.JSONDecodeError):
        return out
    for pkg in (d.get("packages") if isinstance(d, dict) else d) or []:
        for kind in ("psr-4", "psr-0"):
            for ns in (pkg.get("autoload", {}).get(kind) or {}):
                if ns.strip("\\"):
                    out.setdefault(ns.strip("\\").lower(), pkg.get("name", ""))
    return out


def pkg_of(label: str) -> str:
    """Namespace importé → nom de paquet, par le plus long préfixe déclaré."""
    parts = label.split("\\")
    while parts:
        if (hit := NS_PKG.get("\\".join(parts).lower())):
            return hit
        parts.pop()
    return label


def stack(root: Path, rev: str | None, paths: list[str], data: dict,
          bins: Counter, mans: list[dict]) -> dict:
    """Le dossier technique : manifestes, chaîne d'outils, CI, binaires appelés.

    Tout est lu dans le dépôt ; rien n'est déduit d'un nom de fichier.
    """
    tests = [p for p in paths if re.search(r"(^|/)tests?/|_test\.|\.test\.|test_|Test\.php$", p)
             and Path(p).suffix in EXT_LANG]
    entry = [e for m in mans for e in m.get("entry", [])]
    entry += [p for p in paths if re.fullmatch(
        r"(src/)?(main\.(rs|go|py|ts)|index\.(ts|js|php)|artisan|manage\.py|public/index\.php)", p)]
    return {
        "manifests": mans,
        "ci": ci_workflows(root, rev, paths),
        "make": make_targets(root, rev, paths),
        "bins": [{"n": n, "hits": c} for n, c in bins.most_common(14)],
        "entry": sorted(dict.fromkeys(entry))[:8],
        "tests": {"files": len(tests),
                  "loc": sum(data.get("files", {}).get(p, 0) for p in tests)},
        "langs": data.get("langs", {}),
    }


# --------------------------------------------------------------------------- scan


def scan(root: Path, rev: str | None) -> dict:
    paths = list_files(root, rev)
    lang = detect_lang(paths)
    roots = psr4_roots(root, rev) if lang == "php" else {}
    index = build_index(paths, lang, roots)
    comment_re, ref_re = COMMENT[lang], REF[lang]
    crate = crate_name(root, rev) if lang == "rust" else ""

    modules: dict[str, dict] = {}
    edges: dict[tuple[str, str], str] = {}
    syms: dict[tuple[str, str], set[str]] = {}

    for name, path in index.items():
        text = read(root, path, rev)
        lines = text.splitlines()
        modules[name] = {"path": path, "loc": len(lines)}
        code = "\n".join(l for l in lines if not comment_re.match(l))
        docs = "\n".join(l for l in lines if comment_re.match(l))
        for kind, blob in (("import", code), ("design", docs)):
            if lang == "rust":
                refs = rust_refs(blob, crate, name)
            else:
                refs = [next((g for g in m.groups() if g), m.group(0))
                        for m in ref_re.finditer(blob)]
            for ref in refs:
                if not ref:
                    continue
                target = resolve(ref, index, lang, path)
                if not target or target == name:
                    continue
                key = (name, target)
                # un import réel écrase toujours une simple mention de doc
                if key not in edges or kind == "import":
                    edges[key] = kind
                # Ce qui est *importé* du module cible : gratuit ici puisque la
                # résolution vient de couper la référence au bon endroit.
                if kind == "import":
                    norm = ref.replace("/", "::").replace("\\", "::").replace(".", "::")
                    if norm.startswith(target):
                        tail = norm[len(target):].strip(":").split("::")[0]
                        if tail and tail != "self":     # `use x::{self, y}` = le module lui-même
                            syms.setdefault(key, set()).add(tail)

    # Le graphe ne couvre que le langage dominant, mais les LOC couvrent tout le
    # code : un dossier Go dans un dépôt PHP doit se mesurer, pas disparaître.
    files, ext, bins = {}, {}, Counter()
    ns_heads = {v.split("\\")[0] for v in roots.values()}
    gomod = next((re.search(r"^module\s+(\S+)", read(root, p, rev), re.M)
                  for p in paths if Path(p).name == "go.mod"), None)
    selfmod = gomod.group(1) if gomod else ""
    # Les manifestes d'abord : un crate utilisé en chemin qualifié (`toml::from_str`,
    # sans `use`) ne se distingue d'un module interne que par sa présence en dépendance.
    mans = manifests(root, rev, paths)
    declared = {k for m in mans for d in m["deps"]
                for k in (d["n"].lower(), d["n"].lower().replace("-", "_"), d["n"].split("/")[-1].lower())}
    for p in paths:
        l = EXT_LANG.get(Path(p).suffix)
        if not l:
            continue
        blob = read(root, p, rev)
        files[p] = modules[module_name(p, lang, roots)]["loc"] if p in index.values() \
            else len(blob.splitlines())
        names = ext_refs(blob, l, crate, ns_heads, selfmod, declared)
        if names:
            ext[p] = names
        for m in BIN_CALL.get(l, re.compile(r"(?!)")).finditer(blob):
            b = m.group(1)
            if re.fullmatch(r"[\w.@/-]{2,40}", b) and not b.startswith("/"):
                bins[Path(b).name] += 1
    langs = Counter()
    for p, n in files.items():
        langs[EXT_LANG[Path(p).suffix]] += n

    data = {
        "lang": lang,
        "langs": dict(langs.most_common()),
        "modules": modules,
        "files": files,
        "ext": ext,
        "edges": [{"f": f, "t": t, "src": s,
                   **({"sym": sorted(syms[(f, t)])[:8]} if (f, t) in syms else {})}
                  for (f, t), s in sorted(edges.items())],
        "stats": stats(root, paths, rev, modules),
        "git": git_meta(root, rev),
    }
    data["stack"] = stack(root, rev, paths, data, bins, mans)
    return data


def ext_refs(blob: str, lang: str, crate: str, ns_heads: set[str], selfmod: str,
             declared: set[str]) -> list[str]:
    """Paquets *externes* cités par un fichier, tous langages confondus.

    Le graphe d'imports s'arrête au bord du dépôt ; c'est cette fonction qui
    dit ce qui se passe au-delà, et donc quel bloc du dessin tient telle ligne
    de manifeste.
    """
    if lang not in EXT_REF:
        return []
    out = []
    for m in EXT_REF[lang].finditer(blob):
        n = next((g for g in m.groups() if g), "")
        if not n:
            continue
        if lang == "rust":
            if n in RUST_STD or n == crate:
                continue
        elif lang == "php":
            if n.split("\\")[0] in ns_heads:
                continue
        elif lang == "go":
            if selfmod and (n == selfmod or n.startswith(selfmod + "/")):
                continue
            n = "/".join(n.split("/")[:3])          # host/org/repo
        elif lang == "ts":
            parts = n.split("/")
            n = "/".join(parts[:2]) if n.startswith("@") else parts[0]
        out.append(n)
    if lang == "rust":
        # `toml::from_str` sans `use toml` : indiscernable d'un module interne
        # au regex près, donc filtré sur les dépendances réellement déclarées.
        for m in re.finditer(r"\b([a-z_][a-z0-9_]*)::", blob):
            n = m.group(1)
            if n not in RUST_STD and n != crate and n.lower() in declared:
                out.append(n)
    return sorted(dict.fromkeys(out))


def stats(root: Path, paths: list[str], rev: str | None, modules: dict) -> dict:
    total = sum(m["loc"] for m in modules.values())
    tests = [p for p in paths if "test" in p.lower() or "spec" in p.lower()]
    test_fns = 0
    for p in tests[:400]:
        t = read(root, p, rev)
        test_fns += len(re.findall(
            r"#\[(?:tokio::)?test\]|#\[Test\]|\bdef test_|\bfunction test|\bit\(|\btest\(", t))
    version = ""
    for man in ("Cargo.toml", "package.json", "pyproject.toml", "composer.json"):
        t = read(root, man, rev)
        if t:
            m = re.search(r'"?version"?\s*[:=]\s*"([^"]+)"', t)
            if m:
                version = m.group(1)
                break
    return {
        "modules": len(modules),
        "loc": total,
        "files": len(modules),
        "test_files": len(tests),
        "test_fns": test_fns,
        "workflows": len([p for p in paths if p.startswith(".github/workflows/")]),
        "version": version,
    }


def churn(root: Path, since: str) -> dict[str, dict]:
    """Fréquence de changement par fichier depuis `since` (`git log --numstat`).

    CodeScene : les LOC sont un proxy de complexité aussi prédictif que la
    complexité cyclomatique ; croisées avec le churn elles donnent les hotspots.
    Les renommages ne sont pas suivis (`--follow` est par fichier, trop cher) :
    un fichier déplacé repart donc à zéro.
    """
    out: dict[str, dict] = {}
    log = sh(["git", "log", f"--since={since}", "--numstat",
              "--pretty=format:%x01%H%x02%an"], root)
    commit = author = ""
    for line in log.splitlines():
        if line.startswith("\x01"):
            commit, _, author = line[1:].partition("\x02")
            continue
        parts = line.split("\t")
        if len(parts) != 3:
            continue
        add, dele, path = parts
        e = out.setdefault(path, {"commits": set(), "authors": set(), "churn": 0})
        e["commits"].add(commit)
        e["authors"].add(author)
        e["churn"] += sum(int(x) for x in (add, dele) if x.isdigit())
    return {p: {"commits": len(e["commits"]), "authors": len(e["authors"]),
                "churn": e["churn"]} for p, e in out.items()}


def git_meta(root: Path, rev: str | None) -> dict:
    remote = sh(["git", "remote", "get-url", "origin"], root).strip()
    remote = re.sub(r"^git@([^:]+):", r"https://\1/", remote).removesuffix(".git")
    sha = sh(["git", "rev-parse", rev or "HEAD"], root).strip()
    return {"remote": remote, "sha": sha, "rev": rev or "HEAD",
            "codeUrl": f"{remote}/blob/{sha}/" if remote else ""}


# --------------------------------------------------------------------------- workspace


def scan_workspace(root: Path) -> dict:
    repos = sorted(p for p in root.iterdir() if (p / ".git").exists())
    out = {}
    for r in repos:
        paths = list_files(r, None)
        lang = detect_lang(paths)
        index = build_index(paths, lang, psr4_roots(r, None) if lang == "php" else {})
        loc = sum(len(read(r, p, None).splitlines()) for p in index.values())
        out[r.name] = {"lang": lang, "modules": len(index), "loc": loc,
                       "git": git_meta(r, None)}
    return {"workspace": str(root), "repos": out}


# --------------------------------------------------------------------------- inject


def inject(html_path: Path, data: dict, prev: dict | None) -> int:
    """Réécrit `loc:` / `locNow:` / `locPrev:` de chaque bloc depuis ses modules.

    Un bloc déclare ses fichiers via `mod:["a","b"]` ; la couche jugée
    (`what` / `how` / layout) n'est jamais touchée. `id`, `mod` et `loc` vivent
    sur la même ligne dans le DATA, donc une passe ligne à ligne suffit.
    """
    def table_of(d):
        mods = d.get("modules", {})
        t = {n: m["loc"] for n, m in mods.items()}
        t.update({m["path"]: m["loc"] for m in mods.values()})  # `mod` accepte nom ou chemin
        return t

    def paths_of(d):
        # tous les fichiers de code, pas seulement ceux du langage dominant
        if d.get("files"):
            return list(d["files"].items())
        return [(m["path"], m["loc"]) for m in d.get("modules", {}).values()]

    mods, pmods = table_of(data), table_of(prev or {})
    mpaths, ppaths = paths_of(data), paths_of(prev or {})
    ch = data.get("churn", {})
    changed = 0

    def churn_of(names):
        """Commits et lignes remuées d'un bloc — un commit qui touche deux
        fichiers du même bloc ne compte qu'une fois de trop ici : on somme par
        fichier, ce qui surestime légèrement les blocs très larges."""
        keep = [n for n in names if not n.startswith("!")]
        drop = [n[1:] for n in names if n.startswith("!")]
        c = l = 0
        for p, v in ch.items():
            if any(p == d or p.startswith(d) for d in drop):
                continue
            if any(p == n or (n.endswith("/") and p.startswith(n)) for n in keep):
                c += v["commits"]; l += v["churn"]
        return c, l

    def loc_of(names, table, paths):
        """Un nom de module, un chemin de fichier, ou un dossier (suffixe "/") —
        un bloc qui agrège 600 fichiers déclare son dossier, pas la liste.
        Un préfixe `!` exclut : `["app/Services/", "!app/Services/Search/"]`
        pour un bloc fourre-tout dont on a sorti des sous-dossiers."""
        keep = [n for n in names if not n.startswith("!")]
        drop = [n[1:] for n in names if n.startswith("!")]
        skip = lambda p: any(p == d or p.startswith(d) for d in drop)
        total = sum(table[n] for n in keep if n in table and not skip(n))
        for n in keep:
            if n.endswith("/"):
                total += sum(loc for p, loc in paths if p.startswith(n) and not skip(p))
        return total

    def fmt(n):
        return f"{n / 1000:.1f}k" if n >= 10000 else f"{n:,}".replace(",", " ")

    def patch(line, key, value):
        if re.search(rf"{key}:\S+?[,}}]", line):
            return re.sub(rf"{key}:[^,}}]+", f"{key}:{value}", line, count=1)
        return re.sub(r'(loc:"[^"]*")', rf"\1, {key}:{value}", line, count=1)

    out = []
    for line in html_path.read_text().splitlines(keepends=True):
        m = re.search(r'id:"[^"]+".*?mod:\[([^\]]*)\]', line)
        if m:
            names = [x.strip().strip('"') for x in m.group(1).split(",") if x.strip()]
            cur = loc_of(names, mods, mpaths)
            if cur:
                line, n = re.subn(r'loc:"[^"]*"', f'loc:"{fmt(cur)}"', line, count=1)
                changed += n
                if "locNow:" in line or pmods:
                    line = patch(line, "locNow", cur)
                if pmods:
                    line = patch(line, "locPrev", loc_of(names, pmods, ppaths))
                if ch:
                    c, l = churn_of(names)
                    line = patch(line, "commits", c)
                    line = patch(line, "churn", l)
        out.append(line)
    html_path.write_text("".join(out))
    return changed


# --------------------------------------------------------------------------- stack → atlas


def atlas_blocks(html_path: Path) -> list[tuple[str, list[str], list[str]]]:
    """(id, chemins gardés, chemins exclus) de chaque bloc, lus dans le DATA."""
    out = []
    for line in html_path.read_text().splitlines():
        if m := re.search(r'id:"([^"]+)".*?mod:\[([^\]]*)\]', line):
            names = [x.strip().strip('"') for x in m.group(2).split(",") if x.strip()]
            out.append((m.group(1), [n for n in names if not n.startswith("!")],
                        [n[1:] for n in names if n.startswith("!")]))
    return out


def stack_for(html_path: Path, data: dict) -> str:
    """`const STACK = {…}` prêt à coller : le dossier technique, plus le lien
    mesuré entre chaque dépendance et les blocs du dessin qui l'importent.

    C'est ce lien qui fait la différence entre une liste de dépendances et un
    `cat Cargo.toml` : « qui s'en sert » n'est nulle part dans le manifeste.
    """
    blocks = atlas_blocks(html_path)

    def owner(path: str) -> str | None:
        best, blen = None, -1
        for bid, keep, drop in blocks:
            if any(path == d or path.startswith(d) for d in drop):
                continue
            for n in keep:
                if (n == path or (n.endswith("/") and path.startswith(n))) and len(n) > blen:
                    best, blen = bid, len(n)
        return best

    # nom de module ↔ chemin : `mod:` accepte les deux
    by_name = {n: m["path"] for n, m in data.get("modules", {}).items()}
    for bid, keep, drop in blocks:
        keep[:] = [by_name.get(n, n) for n in keep]

    # `used` sert les recherches (toutes les orthographes), `canon` l'analyse
    # (un paquet, une ligne — sinon `carbon` et `nesbot/carbon` se comptent deux fois)
    used: dict[str, set[str]] = {}
    canon: dict[str, set[str]] = {}
    for path, names in (data.get("ext") or {}).items():
        b = owner(path)
        if not b:
            continue
        for n in names:
            canon.setdefault(pkg_of(n).lower(), set()).add(b)
            # la racine aussi : `phpunit\framework\attributes` doit répondre à `phpunit/phpunit`
            for k in {n.lower(), pkg_of(n).lower(), n.split("\\")[0].lower()}:
                used.setdefault(k, set()).add(b)

    def who(dep: str) -> list[str]:
        """Un paquet peut s'importer sous un autre nom que celui du manifeste :
        `-`/`_` en Rust, `laravel/framework` → `Illuminate` en PHP (résolu par
        le vendor s'il est là), le dernier segment ailleurs."""
        keys = {dep.lower(), dep.lower().replace("-", "_"), dep.split("/")[-1].lower()}
        return sorted(set().union(*(used.get(k, set()) for k in keys)))

    st = json.loads(json.dumps(data["stack"]))
    # Ce qui traverse réellement chaque frontière entre deux blocs : les noms
    # importés, relevés à la résolution des arêtes. Une arête dit qu'il y a un
    # lien ; ceci dit lequel.
    crossings: dict[str, Counter] = {}
    for e in data.get("edges", []):
        if not e.get("sym"):
            continue
        f, t = owner(by_name.get(e["f"], "")), owner(by_name.get(e["t"], ""))
        if f and t and f != t:
            crossings.setdefault(f"{f}>{t}", Counter()).update(e["sym"])
    st["edgeSyms"] = {k: [n for n, _ in c.most_common(10)]
                      for k, c in sorted(crossings.items(), key=lambda kv: -len(kv[1]))[:40]}

    for man in st["manifests"]:
        for d in man["deps"]:
            if w := who(d["n"]):
                d["by"] = w
    # ce que le code importe sans qu'aucun manifeste ne le déclare
    declared = {k for man in st["manifests"] for d in man["deps"]
                for k in (d["n"].lower(), d["n"].lower().replace("-", "_"), d["n"].split("/")[-1].lower())}
    st["undeclared"] = sorted(
        ({"n": n, "by": sorted(b)} for n, b in canon.items()
         if len(b) > 1 and n not in declared),
        key=lambda x: (-len(x["by"]), x["n"]))[:12]
    return "const STACK = " + json.dumps(st, indent=2, ensure_ascii=False) + ";"


NS_PKG: dict[str, str] = {}


# --------------------------------------------------------------------------- cli


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=".", type=Path)
    ap.add_argument("--rev", help="mesurer l'état À cette révision git")
    ap.add_argument("--diff", metavar="REV", help="mesurer HEAD et ajouter locPrev depuis REV")
    ap.add_argument("--inject", type=Path, help="réinjecter loc (et locPrev si --diff) dans cet atlas")
    ap.add_argument("--workspace", type=Path, help="un bloc par repo sous ce dossier")
    ap.add_argument("--churn", metavar="SINCE", default="12 months ago",
                    help="fenêtre du churn git (défaut : 12 months ago)")
    ap.add_argument("--stack", action="store_true", help="n'imprimer que le dossier technique")
    ap.add_argument("--stack-for", type=Path, metavar="ATLAS",
                    help="dossier technique en `const STACK = {…}`, deps reliées aux blocs de cet atlas")
    a = ap.parse_args()

    if a.workspace:
        print(json.dumps(scan_workspace(a.workspace), indent=2))
        return 0

    NS_PKG.update(vendor_ns(a.root))
    data = scan(a.root, a.rev)
    if not a.rev:
        data["churn"] = churn(a.root, a.churn)
        data["churnSince"] = a.churn
    prev = scan(a.root, a.diff) if a.diff else None

    if a.stack_for:
        print(stack_for(a.stack_for, data))
        return 0

    if a.stack:
        print(json.dumps(data["stack"], indent=2, ensure_ascii=False))
        return 0

    if a.inject:
        n = inject(a.inject, data, prev)
        print(f"{n} blocs mis à jour dans {a.inject}"
              + (f" (locPrev @ {a.diff})" if a.diff else ""), file=sys.stderr)
        return 0

    if prev:
        for name, m in data["modules"].items():
            m["locPrev"] = prev["modules"].get(name, {}).get("loc", 0)
        data["prevRev"] = a.diff
    print(json.dumps(data, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
