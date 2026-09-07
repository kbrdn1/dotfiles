---
name: me:loop:claude-review-pr
description: Loop auto-cadencé — relance une review par agent Claude (spawné depuis la session, effort high minimum) sur la PR de la branche courante et corrige jusqu'à 0 finding bloquant pertinent (P0/P1/P2), max 8 itérations, avec analyse de convergence pour s'arrêter quand les passes n'apportent plus rien. Déclencheurs : "/me:loop:claude-review-pr", "lance le loop claude-review-pr", "review claude jusqu'à ce que la PR soit clean".
---

# loop:claude-review-pr

Loop auto-cadencé. **mode:** closed · **trigger:** self-pace · **exécution:** single · **hardened:** true (bloc anti-triche de `me:run-loop`).
**Source de review par défaut** (depuis le 2026-09-07). La review est faite par un **agent Claude spawné depuis la session** (tool `Agent`, contexte frais, **effort `high` minimum**), pas par le companion Codex. Plus de broker, plus de wedge, plus de fallback — l'agent tourne ou il ne tourne pas. Applique le **PROTOCOLE SELF-PACE** ci-dessous (canonique dans `me:run-loop`).

> ⚠️ L'agent review l'arbre du **répertoire courant** sur la **branche courante**. Lance ce loop **depuis le checkout/worktree de la PR**, sur sa branche — sinon il review le mauvais arbre.

> ⚠️ **Honnêteté — la limite structurelle de ce loop.** Le reviewer est du **même modèle que la session**. Contexte frais ≠ angles morts différents : ce qui m'a échappé en écrivant a de bonnes chances d'échapper au reviewer aussi. C'est le prix de ne pas dépendre du companion Codex, et c'est un prix réel, pas une formalité.
>
> Donc sur une **PR sensible** — sécurité, argent, isolation multi-tenant, migration de données, tout ce qui casse sans se voir — doubler avec un reviewer **tiers** : `me:loop:codex-review-pr` (CLI Codex local, même protocole, même format de findings) ou `me:check-reviews` (cascade cloud/bots). Ce n'est pas de la ceinture-et-bretelles : c'est le seul moyen d'obtenir un angle que je n'ai pas.

## Définition

- **goal** : la PR de la branche courante passe la review agent sans finding bloquant pertinent (P0 = critique, P1 = élevé, P2 = moyen bloquant).
- **max_iterations** : 8
- **exit_when** : la sortie du check affiche `P0P1P2_COUNT=0` — OU les findings `[P0]`/`[P1]`/`[P2]` restants ont tous été explicitement documentés comme **faux positifs / hors-scope** et écartés (ils ne comptent pas).
- **exit_on_stagnation** : troisième sortie, **distincte du succès** — la boucle n'apporte plus de valeur (cf. « Analyse de convergence »). On s'arrête avec un `P0P1P2_COUNT` non nul, en l'annonçant comme tel et en listant ce qui reste. Ce n'est pas un échec : c'est reconnaître qu'une passe de plus produirait du durcissement théorique au lieu d'un correctif.
- **check** : trois temps — (A) préparation en Bash (base + diff + intention sur disque), (B) **deux agents Claude en parallèle** (axes `standards` et `spec`) qui écrivent chacun leur rapport, (C) parsing des **deux** rapports en Bash → `STANDARDS_COUNT`, `SPEC_COUNT`, `P0P1P2_COUNT`. C'est (C) qui fait foi, jamais le message final des agents.

### (A) Préparation — Bash, inline

