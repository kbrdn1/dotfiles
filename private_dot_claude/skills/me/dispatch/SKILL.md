---
name: me:dispatch
description: "Orchestre plusieurs issues en parallèle depuis Monocode : chaque issue dans son worktree gwm, créé d'abord, puis une session Monocode née dedans (app sessions.start + worktreeCwd), pour que Monocode suive diff, commits et historique de la bonne branche. Reprise du travail en cours (worktrees, PR ouvertes, issues), plan me:report en direct, merge progressif dans dev. Le parallèle demande un Mono de Monocode ; ailleurs, repli séquentiel dans la session. Triggers: /me:dispatch, dispatch, lancer les issues en parallèle, orchestrer dans Monocode, reprendre le travail en cours, reprendre le sprint."
---

# me:dispatch : une issue, un worktree, une session

Le lead (cette session, un Mono) ne code pas : il fait l'état des lieux, crée les worktrees, lance une
session par issue **dans** son worktree, suit, puis merge. Le code se fait dans les sessions lancées.

**Lance-moi depuis un Mono de Monocode.** Le CLI `app` ne répond que dans le processus d'un Mono.

Première chose, avant toute lecture du dépôt, la sonde :

```bash
APP='/Applications/Monocode Native.app/Contents/MacOS/monocode-gpui'
"$APP" app worktrees.list --json '{}'
```

- `{"ok":true,...}` : continuer à l'étape 0.
- `{"ok":false,"error":"App access is unavailable outside a Mono's provider process"}` (code 1) : on n'est pas dans
  un Mono. C'est le cas d'un `claude` lancé dans un terminal, dans Herdr (`__CFBundleIdentifier=dev.herdr.app`),
  et, d'après ce message, probablement aussi d'une session Operator (non vérifié). Le dire en une ligne, puis
  proposer le **repli séquentiel** (plus bas) dans cette session.

## 0. Smoke test (première fois, ou après une mise à jour de Monocode)

La voie entière repose sur `sessions.start` + `worktreeCwd`, jamais vérifiée de bout en bout. Avant le premier vrai
lancement :

1. `"$APP" app worktrees.list --json '{}'` : le worktree gwm visé y figure-t-il ? Sinon `worktreeCwd` sera refusé
   (« This path is not a registered worktree of this repository »).
2. Lancer une session jetable dans ce worktree : prompt `pwd && git branch --show-current, puis stop`,
   `"workspaceMode":"current"`, `"worktreeCwd":"<chemin>"`.
3. Vérifier dans Monocode que la session est rattachée au **worktree** (son diff, sa branche), pas au checkout
   principal. `gwm list --format=json` doit aussi voir la session sur le worktree, sans `gwm agents attach`.
4. Supprimer la session jetable (`sessions.stop` puis `sessions.delete`), rapporter le résultat.

Échec → ne rien lancer, rapporter l'erreur exacte (texte de `app`). Pas de repli sur `workspaceMode:"worktree"` :
il crée un worktree hors gwm, sans bootstrap `.gwm.toml` ni `branch_pattern`.

## 1. État des lieux (reprise du travail en cours)

Depuis le checkout principal du dépôt, en lecture seule. `<owner>/<repo>` vient de GitHub, jamais du nom du
dossier : `k-hub` est le dépôt `kbrdn1/kbrdn-hub`, et un `gh api repos/<dossier>/…` prend un 404.

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)   # owner/repo ; ~/Reports/<owner>-<repo>/ en découle
gwm list --format=json                                   # worktrees, branches <type>/#N-slug, agents
gh pr list --state open --json number,title,body,headRefName,isDraft,author,statusCheckRollup,reviewDecision
gh issue list --state open --json number,title,labels,body
ls ~/Reports/<owner>-<repo>/plans/ 2>/dev/null           # plan me:report existant : sa notes.json fait foi
```

**Dépendances : lire l'issue ET le corps de sa PR**, pas seulement « bloquée par #N ». Une dépendance s'écrit
aussi « après le merge de #N », « empilée sur #N », « en deux étapes », « étape 2 : … après #N ». Les cases non
cochées de la PR (`- [ ]`) disent ce qui manque encore. Une PR qui ferme l'issue (`Closes #N`) peut n'en livrer
qu'une étape : c'est une **PR partielle**, pas une PR prête.

Classer chaque élément, une ligne chacun :

