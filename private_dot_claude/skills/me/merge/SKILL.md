---
name: me:merge
description: "Merger la PR de la branche courante sur sa base (dev), fermer l'issue liée, remettre le checkout principal à jour sans écraser ses commits locaux, et écrire la note vault que RULES.md impose au merge. Clôt le workflow /me:issue-worktree-pr après les loops de review et de CI. Triggers: /me:merge, merge la PR, merge sur dev, mergez sur dev et update dev local, clôturer la PR, finir la PR."
---

# me:merge — clore une PR proprement

Dernière étape du flow `/me:issue-worktree-pr` (ou `-branch-`), **après** `/me:loop:claude-review-pr` et `/me:loop:ci-until-green`. Ne fait qu'une chose : transformer une PR verte en `dev` à jour, sans rien perdre en route.

`$ARGUMENTS` = numéro de PR optionnel. Sans argument, la PR de la branche courante (`gh pr view`).

## ⛔ Les quatre pièges, dans l'ordre où ils mordent

1. **`--squash` et `--delete-branch` sont interdits** sur mes repos (préférence explicite). `gh pr merge --merge`, point.
2. **`Closes #N` ne ferme rien quand la base n'est pas la branche par défaut.** GitHub ne ferme une issue que sur un merge vers la **default branch**. Mes repos mergent vers `dev` alors que le défaut est `main` : l'issue reste ouverte jusqu'à la release. → la fermer **à la main**.
3. **Le checkout principal peut porter des commits locaux non poussés.** Un `pull` aveugle crée un merge parasite ; un `pull --rebase` sur des commits **déjà poussés** réécrit de l'histoire partagée. → tester avant de choisir.
4. **La note vault s'écrit au merge, jamais au commit.** Seul moment où le contexte est frais et où git ne le garde pas. Rien d'autre dans le flow ne la produit.

## Étape 1 — Pré-vol

```bash
gh pr view --json number,state,mergeable,mergeStateStatus,baseRefName,headRefName \
  -q '"#\(.number) \(.state) mergeable=\(.mergeable) status=\(.mergeStateStatus) \(.headRefName) → \(.baseRefName)"'
git status --short          # doit être clean (untracked toléré)
git log --oneline @{u}..HEAD   # doit être VIDE — tout est poussé
```

Stop si : pas de PR · `state != OPEN` · `mergeable != MERGEABLE` · du travail non poussé.

Diff qui touche au rendu : `~/.claude/skills/me/report/collect.py` doit dire `CAPTURES n (0 en retard)`, et le corps de la PR pointe vers ces captures (`$(~/.claude/skills/me/report/collect.py --dir)/captures/`), jamais vers `/tmp`. Sinon `capture.mjs --stale` puis `gh pr edit --body-file`, avant de merger.

**CI rouge — décision explicite, jamais un contournement tacite.** Le défaut est de refuser. On ne merge sur du rouge qu'après avoir **prouvé que le job ne démarre pas**, ce qui n'est pas un échec de code :

```bash
gh pr checks <N>
gh api repos/<owner>/<repo>/actions/jobs/<jobId> --jq '{name, conclusion, steps: (.steps|length)}'
gh run view --job <jobId> --log-failed | head -5
```

`steps: 0` + durée de 2-3 s + `log not found` = le runner n'a jamais démarré (quota / infra). Recouper avec `gh run list --branch <base>` : si le dernier vert date d'il y a des semaines, c'est l'environnement, pas la PR. **Dans ce cas seulement**, merger en le disant, et en citant la validation qui remplace la CI (suite locale verte, lint clean). Toute autre couleur de rouge : stop, `/me:loop:ci-until-green`.

## Étape 2 — Merge

```bash
gh pr merge <N> --merge      # ⛔ jamais --squash, jamais --delete-branch
gh pr view <N> --json state,mergeCommit -q '"\(.state) commit=\(.mergeCommit.oid[0:8])"'
```

## Étape 3 — Fermer l'issue (piège 2)

Récupérer le numéro depuis le corps de la PR (`Closes #N`) ou le nom de branche (`<type>/#N-slug`).

```bash
gh issue view <N> --json state -q .state    # OPEN si la base n'est pas la default branch
gh issue close <N> --comment "Corrigé par #<PR>, mergée sur \`<base>\` en \`<sha>\`. …"
```