```bash
set -o pipefail
PR_JSON=$(gh pr view --json number,baseRefName 2>/dev/null) || { echo "❌ Aucune PR pour la branche courante"; exit 2; }
BASE=$(echo "$PR_JSON" | jq -r .baseRefName)
git fetch origin "$BASE" --quiet 2>/dev/null || true   # le SSH peut échouer → origin/$BASE en cache suffit
# --path-format=absolute est OBLIGATOIRE (et doit précéder --git-path) : sans lui,
# `--git-path` rend un chemin RELATIF à la racine du repo (`.git/worktrees/<nom>/…` sur
# un worktree lié). Ce chemin passe dans le prompt de l'agent, qui l'écrit relativement
# à SON cwd — le rapport atterrit ailleurs et (C) crie « review NON exécutée » sur une
# review qui a bien tourné. Dans le git dir : jamais commité.
DIFF=$(git rev-parse --path-format=absolute --git-path claude-review.diff)
R_STD=$(git rev-parse --path-format=absolute --git-path claude-review-standards.md)
R_SPEC=$(git rev-parse --path-format=absolute --git-path claude-review-spec.md)
git diff "origin/$BASE...HEAD" > "$DIFF"
rm -f "$R_STD" "$R_SPEC"                                 # sinon la passe N lirait les rapports N-1
# ⚠️ Ne PAS toucher à loop-guardrails.md, qui vit dans le même dossier et doit persister.
echo "BASE=origin/$BASE"; echo "DIFF=$DIFF"
echo "R_STD=$R_STD"; echo "R_SPEC=$R_SPEC"; echo "diff: $(wc -l < "$DIFF") lignes"
```

`rm -f "$R_STD" "$R_SPEC"` n'est pas cosmétique : sans lui, un agent qui échoue laisse le rapport de la passe précédente en place et le parser rend un verdict périmé.

**L'intention, pour l'axe spec** — à récupérer dans la même passe (A) :

```bash
N=$(printf '%s' "$PR_JSON" | jq -r .number)
INTENT=$(git rev-parse --path-format=absolute --git-path claude-review-intent.md); rm -f "$INTENT"
# l'issue liée : "Closes #N" dans le corps de la PR, sinon le n° de branche (feat/#123-slug)
ISSUE=$(gh pr view "$N" --json body -q .body 2>/dev/null | grep -oiE '(closes|fixes|resolves) #[0-9]+' | grep -oE '[0-9]+' | head -1)
[ -z "$ISSUE" ] && ISSUE=$(git branch --show-current | grep -oE '#[0-9]+' | tr -d '#')
[ -n "$ISSUE" ] && gh issue view "$ISSUE" --json title,body -q '"# " + .title + "\n\n" + .body' >> "$INTENT" 2>/dev/null
# spec-driven : la spec fait autorité sur l'issue quand elle existe
SPEC=$(ls -d .specify/specs/${ISSUE}-* 2>/dev/null | head -1)
[ -n "$SPEC" ] && [ -f "$SPEC/spec.md" ] && { echo; echo "# spec.md"; cat "$SPEC/spec.md"; } >> "$INTENT"
if [ -s "$INTENT" ]; then echo "INTENT=$INTENT ($(wc -l < "$INTENT") lignes)"; SPEC_SKIPPED=0
else echo "⚠️ ni issue ni spec trouvée — axe spec non lançable"; SPEC_SKIPPED=1; fi
export SPEC_SKIPPED
```

### (B) Review — DEUX axes, deux agents parallèles qui ne se voient pas

🔴 **Deux `Agent` lancés dans le MÊME message** (donc en parallèle), contexte **frais** chacun, écrivant dans **deux fichiers distincts**. Ce n'est pas « deux prompts pour couvrir plus » : c'est **deux contextes qui ne se polluent pas**.

**Pourquoi deux.** Un agent unique qui lit à la fois la spec, le diff et les conventions **rerank tout seul** : il trouve trois violations de convention, les hiérarchise entre elles, et l'exigence manquante de la spec descend sous le pli. Le résultat pratique : un diff propre qui implémente **la mauvaise chose** ressort « rien de bloquant ». Avec deux axes séparés, il ressort **`standards: pass` / `spec: fail`** — ce qu'aucun agent unique ne produit.

