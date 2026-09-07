---
name: issue-branch-pr
description: "Workflow Issue → Branche → Commits atomiques → Push → PR (sans worktree)"
category: workflow
complexity: standard
argument-hint: "[description courte de la tâche]"
allowed-tools: Bash(gh :*), Bash(git :*), Bash(ls :*), Bash(test :*), Bash(cat :*), Bash(grep :*), Bash(pwd), Read, Glob, Write, AskUserQuestion
---

# Workflow Issue → Branche → Commits → PR (sans worktree)

## Contexte (chargé à l'exécution)

- Répertoire : !`pwd`
- Branche courante : !`git branch --show-current 2>/dev/null`
- Statut git : !`git status --short 2>/dev/null | head -10`
- Branche par défaut : !`gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null`
- Issue templates : !`ls .github/ISSUE_TEMPLATE/ 2>/dev/null || echo "aucun"`
- CONTRIBUTING.md : !`test -f CONTRIBUTING.md && echo "présent" || echo "absent"`
- PR template : !`test -f .github/PULL_REQUEST_TEMPLATE.md && echo "présent" || echo "absent"`

## Arguments

`$ARGUMENTS` → description libre de la tâche (sert à proposer un titre d'issue, un type et un slug de branche).

## Rôle

Tu orchestres le workflow **Issue → Branche → Commits → Push → PR** dans le checkout courant (pas de worktree), en respectant les conventions locales détectées ci-dessus. Tu suis exactement les étapes 0 → 6 ci-dessous, **confirme l'artefact produit avant de passer à la suivante**, et stoppe net si la requête est ambiguë.

⚠️ **Plan d'action obligatoire avant l'étape 1 si la tâche est floue.**

## Procédure

### Étape 0 — Pré-vol (silencieuse)

- Lis `CONTRIBUTING.md` si présent (branch + commit conventions).
- Lis `.github/PULL_REQUEST_TEMPLATE.md` si présent.
- Liste `.github/ISSUE_TEMPLATE/` et choisis le template adapté à `$ARGUMENTS`.
- **Vérifie que le working tree est clean.** Si dirty : stoppe et demande à l'utilisateur de stash/commit/discard avant de continuer (sinon la nouvelle branche embarquera des changes non liés).

Conventions par défaut (si pas de `CONTRIBUTING.md`) :
- Branches : `<type>/#<issue>-<slug>` (types : `feat`, `fix`, `hotfix`, `docs`, `test`, `refactor`, `chore`, `perf`, `ci`, `build`)
- Commits : Gitmoji + Conventional Commits

### Étape 1 — Créer l'issue GitHub

```bash
gh issue create \
  --title "<titre impératif court>" \
  --body  "<body Markdown qui colle aux sections du template>" \
  --label "<label-type>"
```

→ **Note `#N`** et affiche l'URL.

### Étape 2 — Créer la branche depuis la branche par défaut à jour

```bash
DEFAULT=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)
git fetch origin "$DEFAULT"
git checkout "$DEFAULT"
git pull --ff-only origin "$DEFAULT"

# Convention gwm-cli (à adapter selon CONTRIBUTING.md) :
git checkout -b "<type>/#<N>-<slug>"
```

⚠️ Certains repos utilisent `dev` (pas `main`) comme branche d'intégration — gwm-cli est un exemple. Honore toujours ce que `defaultBranchRef` retourne.

Affiche le nom de branche et la base depuis laquelle elle est partie.

### Étape 3 — Implémenter + commits atomiques groupés par thème

Découpe par **concern**, pas par fichier ni chronologie. Un commit = un thème :

- `refactor` — restructuration sans changement de comportement
- `feat` — la nouvelle capacité
- `test` — tests pour cette capacité
- `docs` — README / CHANGELOG / doc inline
  - **CHANGELOG layout** : la racine `CHANGELOG.md` ne contient que la section `## [Unreleased]` en cours + un index `## Past releases` qui pointe vers `changelogs/<version>.md`. Une feature en cours ajoute son entrée sous `[Unreleased] > Added/Changed/Fixed/Docs/Dependencies`. À la promotion stable (release stable depuis `dev`), la section `[Unreleased]` migre vers un nouveau fichier `changelogs/<version>.md` (heading `# [<version>] - YYYY-MM-DD`), et le root CHANGELOG redémarre avec un `[Unreleased]` vide.

Format commit (gwm-cli) :

```
<emoji> <type>(<scope>)<!>: <subject>

<corps optionnel>

refs #N            # commits intermédiaires
closes #N          # UNIQUEMENT sur le dernier
```

Emojis principaux : ✨ feat, 🐛 fix, ♻️ refactor, ✅ test, 📝 docs, 🔧 chore, 🏗️ build, 👷 ci, ⚡ perf, 🚑️ hotfix, 🔥 chore(remove), ⬆️ chore(bump), 🔒 security.

Scopes (gwm-cli) : `config`, `naming`, `worktree`, `bootstrap`, `cli`, `tui`, `tests`, `docs`, `ci`, `structure` — adapte au repo courant.

Breaking changes : `!` après le type + footer `BREAKING CHANGE:`.

Si `/sc:git` est disponible et adapté, délègue-lui le groupement. Sinon, stage les hunks manuellement (jamais `git add -A` si le diff traverse plusieurs thèmes).

**⚠️ Drift de version du formatter.** Si la commande de format télécharge sa dernière version (ex. `composer format` → dernier Mago, `bun`/`npm` → Prettier/Biome plus récent), elle peut reformater **tout le repo** si cette version diffère de celle qui a formaté la branche. Après format : `git status`, et **reverte tout fichier non touché** (`git add` tes fichiers réels, puis `git checkout -- .`). Le **hook pre-commit** (qui ne formate que le staged) est la source de vérité plus sûre.

Affiche `git log --oneline @{u}..HEAD` après chaque commit.

### Étape 4 — Push + PR

```bash
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"
```

Lis `.github/PULL_REQUEST_TEMPLATE.md` et remplis **toutes** les sections honnêtement.

```bash
gh pr create \
  --title "<emoji> <type>(<scope>): <subject>" \
  --body  "$(cat <<'EOF'
## Description

<résumé court>

Closes #N

## Type of change
- [x] ✨ Feature

## Changes
- <changement 1>

## Tests
- [x] tests locaux OK
- [x] lint OK

## Checklist
- [x] Branch follows `<type>/#<issue>-<description>`
- [x] Commits follow Gitmoji + Conventional Commits
- [x] CHANGELOG.md updated under `## [Unreleased]` (root file = current release only; past versions live under `changelogs/<version>.md`)

## Linked issues / docs
- Issue: #N
EOF
)"
```

Si le repo target une branche autre que `main` (gwm-cli vise `dev`), ajoute `--base <branche>`.

→ **Affiche l'URL finale de la PR.**

### Étape 5 — Review de la PR

Source de review **par défaut** : la boucle **`/me:loop:claude-review-pr`** (agent Claude en contexte **frais**, auto-cadencé — corrige les findings bloquants pertinents P0/P1/P2 jusqu'à clean, max 8 itérations, analyse de convergence). PR sensible → doubler avec `/me:loop:codex-review-pr` (reviewer **tiers**). En mode branche, tu es déjà sur la branche feature dans le checkout courant — lance-la directement :

```bash
/me:loop:claude-review-pr
```

En **second plan**, l'utilisateur déclenche `/me:check-reviews [PR#]` **manuellement** selon le besoin (cascade interne cloud/CLI/bots).

Puis, review propre, **`/me:loop:ci-until-green`** : il lit les checks du **SHA exact** de `HEAD` (pas « la branche »), refuse de conclure tant que quelque chose n'est pas poussé, et ne lit jamais « zéro check » comme une CI verte. Ne pas merger avant `CI_FAILED=0 CI_PENDING=0` avec `CI_TOTAL ≥ 1`.

⚠️ La boucle review l'arbre du **répertoire courant** sur la **branche courante** : assure-toi de rester sur la branche de la PR (pas de retour sur `main`/`dev`) avant de la lancer.

### Étape 6 — La note dans le vault, **au merge, pas au commit**

Une fois la PR **mergée**, écris **une** note. C'est le seul moment où le contexte est frais et
où git ne le garde pas : pourquoi cette solution, ce que la review a attrapé qui vaut au-delà
de la PR, ce qui est reporté. `RULES.md` l'impose ; rien d'autre dans ce flow ne la produit.

**Quel vault** — par sujet : Jewely / Flippad / clients → `~/Vault/pro`, projets perso →
`~/Vault/perso`.

**Quel template** — le tableau d'options tranche :

| La PR était… | Template | Où |
|:---|:---|:---|
| un arbitrage — des options ont été départagées | `Template — Décision.md` | `<entité>/decisions/` |
| une leçon — pas d'options, quelque chose qu'on n'avait pas vu | `Template — Retex.md` | `<entité>/decisions/` |

```bash
VAULT=~/Vault/pro                      # ou perso
ls "$VAULT/99 - Meta/"                 # les templates
cat "$VAULT/AGENTS.md"                 # placement + règles de frontmatter
grep -rl "<nom-du-repo>" "$VAULT" --include='*.md' --exclude-dir='99 - Meta'   # la note d'entité à lier
```

Lis le template **avant** d'écrire, puis écris avec `Write` au chemin du vault — ne dépends pas
du MCP tolaria, son sidecar casse après chaque auto-update de l'app.

⛔ **Jamais** dans la note : le changelog, la doc technique du dépôt, une tâche, une procédure.
Chacun a déjà son lieu de vérité (`changelogs/`, `<repo>/docs/` via graphify, les issues GitHub,
`~/.claude/skills/me/*`). Le vault est mort une première fois parce qu'il redoublait git.
**Quote toutes les valeurs de chaîne** du frontmatter — une valeur non quotée contenant `:` ou
`#` casse le parseur YAML de tolaria sur tout le vault.

Si la leçon vaut **au-delà de ce dépôt**, elle est promue en note permanente (`04 - Permanent/`
en perso, un cran au-dessus en pro) — le retex reste où il est et la lie.

## Garde-fous

- ⚠️ Stoppe et re-planifie si la requête est ambiguë.
- ⚠️ La note du vault s'écrit **au merge**, jamais au commit — et jamais deux fois pour la même PR.
- ⚠️ Jamais de commit direct sur `main` / `master` / `dev` — feature branch obligatoire.
- ⚠️ Working tree **doit** être clean à l'étape 0 — sinon stop.
- ⚠️ Toujours partir de la branche par défaut **à jour** (`git pull --ff-only` avant `git checkout -b`).
- ⚠️ Jamais squash, jamais delete-branch au merge.
- ⚠️ Jamais d'invention de body d'issue template — si rien ne colle, écris un Markdown propre et signale-le.
- ⚠️ `refs #N` sur les intermédiaires, `closes #N` uniquement sur le dernier commit.
- ⚠️ Un `format` repo-wide peut reformater des fichiers hors de ton change (drift de version) — reverte les reformats non liés avant de commit.

## Récap final attendu

| Étape | À afficher                                |
|:------|:------------------------------------------|
| 0     | Conventions + branche par défaut détectées |
| 1     | URL + `#N`                                |
| 2     | Branche créée + base                      |
| 3     | `git log --oneline @{u}..HEAD`            |
| 4     | Push confirmé + URL PR                    |
| 5     | Review lancée (`/me:loop:claude-review-pr`) |
| 6     | Chemin de la note vault + template utilisé |
