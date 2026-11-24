---
name: me:dispatch
description: "Orchestre un gros chantier en hiérarchie d'agents avec Herdr Core (hc) : le lead (cette session) lance un worker Claude par issue, chacun dans son worktree gwm créé d'abord (hc run --cwd), le worker lance ses propres helpers (reviewers), et hc remonte les nouvelles au parent (fin de tour, blocage, erreur) sans rien surveiller. Reprise du travail en cours (worktrees, PR ouvertes, issues), plan me:report en direct, merge progressif dans dev. Demande une session lancée dans un terminal hc (Herdr) ; ailleurs, repli séquentiel. Triggers: /me:dispatch, dispatch, lancer les issues en parallèle, orchestrer avec hc, hiérarchie d'agents, gros chantier, reprendre le travail en cours, reprendre le sprint."
---

# me:dispatch : une hiérarchie d'agents avec hc

Trois niveaux, chacun ne parle qu'à son parent :

| niveau | qui | fait |
|---|---|---|
| lead | cette session | état des lieux, worktrees, lancement des workers, merge dans `dev` |
| worker | un Claude par issue, dans son worktree | implémentation, rapport, review, CI ; ne merge pas |
| helper | lancé par un worker | une tâche bornée (reviewer tiers, tests longs), puis rend la main |

`hc` (Herdr Core) garde les terminaux vivants et connaît la parenté : un terminal lancé depuis un autre en est
l'enfant, et hc **tape une note chez le parent** quand un enfant finit un tour, se bloque, plante ou sort. C'est
le réveil du lead : il lance, rend la main, et la note le relance. Jamais de `sleep`, jamais de sondage en boucle.

**Lance-moi depuis une session Claude ouverte dans Herdr** (donc dans un terminal hc). La sonde :

```bash
test -n "${HC_TERMINAL_ID:-}" && hc get "$HC_TERMINAL_ID" --json   # ma propre adresse : le parent des workers
```

- Vrai : continuer. `hc <commande> --help` fait foi sur la syntaxe ; `hc ls`, `hc get`, `hc read` sont sûrs.
- Faux : on n'est pas dans un terminal hc. Le dire en une ligne, puis proposer le **repli séquentiel** (plus bas).

## 0. Lancer un agent avec hc : ce qui a été vérifié (2026-11-18)

```bash
hc run --bg --name <nom> --cwd "$WT" --outlive-parent --label <k=v>… env PATH="$PATH" claude <options>
hc wait <nom> --timeout 60                    # jusqu'à l'invite prête (inactivité de démarrage)
hc send <nom> "$TACHE"                        # la tâche ; « --wait » pour attendre la fin de ce tour
```

- **`env PATH="$PATH"`** : sans lui, l'agent tourne avec le `PATH` du serveur hc, sans le profil nix. Tous les
  hooks (`node: command not found`) et `bun` échouent. hc reconnaît l'agent quand même (`status.app: claude-code`).
- **La tâche par `hc send`, pas en argument de `claude`.** Passée en argument, elle est bien traitée, mais `hc wait`
  rend la main sur l'inactivité du démarrage, avant le tour. Envoyée après le démarrage, c'est la tâche de
  lancement : hc suit le tour jusqu'au bout (`send --wait` revient sur `done`). L'agent la reçoit sous la forme
  `<hc from="<adresse du parent>">…</hc>`.
- **`--outlive-parent`** pour un worker : par défaut un enfant meurt avec son parent (`die_with_parent`), et un
  redémarrage du lead tuerait tout le chantier. Les helpers, eux, gardent le défaut.
- **Permissions** : passer au worker les mêmes options de permission que la session du lead (lisibles dans
  `hc get "$HC_TERMINAL_ID"` → `foreground.argv`), jamais davantage.
- `--name` : 1 à 32 caractères `a-z 0-9 - _`, unique parmi les terminaux vivants (`i51`, `i51-codex`).
  Labels : `sprint=<slug>`, `issue=<N>`, `role=worker|helper`, `repo=<owner-repo>` ; `hc ls --label sprint=<slug>`
  donne alors le chantier d'un coup.