| axe | cherche | ne voit pas |
|---|---|---|
| **standards** | correctness, sécurité, intégrité des données, multi-tenant, robustesse runtime, conventions du repo (`CLAUDE.md`, `.claude/rules/`) | l'intention : ni l'issue, ni la spec |
| **spec** | exigence **manquante**, **scope creep** (du code que rien ne demandait), exigence **mal implémentée** | les conventions : il ne juge pas le style |

🔴 **Ne jamais fusionner ni reranker les deux listes.** Un P1 de conformité et un P1 d'écart à la spec ne sont pas comparables ; les classer ensemble détruit exactement l'information que la séparation produit. Deux rapports, deux `RESUME:`, deux compteurs. `P0P1P2_COUNT` est la **somme**, et le bloc bloquant affiche les deux sections étiquetées.

Chaque agent : `subagent_type: "general-purpose"`, `model: "opus"`, `prompt` avec **`ultrathink` en première ligne**, et `description: "review PR — standards"` / `"review PR — spec"`.

> L'axe **spec** a besoin de l'intention : lui passer le corps de l'issue (`gh issue view <N> --json title,body`) et, si le repo est en spec-driven, `.specify/specs/<N>-<slug>/spec.md`. Sans intention, il n'a rien à comparer — s'il n'y a ni issue ni spec, **le dire et ne lancer que l'axe standards**, avec `SPEC_SKIPPED=1` dans le rapport plutôt qu'un faux `P0=0`.

> ⚠️ **Effort : un seul knob confirmé.** `model: "opus"` est vérifiable et suffit à la capacité. Pour l'**effort de raisonnement**, le tool `Agent` n'expose aucun paramètre : la doc renvoie au frontmatter d'une définition `~/.claude/agents/*.md`, mais **aucune clé d'effort n'est attestée** localement (aucun des 21 agents n'en porte, et le binaire du CLI est strippé — non vérifiable ici, 2026-09-04). `ultrathink` en tête de prompt est donc le mécanisme retenu **par défaut, non vérifié**. Le jour où une clé de frontmatter est confirmée : créer `~/.claude/agents/pr-reviewer.md` (`model: opus` + la clé) et pointer `subagent_type: "pr-reviewer"` ici — c'est la voie sanctionnée.

**Prompt commun** (les deux axes partagent le format de sortie ; seul le bloc `MISSION` change) :

```
ultrathink

Tu es un reviewer senior STRICT sur une PR. Répertoire courant = le worktree de la PR.

Périmètre : UNIQUEMENT le diff de la PR (base <BASE>). Le diff complet est dans <DIFF>.
Lis-le en entier, puis ouvre les fichiers source du repo pour le contexte réel (appelants,
invariants, tests existants) — un finding sur une ligne du diff sans avoir lu son contexte
est un faux positif en puissance.

<MISSION>

N'invente AUCUN finding : s'il n'y a rien de bloquant sur TON axe, dis-le. Ne sors pas de
ton axe : ce qui relève de l'autre n'est pas ton problème, un autre reviewer s'en occupe.

Écris ton rapport dans le fichier <REPORT> (via Write), au format STRICT suivant, une puce
par finding :

- [Pn] Titre court — chemin/fichier:ligne
  1-2 phrases : cause puis impact concret.

où n vaut 0 (critique), 1 (élevé), 2 (moyen bloquant) ou 3 (nit non bloquant).
Si aucun finding bloquant, écris la ligne : (none)
Termine TOUJOURS le fichier par une ligne : RESUME: P0=<compte> P1=<compte> P2=<compte> P3=<compte>
avec de VRAIS chiffres.

Ta réponse finale : recopie juste la ligne RESUME.
```

**`<MISSION>` axe standards** (`<REPORT>` = `R_STD`) :

```
Ton axe est la CONFORMITÉ. Respecte les conventions du repo : CLAUDE.md, .claude/rules/.
Cherche des défauts RÉELS et ACTIONNABLES : correctness, sécurité, intégrité des données,
isolation multi-tenant, robustesse runtime (nil/erreurs non gérées, races, ressources non
libérées), régressions de comportement. Ignore le cosmétique et le stylistique.
Tu n'as PAS accès à l'intention (issue, spec) et tu n'en as pas besoin : tu juges le code
tel qu'il est écrit, pas ce qu'il était censé faire.
```

