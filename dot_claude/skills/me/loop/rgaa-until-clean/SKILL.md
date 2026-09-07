---
name: me:loop:rgaa-until-clean
description: Loop auto-cadencé — relance l'audit d'accessibilité automatisé (axe-core / pa11y) sur les routes modifiées, corrige les violations via la skill me:rgaa, et reboucle jusqu'à 0 violation automatiquement détectable, max 6 itérations. Déclencheurs : "/me:loop:rgaa-until-clean", "lance le loop rgaa-until-clean", "boucle a11y jusqu'à clean", "corrige l'accessibilité jusqu'à ce que axe passe".
---

# me:loop:rgaa-until-clean

Loop auto-cadencé. **mode:** closed · **trigger:** self-pace · **exécution:** single · **hardened:** true (bloc anti-triche de `me:run-loop`).
Met en boucle ce que la skill **`me:rgaa`** sait déjà faire en une passe : auditer, corriger, re-scanner. La skill porte l'expertise (RGAA 4.1.2, WCAG 2.2 AA, ARIA 1.2, DSFR, idiomes par stack) ; ce loop porte la **cadence** et l'**eval gate**.

## 🔴 Ce que « clean » veut dire ici — et ce que ça ne veut pas dire

**`A11Y_VIOLATIONS=0` ne signifie pas « RGAA conforme ».** La skill `me:rgaa` le dit noir sur blanc : l'analyse statique couvre **~30-40 critères sur 106**, une passe runtime en couvre nettement plus, et un **audit opposable** (déclaration d'accessibilité, ARA) reste un audit **humain**, lecteur d'écran compris.

Ce loop clôt une seule chose : **les violations qu'un outil automatisé sait détecter**. Il ne clôt ni les critères de jugement (pertinence d'une alternative textuelle, ordre de lecture, cohérence d'un intitulé), ni les tests lecteur d'écran. Le rapport final doit donc **toujours** énoncer les deux ensembles — ce qui est vert, et ce qui reste « à vérifier manuellement ». Annoncer une conformité RGAA sur la seule sortie d'axe serait un faux-propre, et sur un sujet légal.

## Définition