- Nettoyage : `hc kill <nom>` puis `hc rm <nom>`, seulement pour ce que le lead a lancé.

## 1. État des lieux (reprise du travail en cours)

Depuis le checkout principal du dépôt, en lecture seule. `<owner>/<repo>` vient de GitHub, jamais du nom du
dossier : `k-hub` est le dépôt `kbrdn1/kbrdn-hub`, et un `gh api repos/<dossier>/…` prend un 404.

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)   # owner/repo ; ~/Reports/<owner>-<repo>/ en découle
gwm list --format=json                                   # worktrees, branches <type>/#N-slug, agents
hc ls --label repo=<owner-repo>                         # workers déjà lancés (ne pas en doubler un)
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
| en review | PR ouverte, complète | agent dans son worktree : review (`/me:loop:claude-review-pr`), CI, prête à merger |
| PR partielle | PR ouverte dont l'issue ou le corps annonce une étape après #M, ou des cases non cochées | review de ce qui existe ; pas de merge avant #M et l'étape finale ; la passe de convergence attend la forme finale |
| à reprendre | worktree sans PR | agent dans son worktree : reprendre où ça s'est arrêté |
| à démarrer | issue ouverte, dépendances faites, ni worktree ni PR | worktree puis agent |
| bloquée | une dépendance ouverte | rien, elle partira quand la dépendance sera mergée |
| attend un accord | PR prête que le dépôt ou l'utilisateur soumet à un accord (design, client) | captures dans le dossier du rapport, question à l'utilisateur ; merge seulement sur son « ok » |
| dépendances | PR de bot (dependabot) | le lead : CI verte du sha exact puis merge, sinon un agent |

Présenter le tableau et le plan de lancement, puis demander une seule confirmation (choix : tout lancer, en
choisir, ajuster). Si l'utilisateur a déjà dit d'y aller, lancer directement.

## 1b. Reprise après un redémarrage

Un redémarrage (machine, Claude Code, Herdr) arrête les agents en vol sans rapport, peut arrêter les services de dev
et **renomme toutes les sessions**. Avant de relancer quoi que ce soit :

1. Dans chaque worktree en vol : `cd "$WT" && git status && git log <dernier sha connu>..HEAD`. Un agent marqué
   « stopped » a souvent fini et commité : ne pas refaire son travail.
2. Services : `docker info`. S'il échoue, démarrer le runtime (ici OrbStack : `orb start`), puis
   `docker compose up -d --wait` depuis le checkout principal. Des tests rouges sur `docker.sock` introuvable ne
   viennent pas du code.
3. Destinataires : retrouver une session par son UUID dans `~/.claude/sessions/*.json` (`sessionId` → `name`),
   jamais par un nom gardé d'avant le redémarrage. Un message parti pendant la coupure peut être dans
   `~/Reports/_feedback/`. Côté hc, `hc ls` redonne les terminaux vivants ; les workers lancés avec
   `--outlive-parent` ont survécu au lead.

## 2. Worktree d'abord, idempotent

- Worktree présent : le réutiliser (`gwm path <slug>`).
- PR sans worktree : branche locale présente → `gwm create <type> <N> <slug> --reuse-branch --allow-bootstrap` ;
  sinon `gwm review <PR#> --bootstrap`, qui matérialise la PR dans un worktree. Le bootstrap est coupé par défaut,
  par prudence envers les forks : on l'active seulement pour nos propres PR.
- Rien : `gwm create <type> <N> <slug> --allow-bootstrap` (bootstrap `.gwm.toml` compris).
- `--allow-bootstrap` est obligatoire hors TTY : sans lui, le prompt de confiance (TOFU) de gwm attend une
  réponse que personne ne donnera.

**Worktree neuf = pas prêt.** Juste sorti de `gwm create`, il n'a souvent ni dépendances (`node_modules`), ni
`.env`, et les services de dev peuvent être arrêtés. Si le bootstrap `.gwm.toml` ne le fait pas, avant toute gate
ou test : installer les dépendances avec la commande du projet (k-hub : `nix develop -c bun install`), démarrer
les services depuis le checkout principal (`docker compose up -d --wait`), et reprendre les variables (ex.
`DATABASE_URL`) du `.env` du checkout principal. Le dire dans le prompt de l'agent.