Le commentaire porte ce que l'issue seule ne dira plus : **actions de déploiement** (migrations, rebuild d'index, seeders, templates chez un fournisseur, commandes à lancer) et **ce qui reste à trancher côté client**. C'est ce que relira la personne qui déploie.

## Étape 4 — Checkout principal à jour (piège 3)

La skill tourne depuis le worktree ; le checkout principal est ailleurs. Utiliser `git -C`, jamais `cd` (le cwd est réinitialisé entre deux Bash de toute façon).

```bash
ROOT=$(git rev-parse --path-format=absolute --git-common-dir | xargs dirname)
BASE=$(gh pr view <N> --json baseRefName -q .baseRefName)

git -C "$ROOT" rev-parse --abbrev-ref HEAD    # sur $BASE ? sinon le signaler, ne pas switcher d'office
git -C "$ROOT" status --short                 # un fichier TRACKÉ modifié fait échouer le pull au milieu → stop
git -C "$ROOT" fetch origin "$BASE"

if [ -z "$(git -C "$ROOT" log --oneline @{u}..HEAD)" ]; then
  git -C "$ROOT" pull --ff-only origin "$BASE"     # aucun commit local : rien à réécrire
else
  git -C "$ROOT" log --oneline @{u}..HEAD          # les ANNONCER avant de les rejouer
  git -C "$ROOT" pull --rebase origin "$BASE"      # sûr : non poussés par définition de @{u}..HEAD
fi

git -C "$ROOT" log --oneline -5
git -C "$ROOT" status -sb | head -1
```

Puis **vérifier que le code mergé est réellement là** — une ligne, elle attrape le merge qui a silencieusement raté :

```bash
git -C "$ROOT" log --oneline | grep -q "<sha du merge>" && echo "✓ merge présent"
```

## Étape 5 — La note vault

`RULES.md` l'impose **au merge**. Une seule note, jamais deux pour la même PR.

**Quel vault** — par sujet : travail (employeur, clients) → `~/Vault/pro`, perso → `~/Vault/perso`. L'`AGENTS.md` de chaque vault dit lesquels.

**Quel template** :

| La PR était… | Template | Où |
|:---|:---|:---|
| un arbitrage — des options ont été départagées | `Template — Décision.md` | `<entité>/decisions/` |
| une leçon — pas d'options, quelque chose qu'on n'avait pas vu | `Template — Retex.md` | `<entité>/decisions/` |

```bash
VAULT=~/Vault/pro
cat "$VAULT/AGENTS.md"                 # placement + frontmatter (lire AVANT d'écrire)
cat "$VAULT/99 - Meta/Template — Retex.md"
ls "$VAULT/01 - <Produit>/decisions/" | tail -5    # le style des voisines
```

Écrire avec `Write` directement au chemin du vault — ne pas dépendre du MCP tolaria, son sidecar casse après chaque auto-update de l'app.

**Le titre est la leçon, pas le sujet** : une assertion contredisable. Préfixe date obligatoire : `2026-09-09 — <assertion>.md`.

⛔ **Jamais dans la note** : changelog, doc technique du dépôt, tâche, procédure — chacun a son lieu de vérité. **Quoter toutes les valeurs de chaîne** du frontmatter : une valeur non quotée contenant `:` ou `#` casse le parseur YAML de tolaria sur tout le vault.

Descendre au **plus précis qui reste vrai** : dépôt → produit → org (le dossier `decisions/` de l'organisation, seul chemin qui décloisonne les silos). En cas de doute, monter d'un cran. Une leçon ne monte à l'org qu'à la **deuxième occurrence sur un sujet sans rapport** — une seule, c'est un accident, pas un motif.

## Ce que cette skill ne fait pas

- **Pas de `gwm remove`** du worktree : le nettoyage est une décision séparée, et un worktree gardé ne coûte que du disque.
- **Pas de review ni d'attente de CI** : c'est le rôle de `/me:loop:claude-review-pr` et `/me:loop:ci-until-green`, qui viennent **avant**.
- **Pas de bump ni de release** : `/me:release`.

## Récap attendu

| Étape | À afficher |
|:--|:--|
| 1 | verdict CI (verte, ou rouge **prouvée** infra avec ses chiffres) |
| 2 | SHA du merge |
| 3 | issue fermée + actions de déploiement listées |
| 4 | `git log --oneline -5` du checkout principal + sa position (`ahead/behind`) |
| 5 | chemin de la note + template utilisé |