| état | signe | action |
|---|---|---|
| en review | PR ouverte, complète | session dans son worktree : review (`/me:loop:claude-review-pr`), CI, prête à merger |
| PR partielle | PR ouverte dont l'issue ou le corps annonce une étape après #M, ou des cases non cochées | review de ce qui existe ; pas de merge avant #M et l'étape finale ; la passe de convergence attend la forme finale |
| à reprendre | worktree sans PR | session dans son worktree : reprendre où ça s'est arrêté |
| à démarrer | issue ouverte, dépendances faites, ni worktree ni PR | worktree puis session |
| bloquée | une dépendance ouverte | rien, elle partira quand la dépendance sera mergée |
| dépendances | PR de bot (dependabot) | le lead : CI verte du sha exact puis merge, sinon une session |

Présenter le tableau et le plan de lancement, puis demander une seule confirmation (choix : tout lancer, en
choisir, ajuster). Si l'utilisateur a déjà dit d'y aller, lancer directement.

## 2. Worktree d'abord, idempotent

- Worktree présent : le réutiliser (`gwm path <slug>`).
- PR sans worktree : branche locale présente → `gwm create <type> <N> <slug> --reuse-branch --allow-bootstrap` ;
  sinon `gwm review <PR#> --bootstrap`, qui matérialise la PR dans un worktree. Le bootstrap est coupé par défaut,
  par prudence envers les forks : on l'active seulement pour nos propres PR.
- Rien : `gwm create <type> <N> <slug> --allow-bootstrap` (bootstrap `.gwm.toml` compris).
- `--allow-bootstrap` est obligatoire hors TTY : sans lui, le prompt de confiance (TOFU) de gwm attend une
  réponse que personne ne donnera.
- Puis vérifier qu'il apparaît dans `"$APP" app worktrees.list --json '{}'`.

**Worktree neuf = pas prêt.** Juste sorti de `gwm create`, il n'a souvent ni dépendances (`node_modules`), ni
`.env`, et les services de dev peuvent être arrêtés. Si le bootstrap `.gwm.toml` ne le fait pas, avant toute gate
ou test : installer les dépendances avec la commande du projet (k-hub : `nix develop -c bun install`), démarrer
les services depuis le checkout principal (`docker compose up -d --wait`), et reprendre les variables (ex.
`DATABASE_URL`) du `.env` du checkout principal. Le dire dans le prompt de la session.

Jamais deux sessions sur le même worktree. Au plus 3 sessions en vol, et pas deux issues qui touchent les mêmes
fichiers en même temps : sérialiser celles-là.

## 3. Une session par issue, née dans son worktree

```bash
"$APP" app sessions.start --json "$(jq -n --arg p "$PROMPT" --arg cwd "$WT" --arg t "#$N $SLUG" \
  '{prompt:$p, title:$t, workspaceMode:"current", worktreeCwd:$cwd, notifyOnComplete:true}')"
```

`notifyOnComplete` est réservé aux Monos : s'il est refusé, relancer sans et suivre avec `sessions.list`, à la
demande de l'utilisateur seulement (jamais en boucle). La session hérite du harness et du modèle du lead.

Prompt d'une session (à compléter, ne rien laisser d'implicite) :

```
Issue #<N> (<titre>) du dépôt <owner/repo>. Tu es dans son worktree <chemin>, branche <branche>, déjà prêt :
ne crée ni issue ni worktree. <État : « PR #<P> ouverte » | « commits sans PR » | « rien encore »>.
Suis le workflow worktree (skill git-flow-worktree) à partir de là :
- reprise : lis l'issue, git log <base>..HEAD, et le rapport ~/Reports/<owner>-<repo>/<branche>/ s'il existe ;
- implémentation : commits atomiques Gitmoji + Conventional qui référencent #<N> ;
- entrée en review : /me:report, puis PR depuis le template du dépôt si elle n'existe pas ;
- /me:loop:claude-review-pr jusqu'à 0 bloquant pertinent, puis /me:loop:ci-until-green ;
- ne merge pas : le lead s'en charge.
Fin : un résumé court (PR, review, CI, points ouverts, ce qui demande l'utilisateur).
```

Après les lancements : dire en une ligne ce qui part où, puis **finir le tour**. Ne jamais poller.

## 4. Plan en direct (me:report)

Écrire ou mettre à jour `notes.json` du plan (`issues` avec `deps`, voir la skill `me:report`, mode plan) puis :

```bash
~/.claude/skills/me/report/collect.py --plan <slug>   # depuis le dépôt ; donne le chemin de la page
```