**`<MISSION>` axe spec** (`<REPORT>` = `R_SPEC`) :

```
Ton axe est l'INTENTION. Voici ce que cette PR était censée faire :
<INTENTION>   (corps de l'issue, et .specify/specs/<N>-<slug>/spec.md si le repo est spec-driven)

Compare le diff à cette intention, sur trois angles et trois seulement :
1. MANQUANT — une exigence énoncée que le diff n'implémente pas, ou implémente à moitié.
2. SCOPE CREEP — du code que rien dans l'intention ne demandait. Une refacto opportuniste,
   une option « pendant qu'on y est », un fichier touché sans raison. Signale-le même s'il
   est bien écrit : le problème n'est pas la qualité, c'est qu'il n'a pas été demandé.
3. MAL IMPLÉMENTÉ — l'exigence est traitée, mais d'une façon qui ne produit pas l'effet décrit.

Tu ne juges NI le style, NI les conventions, NI la robustesse — un autre reviewer s'en occupe.
Un diff impeccable qui implémente la mauvaise chose doit ressortir en P0/P1 chez toi.
```

Substituer `<BASE>`, `<DIFF>`, `<REPORT>`, `<INTENTION>` par les valeurs de (A).

### (C) Parsing — Bash, inline (c'est lui qui fait foi)

```bash
R_STD=$(git rev-parse --path-format=absolute --git-path claude-review-standards.md)
R_SPEC=$(git rev-parse --path-format=absolute --git-path claude-review-spec.md)

# GARDE ANTI-FAUX-PROPRE, PAR AXE : un rapport absent, vide, ou sans ligne RESUME chiffrée
# signifie que CET axe n'a PAS tourné (agent en échec, budget épuisé, fichier non écrit) —
# pas que l'axe est propre. Sans cette garde le parser imprimerait 0 sur du vide et le loop
# déclarerait le succès sans qu'une ligne ait été relue. Le motif exige un CHIFFRE : le
# gabarit du prompt s'écrit `P0=<compte>`, une vraie réponse `P0=0`. Les QUATRE compteurs
# sont exigés — une ligne tronquée passerait une garde laxiste pour mourir plus bas.
# Seule exception tolérée : l'axe spec délibérément non lancé (ni issue ni spec) → SPEC_SKIPPED=1,
# qui s'annonce comme tel et n'est JAMAIS compté comme un zéro.
RE="RESUME:[[:space:]]*P0=[0-9]+[[:space:]]+P1=[0-9]+[[:space:]]+P2=[0-9]+[[:space:]]+P3=[0-9]+"
check_axis() {   # $1 = fichier, $2 = nom de l'axe
  [ -s "$1" ] || { echo "❌ axe $2 NON exécuté — rapport absent ou vide ($1)"; return 2; }
  grep -qE "$RE" "$1" || {
    echo "❌ axe $2 NON exécuté — aucune ligne RESUME chiffrée"; tail -5 "$1"
    echo "   (ne PAS lire ce résultat comme 0 finding — relancer l'agent)"; return 2; }
}
check_axis "$R_STD" standards || exit 2
if [ "${SPEC_SKIPPED:-0}" = 1 ]; then
  echo "⚠️ axe spec NON lancé (ni issue ni spec trouvée) — le scope creep n'est PAS contrôlé sur cette passe"
  : > "$R_SPEC"; printf 'RESUME: P0=0 P1=0 P2=0 P3=0\n' > "$R_SPEC"
else
  check_axis "$R_SPEC" spec || exit 2
fi

python3 - "$R_STD" "$R_SPEC" <<'PY'
import re, sys
def parse(path):
    t = open(path, encoding="utf-8", errors="replace").read()
    p = list(map(int, re.findall(r"RESUME:\s*P0=(\d+)\s+P1=(\d+)\s+P2=(\d+)\s+P3=(\d+)", t)[-1]))
    # La ligne RESUME est retirée AVANT le découpage : sinon la dernière puce l'absorbe
    # (le split court jusqu'à EOF) et le bloc bloquant affiche le récap collé au finding.
    body = re.split(r"\n\s*RESUME:", t)[0]
    bullets = re.split(r"\n(?=- \[P[0-3]\])", body)
    blocking = [b.strip() for b in bullets if re.match(r"- \[P[012]\]", b.strip())]
    return p, blocking

(s0, s1, s2, s3), s_bl = parse(sys.argv[1])
(c0, c1, c2, c3), c_bl = parse(sys.argv[2])
std, spec = s0 + s1 + s2, c0 + c1 + c2

# 🔴 JAMAIS de rerank entre les axes : deux sections étiquetées, jamais une liste triée.
print("standards: %s (P0=%d P1=%d P2=%d P3=%d)" % ("fail" if std else "pass", s0, s1, s2, s3))
print("spec:      %s (P0=%d P1=%d P2=%d P3=%d)" % ("fail" if spec else "pass", c0, c1, c2, c3))
print("=== blocking · standards ===")
print("\n".join(s_bl) if s_bl else "(none)")
print("=== blocking · spec ===")
print("\n".join(c_bl) if c_bl else "(none)")
print("STANDARDS_COUNT=%d" % std)
print("SPEC_COUNT=%d" % spec)
print("P0P1P2_COUNT=%d" % (std + spec))
PY
```