**Hooks.** Les hooks Git du dépôt ne sont pas actifs dans un worktree neuf : un commit peut passer avec une erreur
de lint. À la création, activer les hooks versionnés s'il y en a (`git -C "$WT" config core.hooksPath .githooks`,
ou ce que fait le bootstrap pour Husky). Sinon, le prompt des agents impose lint et format:check avant chaque
commit.

Jamais deux agents sur le même worktree. Plusieurs **agents correcteurs** dans un même worktree, lancés par un
agent, passent si leurs fichiers sont disjoints et qu'ils commitent avec `git add <chemins>`, jamais `-A`. Au plus
3 agents en vol, et pas deux issues qui touchent les mêmes fichiers en même temps : sérialiser celles-là.

## 3. Un worker par issue, né dans son worktree

```bash
hc run --bg --name "i$N" --cwd "$WT" --outlive-parent \
  --label sprint="$SPRINT" --label issue="$N" --label role=worker --label repo="${REPO/\//-}" \
  env PATH="$PATH" claude <options de permission du lead>
hc wait "i$N" --timeout 60
hc send "i$N" "$PROMPT"            # sans --wait : le lead rend la main, la note de hc le réveillera
```

Prompt d'un worker (à compléter, ne rien laisser d'implicite) :

```
Issue #<N> (<titre>) du dépôt <owner/repo>. Tu es dans son worktree <chemin>, branche <branche>, déjà prêt :
ne crée ni issue ni worktree. <État : « PR #<P> ouverte » | « commits sans PR » | « rien encore »>.
<Préparation si worktree neuf : dépendances, services, .env.>
Suis le workflow worktree (skill git-flow-worktree) à partir de là :
- reprise : lis l'issue, git log <base>..HEAD, et le rapport ~/Reports/<owner>-<repo>/<branche>/ s'il existe ;
- implémentation : commits atomiques Gitmoji + Conventional qui référencent #<N> ; lint et format avant chaque commit ;
- entrée en review : /me:report, puis PR depuis le template du dépôt si elle n'existe pas ;
- /me:loop:claude-review-pr jusqu'à 0 bloquant pertinent, puis /me:loop:ci-until-green ;
- PR sensible (sécurité, argent, données, auth) : les deux reviewers EN PARALLÈLE, claude-review-pr (ses deux
  agents) et le check codex (`cd <chemin> && bash ~/.claude/skills/me/loop/codex-review-pr/check.sh`, en helper) ;
  ça ne coûte pas plus de temps qu'un seul, et le tiers trouve ce que les deux axes Claude ratent ;
- tâches longues ou reviewer tiers : lance-les en helpers avec hc (hc run --bg --name i<N>-<rôle> --cwd <chemin>
  --label role=helper … env PATH="$PATH" <commande>), puis hc wait --children all ; jamais de sleep ;
- ne merge pas : le lead s'en charge.
Fin : un dernier message court (PR, review, CI, points ouverts, ce qui demande l'utilisateur). Il remonte tout
seul au lead par la note de hc.
```

Après les lancements : dire en une ligne quel worker part sur quoi (`hc ls --label sprint=<slug>`), puis
**finir le tour**.

## 4. Plan en direct (me:report)

Écrire ou mettre à jour `notes.json` du plan (`issues` avec `deps`, voir la skill `me:report`, mode plan) puis :

```bash
~/.claude/skills/me/report/collect.py --plan <slug>   # depuis le dépôt ; donne le chemin de la page
/Applications/Herdr.app/Contents/MacOS/sheprd browser open <REPORT>   # la page dans un onglet Sheprd
```

Chaque collecte de branche (les loops de review et de CI des agents la lancent) relit ce plan : le kanban avance
tout seul.

## 5. Suivi et retour d'un worker

- Les nouvelles arrivent comme des notes de hc tapées dans la session du lead (balises `<hc …>`) : fin de tour,
  blocage, erreur, sortie. Pour attendre activement plutôt que finir le tour : `hc wait --children any` (prochaine
  nouvelle) ou `--children all` (tous arrêtés).
