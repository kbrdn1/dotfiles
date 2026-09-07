---
name: me:run-loop
description: Utiliser quand l'utilisateur veut lancer une boucle auto-cadencée qui répète une action jusqu'à une condition de sortie observable — par ex. "boucle jusqu'à ce que les tests soient verts", "fix la CI jusqu'à ce qu'elle passe", "build until green", "lance le loop X". Porte le PROTOCOLE SELF-PACE partagé (closed-loop 5 phases) et route vers la bonne skill loop:<name>.
---

# me:run-loop — Moteur des boucles auto-cadencées (self-pace)

Ce skill est le **moteur** des loops : il porte le cycle closed-loop de référence et sert de point d'entrée en langage naturel (« boucle jusqu'à ce que les tests passent »). Chaque loop concret est une **skill `loop:<name>`** qui embarque sa définition et applique ce cycle.

## Ce que ça n'est pas — les primitives natives

Claude Code a ses propres mécanismes de relance. Ils ne remplacent pas ce moteur, ils règlent un autre problème :

| | ce qui relance le tour | ce qui décide l'arrêt |
|---|---|---|
| `/goal` (natif) | fin de tour | un **évaluateur qui ne lit que le transcript** — il ne peut rien exécuter |
| `/loop` (natif) | un intervalle de temps | toi, ou le modèle qui se juge fini |
| `/schedule` (natif) | un cron cloud | la routine elle-même |
| **`me:loop:<name>`** | ce protocole, dans la session | **la sortie réelle d'une commande shell** (`exit_when`) |

🔴 **La différence qui compte** : l'évaluateur de `/goal` juge un transcript. Une commande de vérification qui n'a jamais tourné (quota épuisé, binaire absent, sortie vide) produit un transcript qui *ressemble* à un succès — c'est exactement le faux-propre vécu sur #772 et #1008. Ici, `exit_when` est observable dans une sortie de commande, et le check refuse de rendre un verdict qu'il ne peut pas prouver. **C'est le seul avantage réel du moteur — ne jamais le brader.**

Le mécanisme de *relance*, lui, est négociable : un `Stop` hook script-based (cf. `trigger: stop-hook`) fait la même cadence de façon déterministe, sans compteur tenu à la main.

## Où vivent les loops

```
<base>/skills/me/loop/<name>/SKILL.md   →   /me:loop:<name>
```
`<base>` = `~/.claude` (global) ou `<repo>/.claude` (per-project). Claude Code découvre les deux ; pour le routing langage naturel, lister les skills `me:loop:*` visibles.

## Étape 1 — Localiser le loop

- **Invocation directe** `/me:loop:<name>` → loop identifié, passe au cycle.
- **Langage naturel** → matcher la demande sur le nom (`me:loop:<name>`) ou le goal/description. Un seul match → l'utiliser ; plusieurs → demander lequel ; aucun → lister les loops dispo et proposer `me:create-loop`.

## Étape 2 — Lire la définition + les dimensions

Depuis le corps de `loop:<name>`, extrais `goal`, `max_iterations`, `check_command`, `exit_when`, les phases du **Cycle**, et les **dimensions** annoncées en tête :

- **mode** : `closed` (borné) | `open` (exploratoire) — défaut `closed`.
- **trigger** : `self-pace` | `stop-hook` — défaut `self-pace`.
- **exécution** : `single` | `fleet` — défaut `single`.

(Si non annoncées, supposer les défauts : closed / self-pace / single.)

## Étape 3 — Exécuter selon le trigger

### trigger: self-pace (défaut)
Applique le **PROTOCOLE SELF-PACE**, compteur à `1`, à chaque passe :