- **goal** : plus aucune violation détectable automatiquement sur les routes modifiées.
- **max_iterations** : 6
- **exit_when** : la sortie du check affiche `A11Y_VIOLATIONS=0` **et** `A11Y_CHECKS` > 0 (preuve que l'outil a réellement analysé une page rendue).
- **check_command** : ci-dessous.

### La garde anti-faux-propre, ici

Un runner a11y rend **zéro violation** dans deux situations opposées : la page est propre, ou **la page n'a pas été rendue** (serveur pas démarré, 404, build cassé, bundle en erreur). C'est le faux-vert le plus facile de tout le lot, parce qu'il ressemble exactement à un succès.

D'où deux preuves exigées avant tout verdict :
1. **chaque URL répond 200 avec un corps non vide** (sondage `curl` avant l'audit) ;
2. **`A11Y_CHECKS > 0`** — le total `violations + passes + incomplete + inapplicable` rapporté par axe. Une page rendue en produit des centaines ; une page vide en produit zéro.

```bash
set -o pipefail
# URLs à auditer : $RGAA_URLS (séparées par des espaces), sinon on s'arrête et on demande.
# Les routes MODIFIÉES se déduisent du diff — c'est au loop de les fournir (cf. Discovery).
[ -n "$RGAA_URLS" ] || { echo "❌ aucune URL à auditer — passer RGAA_URLS=\"http://… http://…\""; exit 2; }

# (1) RUNNER DÉJÀ PRÉSENT — on n'installe RIEN (règle de me:rgaa : proposer, jamais installer).
if   [ -x node_modules/.bin/axe ];      then RUNNER=axe
elif [ -x node_modules/.bin/pa11y ];    then RUNNER=pa11y
else
  echo "❌ aucun runner a11y dans le projet (ni @axe-core/cli ni pa11y en dépendance)"
  echo "   → proposer l'ajout à l'utilisateur, ne pas l'installer d'autorité."
  echo "   → sinon : audit statique via la skill me:rgaa, qui n'a pas besoin de ce loop."
  exit 2
fi
echo "▶ runner: $RUNNER"

# (2) SONDAGE : preuve que chaque page est réellement servie.
for U in $RGAA_URLS; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$U" 2>/dev/null)
  SIZE=$(curl -s --max-time 15 "$U" 2>/dev/null | wc -c | tr -d ' ')
  if [ "$CODE" != "200" ] || [ "${SIZE:-0}" -lt 200 ]; then
    echo "❌ $U → HTTP $CODE, ${SIZE:-0} octets — page non servie ou vide"
    echo "   (ne PAS lire 0 violation comme une page propre : lancer le build/preview d'abord)"
    exit 2
  fi
done

# (3) AUDIT → JSON, agrégé sur toutes les URLs.
OUT=$(mktemp); trap 'rm -f "$OUT"' EXIT
if [ "$RUNNER" = axe ]; then
  node_modules/.bin/axe $RGAA_URLS \
    --tags wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa \
    --stdout --format json > "$OUT" 2>/dev/null || true
else
  node_modules/.bin/pa11y --reporter json --standard WCAG2AA $RGAA_URLS > "$OUT" 2>/dev/null || true
fi

# (4) VERDICT + garde « l'outil a-t-il vraiment tourné ».
python3 - "$OUT" "$RUNNER" <<'PY'
import json, sys
raw = open(sys.argv[1], encoding="utf-8", errors="replace").read().strip()
if not raw:
    print("❌ sortie du runner vide — l'audit n'a pas tourné"); print("A11Y_CHECKS=0"); sys.exit(2)
try:
    data = json.loads(raw)
except Exception as e:
    print("❌ sortie du runner illisible (%s) — pas un verdict" % e); print("A11Y_CHECKS=0"); sys.exit(2)

pages = data if isinstance(data, list) else [data]
viol, checks, lines = 0, 0, []
for p in pages:
    if sys.argv[2] == "axe":
        v = p.get("violations") or []
        viol += len(v)
        checks += sum(len(p.get(k) or []) for k in ("violations", "passes", "incomplete", "inapplicable"))
        for r in v:
            lines.append("- [%s] %s — %d nœud(s) · %s"
                         % (r.get("impact") or "?", r.get("id"), len(r.get("nodes") or []), p.get("url", "")))
    else:  # pa11y : liste plate d'issues, pas de compte de règles passées
        errs = [i for i in pages if (i.get("type") == "error")] if isinstance(data, list) else []
        viol = len(errs); checks = len(pages)
        lines = ["- [%s] %s — %s" % (i.get("type"), i.get("code"), i.get("selector")) for i in errs]
        break

print("=== violations ===")
print("\n".join(lines) if lines else "(none)")
print("A11Y_CHECKS=%d" % checks)
print("A11Y_VIOLATIONS=%d" % viol)
PY
RC=$?
[ "$RC" -ne 0 ] && exit "$RC"
```

## Cycle

- **Discovery** :
  1. **Routes modifiées** — déduire du diff (`git diff --name-only origin/<base>...HEAD`) quelles pages/routes sont touchées, puis les traduire en URLs. Auditer tout le site à chaque passe est du gaspillage ; le loop porte sur ce que la PR change.
  2. **Serveur** — retenir **build + preview** plutôt que `dev` : le dev server saute des étapes (index de recherche, service worker, images optimisées, CSP) et l'audit y serait faux. C'est la règle de `me:rgaa`, elle vaut ici.
  3. **Lire `me:rgaa`** — stack, DSFR ou non, et surtout `references/tools.md` §Procédure runtime avant tout runtime.
- **Planning** : grouper les violations **par règle CSS/composant fautif** avant de corriger — une règle axe qui remonte 40 nœuds est presque toujours **une** correction, pas 40.
- **Execution** :
  Step 1: lancer le `check_command`, lire le bloc `violations` + `A11Y_CHECKS` + `A11Y_VIOLATIONS`.
  Step 2: corriger via `me:rgaa` mode `fix` — **diff chirurgical**, style existant respecté. Interdits repris de la skill : ARIA redondant (`role="alert"` + `aria-live`), `tabindex > 0`, `aria-hidden` sur un élément focusable, `outline: none` sans `:focus-visible` de remplacement.
- **Verification** : rebuild + relancer le `check_command`.
- **Iteration** : reboucler ; sinon stop/handback avec le rapport en deux parties (automatique vert / manuel restant).

## Protocole self-pace (compteur à 1)

0. Lire les guardrails (`git rev-parse --path-format=absolute --git-path loop-guardrails.md`).
1. Exécuter les steps (corriger les violations groupées par cause).
2. Lancer le `check_command` et **LIRE sa sortie réelle**.
3. Évaluer `exit_when` : `A11Y_VIOLATIONS=0` **et** `A11Y_CHECKS > 0` → **STOP**, annoncer le succès en citant les deux compteurs — **et** en rappelant ce qui reste manuel.
4. Sinon incrémenter. Si compteur ≥ 6 → **STOP**, annoncer la limite + les violations qui résistent.
5. Même violation qu'une passe antérieure → appender un sign aux guardrails avant de retenter.
6. Sinon recommencer.

Status : `🔁 Itération N/6 — <corrections> → check: A11Y_VIOLATIONS=<n> (checks <n>)`.

## Garde-fous

- 🔴 Bloc anti-triche `hardened` de `me:run-loop`, avec ici une déclinaison qui mord : **jamais de contournement pour faire taire axe**. `aria-hidden` posé pour supprimer une violation, `role` bidon, désactivation d'une règle dans la config du runner — c'est le cas 4 du bloc (« remplacer une assertion réelle par un test toujours vert ») appliqué à l'accessibilité. Le résultat est pire que la violation : la page reste inutilisable et l'outil ne le dit plus.
- 🔴 **`A11Y_CHECKS=0` n'est jamais un succès** — c'est une page non rendue.
- 🔴 **Ne jamais installer** un runner a11y d'autorité. Absent → `exit 2`, le proposer.
- 🟡 Ne jamais annoncer « conforme RGAA ». Annoncer « 0 violation automatiquement détectable sur N routes, M critères restant à vérifier manuellement ».
- 🟡 Une violation de **contraste** vient d'axe sur les éléments rendus — ne pas la recalculer à la main sur les jetons de design, et corriger le jeton plutôt que l'instance quand la même paire revient.