- État d'un worker : `hc get i<N> --json` → `status.state` (`working`, `idle`, `done`, `blocked`) et `status.msg`,
  le résumé du dernier tour fait par hc. Son écran : `hc read i<N> --lines 200`.
- `blocked` : il attend une approbation ou une réponse. Lire son écran, puis répondre (`hc send i<N> "…"`,
  `hc keys i<N> enter`) seulement si la réponse est évidente et dans le périmètre ; sinon, demander à
  l'utilisateur. L'utilisateur peut aussi le prendre en main : `hc attach i<N>` (ctrl+\ pour se détacher).

Au retour :

1. Lire son dernier message, vérifier sur pièces : `gh pr view <P> --json state,reviewDecision,statusCheckRollup`,
   et la section review du rapport de la branche.
2. **Avant le merge, remettre le corps de la PR d'accord avec ce qui est livré** : gates et compteurs du sha final,
   cases cochées, synthèse de la review avec ce qui n'a pas été relu (correctifs de la dernière passe), captures
   pointant vers le dossier du rapport (jamais `/tmp`), toutes les étapes si la PR en avait plusieurs
   (`gh pr edit <P> --body-file <fichier>`). Un corps de PR qui décrit encore l'étape 1 ment au lecteur suivant.
3. Prête (0 bloquant pertinent, CI verte du sha exact, accord s'il en faut un) : `/me:merge` depuis son worktree,
   merge dans `dev`. Les **points ouverts** vont dans le commentaire de fermeture de l'issue, puis sont listés à
   l'utilisateur : ouvrir une issue par reste est sa décision, pas celle du lead.
4. `collect.py --plan <slug>`, puis lancer les issues que ce merge débloque (étapes 2 et 3).
5. Conflit au merge : le résoudre dans le worktree de la branche, jamais sur `dev` directement. Après un conflit,
   ne pas faire `git commit --no-edit` : le message garderait les lignes `# Conflicts:` et n'aurait pas le trailer
   `Claude-Session`. Écrire le message (Gitmoji + Conventional, trailer compris).
6. Une fois l'issue mergée : `hc kill i<N>` puis `hc rm i<N>`, et ses helpers s'il en reste.

## 5b. Contexte et compaction

Un résumé de compaction perd ce qui compte le plus pour un lead : qui fait quoi, quels hashes, ce qui est posé sans
commit. La règle met la vérité dans un fichier, pas dans le résumé.

- **Note de reprise du lead** : un fichier tenu à jour à chaque fin de lot (workers avec nom, adresse, brief et état ;
  hashes commités ; posé non commité avec les fichiers exacts ; règles en vigueur ; ce qui attend l'utilisateur ;
  étape en cours et suivante). Le lier une fois : `ln -sfn <note> ~/.claude/handoff/"$CLAUDE_CODE_SESSION_ID".md`.
- **Le hook fait le reste** (`~/.claude/hooks/handoff.sh`, déclaré dans `settings.json`) :
  - PreCompact : photographie les enfants hc du terminal (`<session_id>.snapshot.md`) et sort les consignes du résumé ;
  - SessionStart `compact|resume` : réinjecte la note et la photo. Sans note pour la session, il ne fait rien.
- **Quand compacter le lead** : entre deux lots, jamais pendant une vérification, une pose ou un commit en vol. Note
  d'abord, puis `/compact garde la table des workers, les hashes, le posé non commité, les décisions en attente,
  l'étape en cours`. L'auto-compaction est couverte par le même hook.
- **Les workers ne compactent pas.** À chaque retour, lire `jq .ctx_pct ~/.claude/cache/statusline/herdr-<adresse>.json`.
  À 60 % ou plus : lui demander de finir le lot en cours, d'écrire `NOTES.md` (état exact) et de s'arrêter ; puis
  `hc kill` + `hc rm` (transcript gardé) et le relancer à neuf avec « lis ton BRIEF.md et ton NOTES.md ». Un worker
  compacté malgré tout relit son brief et ses notes avant toute action (règle à mettre dans son brief).
- **Worker Codex** : même règle, sa compaction interne n'est pas une mémoire fiable ; relance à neuf depuis brief + notes.

## Repli séquentiel (hors hc)

Même état des lieux (étape 1), puis le lead fait le travail lui-même, un élément après l'autre, dans l'ordre du plan.

**Le cwd ne tient pas.** Dans Claude Code, un `cd` vers `../<repo>-worktrees/…` est annulé à l'appel Bash suivant :
le worktree est hors du répertoire de travail, le shell revient à la racine du dépôt. Chaque commande, et chaque
commande des loops (review, CI, merge, report), commence donc par `cd "$WT" &&`. Sans ce préfixe, un loop qui lit
« la branche courante » lit `dev`. Au début de chaque élément :

```bash
WT=$(gwm path <slug>)
gwm agents attach <slug> "$CLAUDE_CODE_SESSION_ID"   # rattache cette session au worktree (gwm, pane Agents)
```

- **PR en review** : son worktree (sinon le créer comme à l'étape 2), puis `/me:report` (son `notes.json` s'il
  manque : sans lui, la page de la branche reste à « NOTES absentes »), `/me:loop:claude-review-pr`,
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
   ou ouvrir une issue de migration). Un échec dans notre code : un agent, ou signaler.
