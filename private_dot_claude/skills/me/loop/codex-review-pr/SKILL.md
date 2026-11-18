---
name: me:loop:codex-review-pr
description: Loop auto-cadencé — relance la review Codex CLI locale sur la PR de la branche courante et corrige jusqu'à 0 finding bloquant pertinent (P0/P1/P2), max 8 itérations, avec analyse de convergence pour s'arrêter quand les passes n'apportent plus rien. Déclencheurs : "/me:loop:codex-review-pr", "lance le loop codex-review-pr", "codex review jusqu'à ce que la PR soit clean".
---

# loop:codex-review-pr

Loop auto-cadencé. **mode:** closed · **trigger:** self-pace · **exécution:** single · **hardened:** true (bloc anti-triche de `me:run-loop`).
Après la création d'une PR, relance la **review Codex CLI locale** (companion Node, avec **fallback `codex exec` direct** si le broker wedge) **inline** (le `check_command` redirige le transcript Codex vers `/dev/null` et n'imprime que le verdict compact — aucun subagent nécessaire, inutile et coûteux en tokens), et corrige les findings bloquants **pertinents** jusqu'à ce qu'il n'en reste plus. Applique le **PROTOCOLE SELF-PACE** ci-dessous (canonique dans `me:run-loop`).

> ⚠️ Le CLI Codex review l'arbre du **répertoire courant** sur la **branche courante** (cf. `me:check-reviews` Phase 1B). Lance ce loop **depuis le checkout/worktree de la PR**, sur sa branche — sinon il review le mauvais arbre.

## Définition

- **goal** : la PR de la branche courante passe la review Codex locale sans finding bloquant pertinent (P0 = `critical`, P1 = `high`, P2 = `medium`).
- **max_iterations** : 8
- **exit_when** : la sortie du check affiche `P0P1P2_COUNT=0` (plus aucun finding `[P0]`/`[P1]`/`[P2]`) — OU les findings `[P0]`/`[P1]`/`[P2]` restants ont tous été explicitement documentés comme **faux positifs / hors-scope** et écartés (ils ne comptent pas). Le companion (≥ 1.0.4) n'émet pas de `verdict` structuré : on se fie au `P0P1P2_COUNT` extrait des tags de sévérité du rapport.
- **exit_on_stagnation** : troisième sortie, **distincte du succès** — la boucle n'apporte plus de valeur (cf. « Analyse de convergence »). On s'arrête avec un `P0P1P2_COUNT` non nul, en l'annonçant comme tel et en listant ce qui reste. Ce n'est pas un échec : c'est reconnaître qu'une passe de plus produirait du durcissement théorique au lieu d'un correctif.
- **check_command** : review Codex locale → findings bloquants extraits du rapport markdown. Le companion **1.0.4** ne renvoie plus de tableau `.findings[]`/`.verdict` ; la review est du texte (`storedJob.result.codex.stdout` / `rendered`) où chaque finding est préfixé `- [P0]`…`- [P3]` (P0 = critical, P1 = high, P2 = medium, bloquants). On parse ces tags en Python (tolérant aux control chars via `strict=False`), sans `jq` sur un schéma obsolète. Commande complète :

> ⚠️ **Exécuter le `check_command` inline** (Bash, dans le contexte du loop). Le script redirige déjà le transcript Codex volumineux (≈ 10 k lignes) vers `/dev/null` (companion `--wait`) ou un fichier temporaire (`codex exec`), et n'imprime sur stdout que le **bloc verdict** (`=== blocking (P0/P1/P2) ===` + `P0P1P2_COUNT=`) plus quelques lignes de progression. **Pas de subagent** : le bruit est déjà absorbé par le script, donc l'isoler dans un agent jetable est inutile et brûle des tokens (~50 k par passe). Lance-le depuis le worktree de la PR.

Le check fait quatre choses : (1) **préflight** — `reconcile` nettoie les jobs orphelins (PID mort) + un broker mort ; (2) **watchdog pendant le `--wait`** — review en arrière-plan, on surveille le **mtime du log du job actif** : s'il stagne ≥ `STALL_S` (broker wedgé qui répond `BROKER_BUSY` à l'infini, cf. note plus bas), on `reconcile --force` et on **relance** (borné à `MAX_RESTART`) ; (3) **fallback direct** — si le companion reste wedgé après `MAX_RESTART` (ou est introuvable / `result` illisible), bascule sur une **review directe `codex exec` (broker contourné, `</dev/null`)** sur le diff `origin/$BASE...HEAD`, dans le **même format parsable** ; (4) **parser commun** — compte via la ligne `RESUME:` (chemin direct) sinon via les tags de puces (chemin companion), les deux chemins refusant de rendre un verdict sur une sortie qui ne prouve pas qu'une review a eu lieu. Un wedge ne bloque donc plus jamais le loop : il dégrade vers la voie directe.

