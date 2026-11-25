---
name: me-setup
description: "Créer ou mettre à jour le AGENTS.md d'un projet Codex avec stack, commandes réelles, structure, conventions et workflow Git. À utiliser pour /me:setup, setup projet Codex, init/update/refresh AGENTS.md."
---

# Setup AGENTS.md Projet

Crée ou mets à jour le `AGENTS.md` à la racine du projet courant. Le résultat doit être court, impératif, vérifié dans le repo, et compatible avec Codex. Ne génère pas de `CLAUDE.md`.

## Modes

- `init` : créer `AGENTS.md` si absent. Si un fichier existe, le lire et préserver ce qui est manuel.
- `update` : compléter ou corriger l'existant sans réécrire les sections non concernées.
- `refresh` : resynchroniser seulement les sections factuelles détectables : stack, commandes, structure, conventions repo.
- Si le mode est absent ou ambigu, choisir `update` quand `AGENTS.md` existe, sinon `init`.

## Workflow

1. Inspecter la racine : `pwd`, `git status`, `git rev-parse --show-toplevel`, fichiers manifestes et docs.
2. Détecter la stack depuis les sources réelles : `package.json`, `composer.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `Makefile`, `justfile`, CI, README.
3. Extraire uniquement les commandes prouvées : install, dev, build, lint, typecheck, test ciblé, test complet, format, release/changelog.
4. Détecter les conventions repo : branche par défaut, `.gwm.toml`, `.github/ISSUE_TEMPLATE/*`, `.github/PULL_REQUEST_TEMPLATE.md`, `CONTRIBUTING.md`, changelog.
5. Utiliser la cascade de recherche Codex : `mgrep` si disponible et authentifié, Serena si disponible pour symboles/références, sinon `rg`; Context7 pour docs de libs si nécessaire.
6. Écrire ou mettre à jour `AGENTS.md` avec des faits vérifiés. Ne pas inventer une commande : écrire `non détecté` ou `à compléter`.
7. Relire le fichier final et vérifier qu'il reste raisonnable, idéalement <200 lignes.

## Template Cible

```md
# <Nom du projet>

## Stack
- Langages :
- Frameworks :
- Package manager :
- Runtime/services :

## Commandes
- Installer :
- Dev :
- Build :
- Lint :
- Typecheck :
- Tests ciblés :
- Tests complets :
- Format :
- Release/changelog :

## Structure
- `<path>` : <rôle>

## Conventions
- Code :
- Tests :
- UI/API/DB :
- Changelog :

## Workflow Git
- Ne jamais travailler directement sur `main`/`master`.
- Worktree par défaut via `gwm` si `.gwm.toml` ou convention repo le permet ; sinon branche dédiée.
- Commits atomiques Gitmoji + Conventional Commits, avec référence issue.
- Issue et PR remplies depuis `.github/*` quand présents.
- Review puis CI verte avant merge.

## Notes Projet
- <env, secrets, services, pièges connus>
```

## Règles

- Préserver les changements utilisateur.
- Adapter au repo : ne pas imposer `dev`, `main`, `gwm` ou un package manager si le repo prouve autre chose.
- Pour des règles propres à un dossier, utiliser la skill `me-rules` et créer des `AGENTS.md` imbriqués.