3. Merge en figeant le sha vérifié : `gh pr merge <P> --merge --match-head-commit <sha>`. Si le bot pousse entre
   la vérification et le merge, GitHub refuse : on revérifie, on ne force pas.

## Accord de l'utilisateur (design, client)

Une PR qu'une règle du dépôt (`CLAUDE.md`, mémoire du projet) ou l'utilisateur soumet à un accord ne se merge pas
sur la seule review. Les preuves sont rangées avec le rapport de la branche, jamais dans `/tmp`, qui disparaît et
casse les liens du corps de la PR :

- captures (bureau 1440, mobile 390, thèmes) dans `~/Reports/<owner>-<repo>/<branche>/captures/`, produites par
  un script du dépôt s'il en a un (e2e, Playwright), sinon par un script rangé au même endroit ;
- envoyées à l'utilisateur (`SendUserFile` si disponible, sinon le chemin, ou un onglet Sheprd), avec une
  question : « ok, merge » ou « retouches », et les points de rendu en choix multiple ;
- merge seulement sur son « ok ». Le script de captures devient-il un outil du dépôt : c'est à lui de le dire.

## Garde-fous

- Jamais sur `main` / `master`. Merge dans `dev` seulement, et seulement quand la review et la CI le disent.
- hc : ne tuer, retirer ou piloter que les terminaux que le lead (ou ses workers) a lancés ; jamais
  `hc server stop`, jamais tuer le processus Herdr ou herdr-core.
- Les PR de bots ne contournent pas la CI : sha exact vert, sinon un agent les traite.
- Les règles du dépôt passent avant le merge automatique : une PR que le `CLAUDE.md` ou la mémoire du projet
  soumet à un accord (visuel, client) s'arrête avant `/me:merge` et attend l'utilisateur. L'ordre qu'il donne
  passe avant celui du plan.
- Un agent qui échoue ou se bloque : le signaler à l'utilisateur, ne pas le relancer à l'aveugle.
- Budget de review : une PR partielle ne brûle pas ses passes suivantes sur une version intermédiaire ; sa passe
  de convergence attend qu'elle soit complète.
- Reviewer tiers : sur k-hub (#51, passe 2), les deux axes Claude rendaient 0 bloquant et Codex a trouvé un vrai
  P2 (une session déjà expirée se révoquait en 204, succès journalisé). Une PR sensible a toujours ses deux
  reviewers.
- Les correctifs de la **dernière** passe de review ne sont relus par personne : la synthèse le dit. Compensation
  exigée : chaque correctif arrive avec un test vu rouge avant le code. Pour un test ajouté sur du code existant,
  casser chaque garde tour à tour doit faire tomber un test (sinon le test ne protège rien). Vécu sur k-hub : ça
  a trouvé un vrai bug.