Chaque collecte de branche (les loops de review et de CI des sessions la lancent) relit ce plan : le kanban
avance tout seul. Monocode n'affiche pas de HTML : donner le chemin de la page à l'utilisateur.

## 5. Au retour d'une session

1. Lire son résumé, vérifier sur pièces : `gh pr view <P> --json state,reviewDecision,statusCheckRollup`,
   et la section review du rapport de la branche.
2. Prête (0 bloquant pertinent, CI verte du sha exact) : `/me:merge` depuis son worktree, merge dans `dev`.
3. `collect.py --plan <slug>`, puis lancer les issues que ce merge débloque (étapes 2 et 3).
4. Conflit au merge : le résoudre dans le worktree de la branche, jamais sur `dev` directement.

## Repli séquentiel (hors Mono)

Même état des lieux (étape 1), puis le lead fait le travail lui-même, un élément après l'autre, dans l'ordre du plan.

**Le cwd ne tient pas.** Dans Claude Code, un `cd` vers `../<repo>-worktrees/…` est annulé à l'appel Bash suivant :
le worktree est hors du répertoire de travail, le shell revient à la racine du dépôt. Chaque commande, et chaque
commande des loops (review, CI, merge, report), commence donc par `cd "$WT" &&`. Sans ce préfixe, un loop qui lit
« la branche courante » lit `dev`. Au début de chaque élément :

```bash
WT=$(gwm path <slug>)
gwm agents attach <slug> "$CLAUDE_CODE_SESSION_ID"   # rattache cette session au worktree (gwm, pane Agents)
```

- **PR en review** : son worktree (sinon le créer comme à l'étape 2), puis `/me:loop:claude-review-pr`,
  `/me:loop:ci-until-green` et `/me:merge` quand tout est vert, chaque commande préfixée par `cd "$WT" &&`.
- **Worktree sans PR** : reprendre dans le worktree (issue, `git log <base>..HEAD`, rapport), finir
  l'implémentation, `/me:report`, PR depuis le template, puis comme une PR en review.
- **Issue à démarrer** : `/me:issue-worktree-pr` (il crée le worktree ; l'issue existe déjà, le lui dire).
- **PR de bots** : voir plus bas.

Après chaque merge : `collect.py --plan <slug>`, puis l'élément suivant que ce merge débloque.

## PR de bots (dependabot)

Le lead les traite lui-même, sans worktree.

1. Checks du sha exact : `gh api repos/$REPO/commits/<sha>/check-runs`.
2. **Un check rouge ne veut pas dire du code cassé.** Avant de conclure, lire ses annotations :
   `gh api repos/$REPO/check-runs/<id>/annotations`. Un job **jamais démarré** (« The job was not started because
   recent account payments have failed or your spending limit needs to be increased », runner absent) se
   relance **une fois** (`gh run rerun <run-id>`) : ce n'est pas un re-run à l'aveugle, rien n'a tourné. Le
   signaler à l'utilisateur s'il échoue encore pour la même raison.
   Un échec réel : regarder d'où il vient. Une **incompatibilité amont** (exemple vécu : TypeScript 7 ne livre
   plus `lib/tsc`, `vue-tsc` casse) n'est pas un bug à corriger dans la PR du bot : c'est une **décision de
   l'utilisateur**, à lui poser avec ses options (ignorer cette majeure dans la config dependabot, fermer la PR,
   ou ouvrir une issue de migration). Un échec dans notre code : une session, ou signaler.
3. Merge en figeant le sha vérifié : `gh pr merge <P> --merge --match-head-commit <sha>`. Si le bot pousse entre
   la vérification et le merge, GitHub refuse : on revérifie, on ne force pas.

## Garde-fous

- Jamais sur `main` / `master`. Merge dans `dev` seulement, et seulement quand la review et la CI le disent.
- Ne jamais écrire dans les stores de Monocode (monos, réglages) : passer par `app`.
- Les PR de bots ne contournent pas la CI : sha exact vert, sinon une session les traite.
- Les règles du dépôt passent avant le merge automatique : une PR que le `CLAUDE.md` ou la mémoire du projet
  soumet à un accord (visuel, client) s'arrête avant `/me:merge` et attend l'utilisateur. L'ordre qu'il donne
  passe avant celui du plan.
- Une session qui échoue ou se bloque : la signaler à l'utilisateur, ne pas la relancer à l'aveugle.
- Budget de review : une PR partielle ne brûle pas ses passes suivantes sur une version intermédiaire ; sa passe
  de convergence attend qu'elle soit complète.
