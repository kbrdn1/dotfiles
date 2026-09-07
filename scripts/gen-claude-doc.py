#!/usr/bin/env python3
"""Génère CLAUDE-CODE.md : l'inventaire des skills, commandes et agents.

Même principe que gen-keybindings.py — le document est lu depuis ~/.claude, jamais
écrit à la main :

    python3 scripts/gen-claude-doc.py

Les descriptions de frontmatter sont des blobs bourrés de triggers (c'est ce qui
pilote le déclenchement côté Claude). On n'en garde que la première phrase : le
reste est du matériel de matching, pas de la doc pour un humain.
"""

import os
import re
import sys
from pathlib import Path

HOME = Path.home()
CLAUDE = HOME / ".claude"
OUT = Path(__file__).resolve().parent.parent / "CLAUDE-CODE.md"


def frontmatter(path: Path) -> dict[str, str]:
    """Extrait name/description du frontmatter YAML, sans dépendance PyYAML."""
    try:
        txt = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return {}
    m = re.match(r"---\r?\n(.*?)\r?\n---", txt, re.S)
    if not m:
        return {}
    out, key, buf = {}, None, []
    for line in m.group(1).splitlines():
        kv = re.match(r"([a-zA-Z0-9_-]+):\s*(.*)$", line)
        if kv:
            if key:
                out[key] = " ".join(buf).strip()
            key, buf = kv.group(1), [kv.group(2)]
        elif key:
            buf.append(line.strip())
    if key:
        out[key] = " ".join(buf).strip()
    for k, v in out.items():
        out[k] = v.strip().strip('"').strip("'")
    return out


def summary(desc: str, limit: int = 160) -> str:
    """Première phrase utile, triggers retirés."""
    if not desc:
        return "—"
    # indicateurs de bloc YAML (`>-`, `|`, `>`) : le parseur minimal les laisse passer
    desc = re.sub(r"^[>|][+-]?\s*", "", desc).strip()
    desc = re.split(r"\s*(?:Triggers?|À utiliser)\s*:", desc)[0]
    # première phrase, en évitant de couper sur les points d'abréviations courantes
    parts = re.split(r"(?<=[a-zé0-9\)»])\.\s+(?=[A-ZÀ-Ý])", desc)
    s = parts[0].strip().rstrip(".")
    if len(s) > limit:
        s = s[:limit].rsplit(" ", 1)[0] + "…"
    return s.replace("|", "\\|") or "—"


def skill_name(d: Path, fm: dict[str, str]) -> str:
    """Nom d'invocation = le chemin, pas le frontmatter.

    Les deux divergent dans cette config : certains skills sous `me/` declarent
    `name: banner-github` au lieu de `me:banner-github`. C'est le chemin qui fait
    foi pour l'invocation, donc c'est lui qu'on affiche.
    """
    rel = d.relative_to(CLAUDE / "skills")
    return str(rel).replace(os.sep, ":")


def collect_skills() -> tuple[list, list, list]:
    """(skills me:*, skills propres, symlinks tiers)"""
    root = CLAUDE / "skills"
    mine, own, linked = [], [], []
    if not root.is_dir():
        return mine, own, linked
    for entry in sorted(root.iterdir(), key=lambda p: p.name.lower()):
        if entry.is_symlink():
            target = os.readlink(entry)
            linked.append((entry.name, target))
            continue
        if not entry.is_dir():
            continue
        if entry.name == "me":
            # skills/me/<name>/SKILL.md, et skills/me/loop/<name>/SKILL.md
            for sk in sorted(entry.rglob("SKILL.md")):
                fm = frontmatter(sk)
                mine.append((skill_name(sk.parent, fm), summary(fm.get("description", ""))))
            continue
        sk = entry / "SKILL.md"
        if sk.is_file():
            fm = frontmatter(sk)
            own.append((skill_name(entry, fm), summary(fm.get("description", ""))))
    return mine, own, linked


def collect_md(sub: str) -> list[tuple[str, str]]:
    root = CLAUDE / sub
    if not root.is_dir():
        return []
    rows = []
    for f in sorted(root.rglob("*.md")):
        rel = f.relative_to(root).with_suffix("")
        fm = frontmatter(f)
        name = fm.get("name") or str(rel).replace(os.sep, ":")
        rows.append((name, summary(fm.get("description", ""))))
    return rows