```bash
cd "$WT" && bash ~/.claude/skills/me/loop/codex-review-pr/check.sh   # depuis le worktree de la PR
```

Le script vit à côté de cette skill, `check.sh`, pour pouvoir le lancer tel quel (y compris en arrière-plan)
sans l'extraire d'un bloc markdown. Ses quatre temps, décrits plus haut :
préflight `reconcile`, review + watchdog anti-wedge, repli `codex exec` direct, parser commun (`parse_findings`),
puis `report_pass` (D). Le modifier là-bas, jamais ici.

**(D) Rapport live `me:report`** : chaque passe qui rend un verdict est copiée dans le rapport HTML de la branche
(`review/codex-N.md` normalisé : les puces dans l'ordre + le `RESUME` qui a fait foi ; `review/codex-N.sha`), puis
`collect.py` est relancé. La section review y montre une série **codex** à côté de la série claude, jamais fusionnée.
Décisions (Step 2) dans `review/decisions.tsv`, séparateur tabulation : `c<N>-codex-<rang>	fixed	<sha>` ou
`c<N>-codex-<rang>	discarded	<raison en une phrase>`, où `rang` = position de la puce dans `review/codex-N.md`
(toutes les puces, P3 compris ; le dossier est donné par `collect.py --dir`).

## Cycle

- **Discovery** : vérifier le contexte — être dans le checkout/worktree de la PR, sur sa branche (`gh pr view` doit renvoyer une PR) ; sinon s'y placer. Lire le contexte projet (`CLAUDE.md`, `.claude/rules/`, conventions/stack).
- **Planning** : déterminer la base (`origin/<baseRefName>`) et l'outillage de review (companion Codex local).
- **Execution** :
  Step 1: **Exécuter le `check_command` inline** (Bash) et lire son **retour compact** : le bloc `blocking (P0/P1/P2)` + la ligne `P0P1P2_COUNT=`. Pour chaque finding `[P0]`/`[P1]`/`[P2]`, juger sa **pertinence** (vrai problème vs faux positif/hors-scope, à partir du texte du finding et du fichier/ligne cités).
  Step 2: Corriger la **cause racine** et les **éléments pertinents en fonction du contexte du projet** (conventions, stack, `CLAUDE.md` et `.claude/rules/` du repo) — commit atomique Gitmoji + Conventional référençant l'issue. Documenter et **écarter** les faux positifs / findings hors-scope ou contraires aux conventions du projet — sans jamais désactiver/skip une validation pour faire taire le finding.
- **Verification** : relancer le `check_command` **inline**, lire le bloc `blocking (P0/P1/P2)` + la ligne `P0P1P2_COUNT=`.
- **Analyse de convergence** (à partir de l'itération 3, puis à chaque passe) : la boucle apporte-t-elle encore quelque chose ? Cf. la section dédiée. Trois issues possibles — continuer, s'arrêter sur `exit_when`, s'arrêter sur `exit_on_stagnation`.
- **Iteration** : tant qu'il reste des bloquants pertinents **et** que l'analyse conclut « continuer », reboucler ; sinon stop/handback.

## Protocole self-pace (compteur à 1)

1. Exécuter les steps (corriger les findings P0/P1/P2 pertinents).
2. **Lancer le `check_command` inline** (Bash) et **LIRE son retour compact** (le bloc `blocking (P0/P1/P2)` + la ligne `P0P1P2_COUNT=`). Ne jamais supposer le résultat.
3. Évaluer `exit_when` : si `P0P1P2_COUNT=0` (ou les bloquants restants sont tous des faux positifs documentés/écartés) → **STOP**, annoncer le succès (citer `P0P1P2_COUNT` + le récap `findings=…`).
4. **À partir de l'itération 3** : dérouler l'« Analyse de convergence ». Si elle conclut à la stagnation → **STOP** sur `exit_on_stagnation`, avec le rapport prévu. Ne pas attendre `max_iterations` pour le faire : arrêter à la 4ᵉ passe quand c'est justifié vaut mieux que d'en enchaîner quatre de plus par automatisme.
5. Sinon incrémenter. Si compteur ≥ 8 → **STOP**, annoncer la limite sans succès + lister les findings bloquants restants et pourquoi ils résistent.
6. Sinon recommencer.

Status à chaque passe : `🔁 Itération N/8 — <findings corrigés> → check: P0P1P2_COUNT=<n> (P3 restants <n>)`.

Garde-fous : ne jamais dépasser `max_iterations` ; jamais de succès sans `P0P1P2_COUNT=0` (ou écartement explicite) vu dans la sortie du `check_command` — un arrêt sur stagnation s'annonce comme un arrêt sur stagnation, **jamais** comme un succès ; jamais skip/désactiver une validation — corriger la cause racine ; rester dans le bon checkout/branche. Le `check_command` se dégrade tout seul (companion wedgé → review directe `codex exec`) : il n'`exit 2` qu'en **dernier recours** (ni companion ni CLI `codex` dispo) → alors **stopper et le signaler** (fallback CodeRabbit via `me:check-reviews`) plutôt que boucler à vide.

## Analyse de convergence

🔗 **Canonique dans `~/.claude/skills/me/loop/_shared/convergence.md`** — partagé avec `me:loop:claude-review-pr`. Lire ce fichier à partir de l'itération 3, puis à chaque passe, et appliquer sa décision (continuer / `exit_when` / `exit_on_stagnation`). Éditer là-bas, jamais ici.

En bref, pour ne pas avoir à l'ouvrir trop tôt : tenir dès la 1ʳᵉ passe le tableau `passe | findings | P0 | P1 | P2 | nature` ; cinq signaux d'épuisement (findings auto-générés, gravité qui s'effondre, scénarios à 3+ conjonctions, premier faux positif, code jamais exécuté) ; on sort sur stagnation si le signal 1 tient deux passes consécutives, ou si le 5 se combine à (2, 3 ou 4) ; l'arrêt s'accompagne d'un **rapport** en 5 points, jamais d'un simple « ça n'avance plus ».

## Exécution inline (pas de subagent)

**Lance le `check_command` inline** via Bash, dans le contexte du loop — depuis le worktree de la PR, sur sa branche (`cd <WORKTREE>` d'abord). **Pas de subagent.** Le script absorbe lui-même le bruit : la sortie du companion `review --wait` part dans `/dev/null`, la review directe `codex exec` écrit dans un fichier temporaire, et seul `parse_findings` imprime sur stdout le **verdict compact** (~10 lignes : `findings…`, `=== blocking (P0/P1/P2) ===`, les puces bloquantes, `P0P1P2_COUNT=`) + quelques lignes de progression `⚠️/↪️`. Le contexte du loop ne reçoit donc que ce verdict — l'isoler dans un agent jetable serait redondant et brûlerait ~50 k tokens par passe (mesuré).

Le loop lit ce retour, juge la pertinence des findings, corrige (il a le contexte projet), commit/push, puis relance le `check_command` inline pour la passe de vérification.

> Mode dégradé : si le `check_command` `exit 2` (ni companion ni CLI `codex`), **stopper et signaler** (fallback CodeRabbit via `me:check-reviews`), sans boucler à vide.

## Anti-wedge : le broker Codex & `reconcile`

Le companion partage un **broker daemon** par workspace (`app-server-broker.mjs serve`, un par `--cwd`, état dans `~/.claude/plugins/data/codex-openai-codex/state/<branch>-<hash>/broker.json` + socket dans `/var/folders/.../cxc-*/`). Le broker **sérialise** les requêtes et garde en mémoire `activeStreamSocket`/`activeRequestSocket`. **Si un client review est tué en plein stream** (timeout, `kill`, contention de N reviews concurrentes), ces refs pointent vers un socket mort que le broker ne nettoie pas → il répond `BROKER_BUSY` à **toute** nouvelle review, qui reste alors **figée à `Starting Codex review thread`** indéfiniment (vécu : 10–14 min, broker `pid` pourtant **vivant**). Tuer le wrapper `review --wait` ne suffit pas — il faut **redémarrer le broker**. Et si le broker **reste** wedgé après `MAX_RESTART` `reconcile --force` (vécu : 2 cycles complets, ~34 min, le reset ne suffisait pas), le check **abandonne le companion** et bascule sur la **review directe `codex exec </dev/null`** (cf. `direct_review` dans le `check_command`) — le loop n'est donc jamais bloqué par un wedge.

Le check ci-dessus s'auto-soigne d'abord via la sous-commande **`reconcile`** (ajoutée au companion) :

- `node "$CODEX_COMPANION" reconcile [--json]` — préflight : marque `failed` les jobs `running`/`queued` à **PID mort**, et reset un broker **mort** (pid absent). Sans danger (n'effleure jamais une review vivante qui progresse). Affiche aussi la **file d'attente**.
- `… reconcile --force [--json]` — reset **inconditionnel** du broker (graceful `broker/shutdown` puis teardown socket/pidfile/sessionDir + `clearBrokerSession`). Utilisé par le watchdog quand le log du job actif stagne ≥ `STALL_S`.
- `… reconcile --stall-ms <n>` — reset si le log du job actif est figé depuis ≥ `n` ms (le **vrai** signal de wedge : `pid` vivant mais plus aucun progrès ; `updatedAt` ne bouge qu'aux transitions de phase, donc on se fie au **mtime du log**).

> ⚠️ **Patchs vendored à ré-appliquer.** Ils vivent dans le dossier versionné du plugin (`codex/<ver>/scripts/`) — **écrasés à chaque update/pull**. Deux diffs sont sauvegardés à côté de ce skill ; après un bump du companion, `node --check` la cible puis `patch -p1 < <fichier>` (ou à la main), et re-tester.
>
> | Patch | Ce qu'il corrige | Comment le re-tester |
> |---|---|---|
> | `companion-reconcile.patch` | `reconcile` + préflight auto dans `codex-companion.mjs` | `reconcile --json` + une review |
> | `session-lifecycle-timeouts.patch` | les deux attentes **non bornées** du hook `SessionEnd` (5 s de budget) | cf. ci-dessous |
>
> **Les deux attentes non bornées**, dans l'ordre où elles mordent :
> 1. `readHookInput()` faisait `fs.readFileSync(0)`, qui ne rend qu'à l'EOF de stdin. Un appelant qui garde le tube ouvert sans écrire bloquait le hook **indéfiniment** (>120 s mesuré) — avant même d'atteindre le code broker. Corrigé en `process.stdin` borné : `fs.createReadStream(fd 0)` ne convient pas, il lit via le pool de threads et un `read()` engagé sur un tube vide n'est pas interruptible (`destroy()` ne le rappelle pas, le process survit au délai).
> 2. `sendBrokerShutdown()` n'avait aucun délai : un broker **wedgé** accepte la connexion et ne répond jamais, donc la promesse ne se résolvait sur aucun de ses trois événements. C'est l'état même que `reconcile --force` répare — le teardown ne doit pas être sa victime. Abandonner l'arrêt courtois ne laisse rien derrière : `teardownBrokerSession()` suit et tue le process.
>
> ```bash
> # Le cas qui bloquait : stdin sans EOF, writer maintenu ouvert. Doit rendre la main.
> python3 -c 'import os,subprocess,time;r,w=os.pipe();t=time.time();p=subprocess.Popen(["node",os.path.expanduser("~/.claude/plugins/cache/openai-codex/codex/1.0.4/scripts/session-lifecycle-hook.mjs"),"SessionEnd"],stdin=r);os.close(r);p.wait(timeout=20);print("%.2fs"%(time.time()-t))'
> ```
>
> ⛔ **Ces patchs ne rendent pas le hook increvable, et ce n'est pas leur rôle.** Le budget est de 5 s pour le **process entier**, démarrage de Node compris : sur une machine chargée (`load average` à 371, vu en vrai), `node -e '0'` prend déjà jusqu'à **7 s** et le hook échoue quoi qu'il contienne. Un `Hook cancelled` isolé, sur une machine occupée, ne prouve donc rien sur le script — mesurer `uptime` et `node -e '0'` **avant** de chercher un bug dedans.

## Mode parallèle borné (multi-branches)

Pour reviewer **plusieurs branches/worktrees à la fois** : chaque worktree = `cwd` distinct = **broker distinct** → parallélisable. Mais la **concurrence est précisément ce qui stresse le broker** vers le wedge (3–4 reviews simultanées l'ont déclenché) — donc **borner** (≤ 2–3 en vol) et **un watchdog par branche**, pas un fan-out illimité.

Esquisse (la review d'**une** branche reste sérialisée par son broker — normal) :

```bash
CAP=${CODEX_PARALLEL_CAP:-2}        # reviews concurrentes max
# BRANCHES = liste de chemins de worktrees à reviewer
for WT in "${BRANCHES[@]}"; do
  while [ "$(jobs -rp | wc -l)" -ge "$CAP" ]; do wait -n; done
  ( cd "$WT" && /bin/sh -c "$CHECK_COMMAND" > "review-$(basename "$WT").out" 2>&1 ) &
done
wait
# puis agréger : grep -H 'P0P1P2_COUNT=' review-*.out
```

Chaque sous-review embarque son propre préflight + watchdog anti-wedge (le `check_command` ci-dessus), donc un wedge sur une branche n'entraîne pas les autres. Agréger les `P0P1P2_COUNT=` par branche pour le verdict global.
