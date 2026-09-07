---
name: issue-worktree-pr
description: "Workflow complet Issue → Worktree (gwm) → Commits atomiques → Push → PR"
category: workflow
complexity: standard
argument-hint: "[description courte de la tâche]"
allowed-tools: Bash(gh :*), Bash(git :*), Bash(gwm :*), Bash(ls :*), Bash(test :*), Bash(cat :*), Bash(grep :*), Bash(pwd), Read, Glob, Write, AskUserQuestion
---

# Workflow Issue → Worktree → Commits → PR

## Contexte (chargé à l'exécution)

- Répertoire : !`pwd`
- Branche courante : !`git branch --show-current 2>/dev/null`
- Statut git : !`git status --short 2>/dev/null | head -10`
- Branche par défaut : !`gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null`
- Issue templates : !`ls .github/ISSUE_TEMPLATE/ 2>/dev/null || echo "aucun"`
- CONTRIBUTING.md : !`test -f CONTRIBUTING.md && echo "présent" || echo "absent"`
- PR template : !`test -f .github/PULL_REQUEST_TEMPLATE.md && echo "présent" || echo "absent"`
- .gwm.toml : !`test -f .gwm.toml && echo "présent (bootstrap actif)" || echo "absent (worktree nu)"`
- gwm installé : !`command -v gwm >/dev/null && gwm --version || echo "MANQUANT — installer avant de continuer"`

## Arguments