0. **Lire les guardrails** (cf. section dédiée) — chaque sign est une **contrainte dure** pour cette passe.
1. **Discovery + Planning + Execution** — exécute les steps (et, si le loop les explicite, la découverte de contexte et le découpage).
2. **Verification** — lance `check_command` et **LIS sa sortie réelle** (stdout/stderr + code de sortie). Ne JAMAIS supposer le résultat.
3. Évalue **exit_when** sur cette sortie : **rempli → STOP**, annonce le succès (cite la preuve).
4. Sinon **incrémente**. Si `compteur ≥ max_iterations` → **STOP**, annonce la limite sans succès + ce qui bloque (cause racine probable).
5. **Si le même échec se répète** (même erreur qu'une passe antérieure) → **appender un sign** au fichier de guardrails avant de retenter. C'est ce qui empêche la passe N+1 de rejouer l'approche de la passe N.
6. Sinon **Iteration** : corrige les écarts pertinents (selon le contexte projet) en respectant tous les signs, et recommence à 0.

### trigger: stop-hook
Le loop porte un hook `Stop` dans son frontmatter qui relance tant que `exit_when` n'est pas atteint (garde-fous : `stop_hook_active`, compteur, **sentinelle d'armement**). Ton rôle ici : **faire une première passe des steps**, puis laisser le hook piloter les relances. Si le hook est absent/cassé, **bascule en self-pace** et signale-le.

🔴 **Un hook de frontmatter de skill reste armé pour TOUT le reste de la session**, pas seulement pendant le loop (doc : « registers them when you or Claude invoke the skill and keeps running them for the rest of the session »). Sans sentinelle, une fois le loop terminé le hook continue de relancer `check_command` à chaque `Stop` et peut re-bloquer la session sur un travail sans rapport. Le gabarit de `me:create-loop` porte la sentinelle — ne jamais l'enlever.

### exécution: fleet
Joue l'**orchestrateur** : décompose le goal, délègue chaque sous-objectif à un specialist (`Agent`/`Task`), qui peut fan-out via subagents. Le `check_command` reste l'**eval gate global** : la boucle continue jusqu'à `exit_when`, mais chaque specialist applique son propre mini-cycle discovery→…→verification. Respecte `max_iterations` au niveau orchestrateur.

## Étape 4 — Status à chaque passe

```
🔁 Itération N/max — <ce qui a été tenté> → check: <résultat observé de check_command>
```

## Garde-fous (non négociables)

- 🔴 **Ne jamais dépasser `max_iterations`.**
- 🔴 **Ne jamais déclarer succès** sans avoir **vu `exit_when` satisfaite** dans la sortie réelle du check.
- 🔴 **Garde anti-faux-propre — un check qui ne prouve pas qu'il a tourné n'est pas un verdict.** Un `check_command` dont l'outil a échoué (quota épuisé, binaire absent, rapport vide, agent qui n'écrit rien) produit souvent une sortie *vide*, que le parser lit comme « 0 problème ». Le loop déclare alors le succès sans qu'une ligne ait été vérifiée. Tout `check_command` dont le compte se déduit d'un **parsing de texte** doit donc exiger une **preuve d'exécution positive** (une ligne `RESUME: P0=<chiffre>…`, un en-tête de rapport, un nombre de tests collectés) et sortir en **erreur** — jamais en zéro — quand elle manque. Le motif doit exiger un **chiffre** : un gabarit de prompt réémis dans la sortie (`P0=<n>`) matche un motif trop lâche. Appris deux fois : #772 (2026-09-01) puis #1008 (2026-09-02), même incident. Un `exit_when` fondé sur un **code de sortie** (ex. `TESTS_EXIT=0`) n'a pas ce problème.
- 🔴 **Bloc anti-triche (`hardened`)** — un loop qui optimise son propre critère de sortie finit par le truquer. Ces six règles sont **non négociables** pour tout loop déclaré `hardened: true`, et c'est le défaut :
  1. Ne **jamais modifier** le `check_command` ni l'`exit_when` pour forcer un succès.
  2. Ne **jamais skipper, désactiver ni contourner** une vérification pour satisfaire l'`exit_when`.
  3. Ne **jamais affaiblir, supprimer ni skipper un test** pour verdir la suite.
  4. Ne **jamais remplacer une assertion réelle par un test toujours vert** — c'est le contournement le plus courant, et le plus invisible en review : la suite reste verte, elle ne teste plus rien. Le cas nommé, c'est le **test tautologique** : l'assertion recalcule la valeur attendue *comme le fait le code* (`expect(add(a,b)).toBe(a+b)`, un snapshot dérivé à la main de la même façon, une constante comparée à elle-même). Il passe **par construction** et ne peut jamais contredire le code. Une valeur attendue doit venir d'une **source de vérité indépendante** : un littéral connu-bon, un exemple travaillé, la spec.
  5. **Corriger le code de production plutôt que rustiner le test** pour verdir.
  6. Bloqué après plusieurs itérations → **s'arrêter et rendre compte des blocages**, jamais truquer la métrique.
