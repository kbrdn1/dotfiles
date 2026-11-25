---
name: me-changelog-create
description: "Créer ou mettre à jour une skill Codex de changelog propre au projet, avec changelog.config.json et .agents/skills/changelog/SKILL.md. À utiliser pour /me:changelog-create, générer /changelog adapté au projet, remplacer /generate-changelog."
---

# Générateur de Skill Changelog Projet

Crée ou mets à jour une skill Codex locale de changelog pour le projet courant. La sortie native est `<repo>/.agents/skills/changelog/SKILL.md` plus `<repo>/changelog.config.json`. Ne génère pas de `.claude/commands/changelog.md`.

## Modes

- `init` : créer la config et la skill projet.
- `update` : faire évoluer la config ou la skill existante en préservant les choix manuels.
- Si le mode est absent, choisir `update` si `.agents/skills/changelog/SKILL.md` existe, sinon `init`.

## CLI Sous-Jacent

Utiliser le CLI migré si disponible :

```bash
~/.agents/skills/changelog-generator/bin/changelog-generator
```

Si absent, lancer :

```bash
bash ~/.agents/skills/changelog-generator/scripts/setup.sh
```

## Workflow

1. Inspecter le projet courant : `CHANGELOG.md`, `changelogs/`, tags, branches, langue, format existant.
2. Déduire ou demander les choix non prouvés :
   - base et compare par défaut ;
   - dossier de sortie ;
   - pré-releases ;
   - format client ;
   - verbosité des entrées : `verbose | normal | short` ;
   - détails version : `verbose | normal | short | null`.
3. Créer ou mettre à jour `changelog.config.json` sans écraser les clés existantes non concernées.
4. Créer ou mettre à jour `<repo>/.agents/skills/changelog/SKILL.md`.
5. La skill générée doit expliquer comment produire une version à partir du git log réel, catégoriser les entrées, respecter le format du repo, puis splitter dans `changelogs/` si c'est la convention locale.
6. Résumer les fichiers créés/modifiés et la commande d'usage : `$changelog vX.Y.Z`.

## Config Minimale

```json
{
  "branches": {
    "default_base": "main",
    "default_compare": "dev"
  },
  "output": {
    "dir": "changelogs",
    "pre_release_dir": "changelogs/pre-releases",
    "client_dir": "changelogs/client"
  },
  "verbosity": {
    "entries": "normal",
    "version_details": "normal",
    "client": false
  }
}
```

Adapter ces valeurs au repo. Ne pas imposer `main/dev` si le repo prouve une autre convention.

## Template de Skill Générée

```md
---
name: changelog
description: "Générer le changelog de ce projet pour une version donnée, selon changelog.config.json et le format existant du repo."
---

# Changelog Projet

Args : `vX.Y.Z [--entries=verbose|normal|short] [--version=verbose|normal|short|null] [--client] [--base=<branch>] [--compare=<branch>]`

1. Lire `changelog.config.json`, `CHANGELOG.md`, les derniers fichiers `changelogs/` et les tags.
2. Lancer `changelog-generator extract --base <base> --compare <compare>`.
3. Rédiger uniquement à partir du git log, des issues/PR vérifiables et du format existant.
4. Classer en Ajouté / Modifié / Corrigé / Docs / Dépendances selon la convention du repo.
5. Mettre à jour `CHANGELOG.md` et/ou générer le fichier `changelogs/<version>.md` selon la convention locale.
6. Si demandé, produire la version client.
7. Relire le diff et signaler ce qui est non testé ou à valider.
```

## Règles

- Evidence-based : ne pas inventer de métriques, d'auteurs, de dates ou de changements.
- Préserver les versions passées.
- Respecter le style existant : préfixe `v` ou non, langue, titres, dossiers.
- Garder la skill projet courte ; les détails variables doivent rester dans `changelog.config.json`.
