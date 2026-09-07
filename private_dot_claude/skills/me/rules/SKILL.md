---
name: me:rules
description: "Crée et fait évoluer les <repo>/.claude/rules/*.md path-scoped (frontmatter paths:) selon le stack du projet — conventions techniques chargées seulement quand pertinent. Args: init | update. Triggers: /me:rules, créer rules projet, path-scoped rules, conventions par répertoire."
---

# Path-scoped rules d'un projet

Tu crées ou fais évoluer les règles **path-scoped** natives dans `<repo>/.claude/rules/*.md`. Chaque fichier porte un frontmatter `paths:` qui **scope la règle à certains fichiers** : elle n'est chargée que lorsque Claude touche un fichier correspondant. C'est le complément de [[me:setup]] : `CLAUDE.md` = global au projet, `rules/` = conventions techniques ciblées.

## Argument (`init` | `update`)
- **`init`** → analyser le stack et créer les fichiers `rules/*.md` adaptés. Si `.claude/rules/` existe déjà → demander confirmation (AskUserQuestion) avant d'ajouter/écraser.
- **`update`** → faire évoluer les règles existantes selon l'état actuel du repo (nouveaux dossiers, nouveau stack, conventions qui ont changé) ; préserver le contenu écrit à la main.
- Vide/invalide → afficher l'usage `init | update` et s'arrêter.

## Format d'une règle

```markdown
---
paths:
  - "src/api/**/*.ts"
  - "src/services/**/*.ts"
---
# <Domaine> — conventions

- <règle impérative et concrète>
- <pattern à suivre / anti-pattern à éviter>
```

> `paths:` suit la spec gitignore relative à la racine du projet. Sans `paths:`, la règle s'applique à tout le repo (à éviter — préférer le scoping).

## Procédure

1. **Détecter le stack et la structure**
   - Manifestes (`package.json`, `composer.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`…), frameworks, dossiers clés.
   - **Le graphe d'abord** — c'est lui qui dit quels dossiers existent vraiment et lesquels portent du poids, donc **quels `paths:` scoper**. ⚠️ Toujours depuis la **racine** du dépôt, jamais depuis un worktree :

     ```bash
     ROOT=$(git rev-parse --path-format=absolute --git-common-dir | xargs dirname)
     test -f "$ROOT/graphify-out/graph.json" \
       && (cd "$ROOT" && graphify update .) \
       || (cd "$ROOT" && graphify extract . --code-only)
     ```

     Les **communautés** du graphe sont des candidats naturels à un fichier de règle ; les **God Nodes** disent où une convention compte le plus. Vérifier ensuite que chaque `paths:` matche des fichiers réels — le graphe le dit sans deviner.
   - **Ce que le vault sait déjà** — `grep -rl "<nom-du-repo>" ~/Vault/pro ~/Vault/perso --include='*.md' --exclude-dir='99 - Meta'` (les templates citent des noms de repos en exemple, ils polluent sinon). La section **Écarts avec mes conventions** de la note d'entité est exactement une source de règles : elle liste ce qui ne se comporte pas comme d'habitude ici.
   - Recherche projet : **mgrep** (fix init si erreur — obligatoire) → **serena** (symboles/refs) → `find`.
   - Docs framework si besoin : **context7** (pour des conventions à jour).

2. **Découper en règles ciblées** — un fichier par domaine, scopé par `paths:`. Exemples selon le stack détecté :
   - **React/TS** (`fiches-pedagogiques-front`) → `rules/react.md` (paths `**/*.tsx`) : composants, hooks, état, a11y.
   - **Laravel/PHP** (`fiches-pedagogiques-api-rest`) → `rules/laravel-api.md` (paths `app/**/*.php`) : Form Requests, Resources, validation, conventions Eloquent.
   - **Rust** (`gwm-cli`, `LazyCurl-rs`) → `rules/rust.md` (paths `src/**/*.rs`) : error handling, clippy, modules, tests.
   - **Tests** → `rules/tests.md` (paths `**/*.test.*`, `tests/**`) : structure, coverage attendue.

3. **Écrire** les fichiers dans `<repo>/.claude/rules/`, garder chaque fichier **court et impératif** (evidence-based : refléter les conventions réelles du repo, pas des généralités).

4. **Résumer** : lister les fichiers créés/modifiés et leurs `paths:`.

## Règles
- Ne pas dupliquer ce qui est déjà dans le `CLAUDE.md` du projet (workflow Git, cascade outils) — ces rules portent **les conventions techniques**, pas la méthode.
- Vérifier que les patterns `paths:` matchent bien des fichiers existants du repo.