`$ARGUMENTS` → description libre de la tâche (sert à proposer un titre d'issue, un type et un slug de branche).

## Rôle

Tu orchestres le workflow complet **Issue → Worktree → Commits → Push → PR** en respectant les conventions locales détectées ci-dessus. Tu suis exactement les étapes 0 → 8 ci-dessous, **confirme l'artefact produit avant de passer à la suivante**, et stoppe net si la requête est ambiguë.

⚠️ **Plan d'action obligatoire avant l'étape 1 si la tâche est floue** (type de change incertain, scope multiple, intention pas claire).

## Procédure

### Étape 0 — Pré-vol (silencieuse)

À partir du contexte ci-dessus :
- Lis `CONTRIBUTING.md` (sections branch/commit) si présent.
- Lis `.github/PULL_REQUEST_TEMPLATE.md` si présent.
- Liste les fichiers de `.github/ISSUE_TEMPLATE/` et choisis le plus pertinent pour `$ARGUMENTS`.
- Si `gwm` est manquant : stoppe et demande à l'utilisateur d'installer `gwm` avant de continuer (`cargo install --path /path/to/gwm-cli` ou release binaire). **Ne pas** retomber sur `git worktree add` nu.

Conventions par défaut (si pas de `CONTRIBUTING.md`) :
- Branches : `<type>/#<issue>-<slug>` (types : `feat`, `fix`, `hotfix`, `docs`, `test`, `refactor`, `chore`, `perf`, `ci`, `build`)
- Commits : Gitmoji + Conventional Commits (`✨ feat(scope): subject`)

### Étape 1 — Créer l'issue GitHub

- Sélectionne le template d'issue le plus adapté parmi `.github/ISSUE_TEMPLATE/`.
- Construis un body Markdown qui colle aux sections du template (les `.yml` form-based deviennent du Markdown équivalent).
- Crée l'issue :

```bash
gh issue create \
  --title "<titre impératif court>" \
  --body  "<body Markdown>" \
  --label "<label-type>"      # feature / fix / docs / etc.
```

→ **Note `#N`** depuis l'URL retournée et affiche l'URL à l'utilisateur.

### Étape 2 — Déterminer le nom de branche

Format (gwm-cli default, à adapter selon `CONTRIBUTING.md`) :

```
<type>/#<N>-<slug-kebab-court>
```

Exemple : `feat/#42-tui-search`, `fix/#17-locked-worktree`.

Affiche le nom choisi et la source de la convention.

### Étape 3 — Créer le worktree propre via gwm

```bash
gwm create <type> <N> <slug>
```

`gwm` crée la branche, le worktree (sous `~/cc-worktree/<repo>/` par défaut), puis exécute le bootstrap `.gwm.toml` (copies `[[bootstrap.copy]]`, gardes regex `[[bootstrap.guard]]`, anti-symlinks `[[bootstrap.no_symlink]]`, hooks `[[bootstrap.command]]`).

Bascule dans le worktree pour tout le reste :

```bash
cd "$(gwm path <slug>)"
git status                              # DOIT être clean
git rev-parse --abbrev-ref HEAD         # DOIT être la nouvelle branche
```


**Attache cette session au nouveau worktree** (`gwm agents`, gwm ≥ 1.3.0). La session a démarré depuis le checkout principal — en général sur `dev` — donc gwm l'attribue *là*, et le worktree dans lequel elle bosse réellement n'affiche aucun agent. C'est précisément le cas d'usage du pin : il recouvre la détection quand le répertoire enregistré ne peut pas être le bon.

```bash
# Claude Code exporte l'id exact de la session — plus de devinette via `gwm agents`.
gwm agents attach <slug> "$CLAUDE_CODE_SESSION_ID"
```

Best-effort : si la variable est vide, on passe — `~/.claude/scripts/statusline.ts` pin la session tout seul dès qu'elle édite un fichier dans le worktree, donc un pin raté coûte un tour de visibilité dans `gwm agents` / la TUI, rien d'autre. Les pins s'accumulent, donc relancer est sans risque ; `gwm agents detach <slug>` les efface.

**Si le rapport bootstrap contient un `✗`** : stoppe, affiche les étapes en échec, ne code rien tant que ce n'est pas résolu.

(Voir la skill `gwm` pour le schéma complet de `.gwm.toml` et les sigils de rapport `✓ · ! ✗`.)

### Étape 4 — Implémenter + commits atomiques groupés par thème

Découpe les changements **par concern**, pas par fichier ni par chronologie. Un commit = un thème :

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

Si `/sc:git` est disponible et adapté, délègue-lui le groupement des commits. Sinon, stage les hunks manuellement (jamais `git add -A` si le diff traverse plusieurs thèmes).

**⚠️ Drift de version du formatter.** Si la commande de format télécharge sa dernière version (ex. `composer format` → dernier Mago, `bun`/`npm` → Prettier/Biome plus récent), elle peut reformater **tout le repo** si cette version diffère de celle qui a formaté la branche. Après format : `git status`, et **reverte tout fichier non touché** (`git add` tes fichiers réels, puis `git checkout -- .`). Une PR fix/feat ne doit jamais embarquer des reformats hors-scope. Le **hook pre-commit** (qui ne formate que le staged) est la source de vérité plus sûre — un `format` repo-wide manuel est souvent redondant et risqué.

Affiche `git log --oneline @{u}..HEAD` après chaque commit.

### Étape 5 — Push

```bash
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"
```

Le `-u` est nécessaire (première publication de la branche).

### Étape 6 — Créer la PR

Lis `.github/PULL_REQUEST_TEMPLATE.md` et remplis **toutes** les sections honnêtement (ne coche pas une case de test si tu ne l'as pas lancée).

```bash
gh pr create \
  --title "<emoji> <type>(<scope>): <subject>" \
  --body  "$(cat <<'EOF'
## Description

<résumé court>

Closes #N

## Type of change
- [x] ✨ Feature  (ou autre)

## Changes
- <changement 1>
- <changement 2>

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

Si le repo target une branche autre que `main` pour les PR feature (gwm-cli vise `dev`), ajoute `--base <branche>`.

→ **Affiche l'URL finale de la PR.**

### Étape 7 — Review de la PR

Source de review **par défaut** : la boucle **`/me:loop:claude-review-pr`** (agent Claude en contexte **frais**, auto-cadencé — corrige les findings bloquants pertinents P0/P1/P2 jusqu'à clean, max 8 itérations, analyse de convergence). PR sensible → doubler avec `/me:loop:codex-review-pr` (reviewer **tiers**). Lance-la **depuis le worktree**, jamais le checkout principal :

```bash
cd "$(gwm path <slug>)"   # OBLIGATOIRE avant la review
/me:loop:claude-review-pr
```

En **second plan**, l'utilisateur déclenche `/me:check-reviews [PR#]` **manuellement** selon le besoin (cascade interne cloud/CLI/bots).

Puis, review propre, **`/me:loop:ci-until-green`** depuis le même worktree : il lit les checks du **SHA exact** de `HEAD` (pas « la branche »), refuse de conclure tant que quelque chose n'est pas poussé, et ne lit jamais « zéro check » comme une CI verte. Ne pas merger avant `CI_FAILED=0 CI_PENDING=0` avec `CI_TOTAL ≥ 1`.

La boucle et `/me:check-reviews --local` reviewent le checkout du **répertoire courant** contre sa base. Lancés depuis le checkout principal (resté sur `dev`/`main`, possiblement avec d'autres fichiers non commités), ils reviewent le mauvais arbre et remontent du bruit hors PR. Préfère un scope `--base <branche-par-défaut>` à un scope en texte libre.

### Étape 8 — La note dans le vault, **au merge, pas au commit**

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
- ⚠️ Jamais de push direct sur `main` / `master` / `dev`.
- ⚠️ Jamais squash, jamais delete-branch au merge.
- ⚠️ Jamais d'invention de body d'issue template — si rien ne colle, écris un Markdown propre et signale-le.
- ⚠️ Un bootstrap `✗` = stop immédiat.
- ⚠️ `refs #N` sur les intermédiaires, `closes #N` uniquement sur le dernier commit.
- ⚠️ Un `format` repo-wide peut reformater des fichiers hors de ton change (drift de version) — reverte les reformats non liés avant de commit.
- ⚠️ Review IA qui lit l'arbre (boucle `/me:loop:claude-review-pr`, `/me:check-reviews --local`, companion Codex, CodeRabbit CLI) : **depuis le worktree**, jamais le checkout principal.

## Récap final attendu

| Étape | À afficher                                |
|:------|:------------------------------------------|
| 0     | Conventions détectées (1 ligne)           |
| 1     | URL + `#N`                                |
| 2     | Branche choisie + source convention       |
| 3     | Path worktree + rapport bootstrap verbatim |
| 4     | `git log --oneline @{u}..HEAD`            |
| 5     | Confirmation push                         |
| 6     | URL PR                                    |
| 8     | Chemin de la note vault + template utilisé |