- 🔴 **Ne jamais désactiver/skip** un test ou une validation pour faire passer le check — corriger la **cause racine**.
- 🔴 **Un `check_command` jamais vu rouge n'est pas un gate, c'est une décoration.** Avant de faire confiance à un loop (nouveau, ou dont le check vient d'être modifié) : le voir **vert → rouge sur une casse volontaire → vert après revert**. Si la casse ne le fait pas échouer, il n'est pas branché. Détail et cas vécu dans `me:create-loop`, Étape 3.
- 🟡 Loop de **review** (reviewer LLM) → appliquer l'**analyse de convergence** partagée : `~/.claude/skills/me/loop/_shared/convergence.md`. Un reviewer LLM trouve toujours quelque chose ; sans elle, la boucle passe de « corriger des défauts » à « durcir du théorique ».
- 🟡 `mode: open` → borne l'exploration par le `budget` du loop et un standard de qualité explicite ; sans ça, un open loop part en dérive coûteuse.
- 🟡 `check_command` échoue pour raison d'environnement (commande introuvable, deps) → s'arrêter et le signaler plutôt que boucler à vide.
- 🟡 Deux passes consécutives avec exactement la même erreur sans progrès → le signaler (boucle stérile) au lieu de gaspiller les itérations.

## Guardrails persistants — la mémoire entre les passes

Sans mémoire, une boucle **rejoue ses échecs**. Elle corrige, le check casse ailleurs, elle revient, retente la même approche, et brûle ses itérations en rond. `max_iterations` borne le gaspillage, il ne l'empêche pas.

Le remède est un fichier plat, lu au **step 0** et appendé au **step 5** :

```bash
# Le git dir COMMUN : partagé par tous les worktrees du repo, jamais commité.
# ⚠️ --path-format=absolute doit précéder --git-path, sinon le chemin sort RELATIF
#    à la racine du repo (piège déjà vécu dans me:loop:claude-review-pr).
GUARDRAILS=$(git rev-parse --path-format=absolute --git-path loop-guardrails.md)
```

🔴 **Cycle de vie inverse de celui des rapports de review.** `claude-review.md` se fait `rm -f` à chaque passe, précisément pour qu'un rapport périmé ne soit jamais relu. `loop-guardrails.md` vit dans le **même dossier** et ne doit **jamais** être supprimé entre les passes — il n'a de valeur que cumulé. Ne pas copier le `rm -f` du voisin.

**Ce qui le vide** : rien d'automatique. Un sign est valable tant que la contrainte l'est. Quand elle ne l'est plus (la dépendance a été mise à jour, l'API a changé), c'est une **suppression manuelle et explicite**, jamais un effacement de confort en début de loop. Sans cette règle, un sign appris pendant une mauvaise PR hante le repo indéfiniment — c'est le mode de défaillance de ce mécanisme, il faut le connaître.

**Format d'un sign** — court, actionnable, daté, jamais un journal :

```markdown
- 2026-09-07 · `cargo test` — le test `sync::rebase_ahead` casse si `origin` n'est pas fetch.
  → fetch avant, ne pas mocker le remote (tenté passe 3, a masqué le vrai bug).
```

Deux champs qui comptent : **ce qui a échoué** et **ce qu'il ne faut plus retenter**. Le second est celui qu'on oublie, et c'est le seul qui empêche la récidive.

### Portée : repo, pas vault

🔴 Un guardrail est une leçon **opérationnelle et locale** — il reste dans le git dir du repo. Il ne va **pas** dans `~/Vault/{pro,perso}` : la règle vaut ici comme ailleurs, *le vault ne redouble pas git*, et une procédure de repo est justement ce qui n'y entre jamais.

L'exception est la **promotion à la main**, au merge de la PR : si un sign s'avère **transverse** — vrai au-delà de ce dépôt, du genre à re-mordre sur un autre projet — c'est exactement le matériau d'une note `decisions/` ou d'un retex via `tolaria`. C'est le chemin qui décloisonne les silos par projet, et il est **manuel par construction** : la boucle n'écrit jamais dans le vault.

## Créer un nouveau loop

Pour définir un nouveau loop (= une skill `loop:<name>`), utilise **`me:create-loop`** (conception sur mesure + dimensions).
