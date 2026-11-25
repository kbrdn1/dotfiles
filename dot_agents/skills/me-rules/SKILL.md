---
name: me-rules
description: "Créer ou mettre à jour des règles Codex par dossier via AGENTS.md ou AGENTS.override.md. À utiliser pour /me:rules, règles projet, conventions techniques ciblées, remplacement natif des .claude/rules path-scoped."
---

# Règles Projet Codex

Crée ou fais évoluer des règles techniques ciblées avec le mécanisme natif Codex : `AGENTS.md` imbriqués, ou `AGENTS.override.md` quand un dossier doit remplacer les règles héritées. Ne crée pas de `.claude/rules/*.md`.

## Modes

- `init` : analyser la stack et créer les règles de dossier utiles.
- `update` : ajuster les règles existantes selon l'état actuel du repo.
- Si le mode est absent, choisir `update` quand des `AGENTS.md` imbriqués existent, sinon `init`.

## Où Écrire

- Règles générales repo : `<repo>/AGENTS.md` via `me-setup`.
- Règles spécifiques à un domaine : `<repo>/<dir>/AGENTS.md`.
- Override strict dans un sous-dossier : `<repo>/<dir>/AGENTS.override.md`.
- Skills réutilisables : `<repo>/.agents/skills/<name>/SKILL.md`, pas `AGENTS.md`.

## Workflow

1. Inspecter la structure et les manifestes : stack, frameworks, dossiers clés, tests, conventions déjà documentées.
2. Rechercher les patterns réels avec `mgrep` si disponible, Serena si utile, sinon `rg`.
3. Décider les dossiers qui méritent une règle locale. Exemples :
   - `app/`, `routes/`, `database/` pour Laravel/PHP.
   - `src/`, `components/`, `pages/`, `app/` pour React/Nuxt/TS.
   - `src/`, `crates/`, `tests/` pour Rust.
   - `tests/`, `e2e/`, `specs/` pour conventions de tests.
4. Lire tout `AGENTS.md` ou `AGENTS.override.md` existant avant modification.
5. Écrire des règles courtes, impératives, fondées sur le code existant.
6. Vérifier que chaque fichier créé est dans le dossier où Codex doit appliquer la règle.

## Format Recommandé

```md
# <Domaine> Rules

- Utiliser <pattern réel du repo>.
- Éviter <anti-pattern réellement observé ou risqué>.
- Tests : <commande ou convention locale>.
- Validation : <check ciblé>.
```

## Règles

- Ne pas dupliquer les workflows Git globaux déjà dans le `AGENTS.md` racine.
- Ne pas créer une règle pour chaque dossier : seulement les zones où les conventions changent vraiment.
- Si une règle ne peut pas être liée à un chemin naturel, elle appartient probablement au `AGENTS.md` racine.
- Préserver les sections manuelles et signaler les commandes non détectées au lieu de les inventer.