def table(rows, headers) -> list[str]:
    if not rows:
        return []
    out = ["| " + " | ".join(headers) + " |",
           "|" + "|".join("---" for _ in headers) + "|"]
    out += ["| " + " | ".join(f"`{c}`" if i == 0 else str(c)
                              for i, c in enumerate(r)) + " |" for r in rows]
    return out + [""]


def main() -> int:
    if not CLAUDE.is_dir():
        print(f"{CLAUDE} introuvable", file=sys.stderr)
        return 1
    mine, own, linked = collect_skills()
    commands = collect_md("commands")
    agents = collect_md("agents")
    styles = sorted(p.stem for p in (CLAUDE / "output-styles").glob("*")) \
        if (CLAUDE / "output-styles").is_dir() else []
    hooks = sorted(p.name for p in (CLAUDE / "hooks").glob("*")) \
        if (CLAUDE / "hooks").is_dir() else []

    b = [
        "# Claude Code — inventaire de la config",
        "",
        "> ⚠️ **Fichier généré.** Ne pas l'éditer à la main — relancer",
        "> `python3 scripts/gen-claude-doc.py`, qui relit `~/.claude`.",
        "",
        "La méthode de travail elle-même est décrite dans",
        "[`private_dot_claude/RULES.md`](private_dot_claude/RULES.md) et",
        "[`private_dot_claude/WORKFLOW.md`](private_dot_claude/WORKFLOW.md).",
        "Ce document ne fait que lister ce qui est installé.",
        "",
        "| | |",
        "|---|---|",
        f"| Skills `me:*` | {len(mine)} |",
        f"| Autres skills | {len(own)} |",
        f"| Skills liés (tiers) | {len(linked)} |",
        f"| Commandes | {len(commands)} |",
        f"| Agents | {len(agents)} |",
        "",
        "## Skills `me:*` — ma méthode de travail",
        "",
        "Les procédures maison : workflows git, boucles auto-cadencées, bootstrap projet,",
        "génération de documents. Ce sont elles que `RULES.md` et `WORKFLOW.md` citent.",
        "",
        *table(sorted(mine), ("Skill", "Rôle")),
        "## Autres skills",
        "",
        "Skills à part entière vivant dans le dépôt, hors namespace `me:`.",
        "",
        *table(sorted(own), ("Skill", "Rôle")),
    ]

    if linked:
        b += [
            "## Skills liés (non versionnés)",
            "",
            f"{len(linked)} symlinks vers des installations tierces — le dépôt ne les",
            "embarque pas, il faut réinstaller la source pour les retrouver. Le lien dit",
            "d'où ils viennent.",
            "",
        ]
        by_target: dict[str, list[str]] = {}
        for name, target in linked:
            root = target.split("/skills/")[-1].rsplit("/", 1)[0] if "/skills/" in target else target
            by_target.setdefault(root if root != name else "(racine)", []).append(name)
        rows = [(src, str(len(names)), ", ".join(sorted(names)[:6]) +
                 ("…" if len(names) > 6 else ""))
                for src, names in sorted(by_target.items())]
        b += table(rows, ("Source", "Nb", "Exemples"))

    b += ["## Commandes", "",
          "Chaque commande est un point d'entrée léger qui délègue à un skill.", "",
          *table(commands, ("Commande", "Rôle"))]
    b += ["## Agents", "", *table(agents, ("Agent", "Rôle"))]
    if styles or hooks:
        b += ["## Divers", ""]
        if styles:
            b += [f"- **Output styles** : {', '.join(f'`{s}`' for s in styles)}"]
        if hooks:
            b += [f"- **Hooks** : {', '.join(f'`{h}`' for h in hooks)}"]
        b += [""]

    OUT.write_text("\n".join(b).rstrip() + "\n", encoding="utf-8")
    print(f"{OUT.name} écrit — {len(mine)} skills me:*, {len(own)} autres, "
          f"{len(linked)} liés, {len(commands)} commandes, {len(agents)} agents")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