> ⚠️ Si `RESUME:` annonce des bloquants mais que le bloc `blocking` correspondant est vide (ou l'inverse), l'agent a mal formaté : relancer **cet axe** en (B), ne pas trancher au jugé.

> 🔴 `SPEC_SKIPPED=1` n'est pas un axe vert. Il s'annonce dans le rapport final comme « scope creep non contrôlé sur cette PR », et il ne doit jamais devenir l'état par défaut parce que retrouver l'issue demandait un effort.

## Cycle

- **Discovery** : vérifier le contexte — être dans le checkout/worktree de la PR, sur sa branche (`gh pr view` doit renvoyer une PR) ; sinon s'y placer. Lire le contexte projet (`CLAUDE.md`, `.claude/rules/`, conventions/stack).
- **Planning** : déterminer la base (`origin/<baseRefName>`) via (A).
- **Execution** :
  Step 1: lancer (B) puis (C), lire le **bloc `blocking (P0/P1/P2)`** + la ligne `P0P1P2_COUNT=`. Pour chaque finding `[P0]`/`[P1]`/`[P2]`, juger sa **pertinence** (vrai problème vs faux positif/hors-scope, à partir du texte du finding et du fichier/ligne cités).
  Step 2: corriger la **cause racine** et les **éléments pertinents en fonction du contexte du projet** (conventions, stack, `CLAUDE.md` et `.claude/rules/` du repo) — commit atomique Gitmoji + Conventional référençant l'issue. Documenter et **écarter** les faux positifs / findings hors-scope ou contraires aux conventions du projet — sans jamais désactiver/skip une validation pour faire taire le finding.
- **Verification** : rejouer (A) → (B) → (C), lire le bloc `blocking` + `P0P1P2_COUNT=`.
- **Analyse de convergence** (à partir de l'itération 3, puis à chaque passe) : la boucle apporte-t-elle encore quelque chose ? Cf. la section dédiée. Trois issues — continuer, s'arrêter sur `exit_when`, s'arrêter sur `exit_on_stagnation`.
- **Iteration** : tant qu'il reste des bloquants pertinents **et** que l'analyse conclut « continuer », reboucler ; sinon stop/handback.

## Protocole self-pace (compteur à 1)

1. Exécuter les steps (corriger les findings P0/P1/P2 pertinents).
2. Rejouer le check **(A) → (B) → (C)** et **LIRE la sortie réelle de (C)**. Ne jamais supposer le résultat, ne jamais se fier au seul message final des agents. Lire les **deux** verdicts : `standards: pass|fail` et `spec: pass|fail`.
3. Évaluer `exit_when` : si `P0P1P2_COUNT=0` (ou les bloquants restants sont tous des faux positifs documentés/écartés) → **STOP**, annoncer le succès (citer `P0P1P2_COUNT` + le récap `findings…`).
4. **À partir de l'itération 3** : dérouler l'« Analyse de convergence ». Si elle conclut à la stagnation → **STOP** sur `exit_on_stagnation`, avec le rapport prévu. Ne pas attendre `max_iterations` pour le faire.
5. Sinon incrémenter. Si compteur ≥ 8 → **STOP**, annoncer la limite sans succès + lister les findings bloquants restants et pourquoi ils résistent.
6. Sinon recommencer.

Status à chaque passe : `🔁 Itération N/8 — <findings corrigés> → check: standards=<n> spec=<n> → P0P1P2_COUNT=<n>`.

Garde-fous : ne jamais dépasser `max_iterations` ; jamais de succès sans `P0P1P2_COUNT=0` (ou écartement explicite) vu dans la sortie de **(C)** — un arrêt sur stagnation s'annonce comme un arrêt sur stagnation, **jamais** comme un succès ; jamais skip/désactiver une validation — corriger la cause racine ; rester dans le bon checkout/branche. Si (C) `exit 2` deux passes de suite (agent qui n'écrit pas son rapport), **stopper et le signaler** (bascule `me:loop:codex-review-pr` ou `me:check-reviews`) plutôt que boucler à vide.

## Des agents frais à chaque passe

**Toujours `general-purpose`, jamais `fork`.** Un fork hérite de ma conversation — donc de mes justifications, de mon interprétation du besoin, et des findings que j'ai déjà écartés. Il valide au lieu de reviewer. Le contexte frais est ce qui rend la review utile ; c'est aussi ce qui la rend chère (chaque agent relit le diff et les fichiers à chaque passe), et c'est le bon prix à payer. Deux axes = deux fois ce prix, assumé : c'est ce qui achète le verdict `standards pass / spec fail`.

**Les deux `Agent` partent dans le MÊME message**, sinon ils s'exécutent en série et on paie la latence deux fois sans rien gagner.

Le bruit reste dans les agents : leurs transcripts ne remontent pas dans le contexte du loop, seuls les rapports (fichiers) et leurs lignes RESUME reviennent. Pas besoin de rediriger quoi que ce soit.

## Analyse de convergence

🔗 **Canonique dans `~/.claude/skills/me/loop/_shared/convergence.md`** — partagé avec `me:loop:codex-review-pr`. Lire ce fichier à partir de l'itération 3, puis à chaque passe, et appliquer sa décision (continuer / `exit_when` / `exit_on_stagnation`). Éditer là-bas, jamais ici.

En bref, pour ne pas avoir à l'ouvrir trop tôt : tenir dès la 1ʳᵉ passe le tableau `passe | findings | P0 | P1 | P2 | nature` ; cinq signaux d'épuisement (findings auto-générés, gravité qui s'effondre, scénarios à 3+ conjonctions, premier faux positif, code jamais exécuté) ; on sort sur stagnation si le signal 1 tient deux passes consécutives, ou si le 5 se combine à (2, 3 ou 4) ; l'arrêt s'accompagne d'un **rapport** en 5 points, jamais d'un simple « ça n'avance plus ».

## Mode parallèle borné (multi-branches)

Pour reviewer **plusieurs branches/worktrees à la fois** : chaque worktree a son propre `git dir`, donc son propre `claude-review.{diff,md}` — aucune collision. Lancer les `Agent` de review dans **un seul message** (ils tournent en parallèle), un par worktree, puis rejouer (C) dans chaque worktree et agréger les `P0P1P2_COUNT=`. Borner à 2-3 en vol : au-delà, la correction séquentielle qui suit annule le gain.
