---
name: loop:test-until-green
description: Loop auto-cadencé générique (tout langage) — détecte le runner de tests du projet, le relance et corrige jusqu'à ce que tous les tests passent (exit 0), max 10 itérations. Déclencheurs : "/loop:test-until-green", "lance le loop test-until-green", "boucle jusqu'à ce que les tests soient verts".
---

# loop:test-until-green

Loop auto-cadencé **générique, adapté à tout langage**. **mode:** closed · **trigger:** self-pace · **exécution:** single.
Applique le **PROTOCOLE SELF-PACE** ci-dessous (canonique dans `me:run-loop`).

## Définition

- **goal** : tous les tests du projet passent (runner auto-détecté, indépendant du langage)
- **max_iterations** : 10
- **exit_when** : la commande de test détectée sort avec le code 0 (ligne `TESTS_EXIT=0`)
- **check_command** (eval gate) : auto-détecte le runner de tests et le lance. Commande complète :

```bash
set -o pipefail
if   [ -f Makefile ] && grep -qE '^test:' Makefile;            then CMD=(make test)
elif [ -f package.json ] && grep -q '"test"' package.json; then
       if   [ -f bun.lockb ] || [ -f bun.lock ];  then CMD=(bun test)
       elif [ -f pnpm-lock.yaml ];                then CMD=(pnpm test)
       elif [ -f yarn.lock ];                     then CMD=(yarn test)
       else                                            CMD=(npm test); fi
elif [ -f Cargo.toml ];                                        then CMD=(cargo test)
elif [ -f go.mod ];                                            then CMD=(go test ./...)
elif [ -f deno.json ] || [ -f deno.jsonc ];                    then CMD=(deno test -A)
elif [ -f mix.exs ];                                           then CMD=(mix test)
elif [ -f composer.json ]; then
       if   [ -x vendor/bin/pest ];    then CMD=(vendor/bin/pest)
       elif [ -x vendor/bin/phpunit ]; then CMD=(vendor/bin/phpunit)
       else                                 CMD=(composer test); fi
elif [ -f pyproject.toml ] || [ -f pytest.ini ] || [ -f tox.ini ] || [ -d tests ]; then CMD=(pytest -q)
elif [ -f Gemfile ] && { [ -f .rspec ] || [ -d spec ]; };      then CMD=(bundle exec rspec)
elif [ -f pom.xml ];                                           then CMD=(mvn -q test)
elif [ -f build.gradle ] || [ -f build.gradle.kts ];           then CMD=(./gradlew test)
else echo "❌ Runner de tests non détecté — précise le check_command pour ce projet"; exit 2; fi
echo "▶ ${CMD[*]}"
"${CMD[@]}"; CODE=$?
echo "TESTS_EXIT=$CODE"
exit $CODE
```

## Cycle

- **Discovery** : identifier le runner de tests réel du projet (le `check_command` le détecte ; si « Runner non détecté » → demander/préciser la commande de test, ex. un script custom).
- **Planning** : à partir des échecs, cibler la plus petite cause racine à corriger en premier.
- **Execution** :
  Step 1: Lancer les tests (`check_command`). En cas d'échec, corriger la plus petite cause racine, puis recommencer.
- **Verification** : lire la sortie réelle (échecs + `TESTS_EXIT`).
- **Iteration** : corriger la cause racine (jamais skip/désactiver un test) ; reboucler ou stop quand vert.

## Protocole self-pace (compteur à 1)

1. Exécuter le ou les steps (corriger la plus petite cause racine).
2. Lancer le `check_command` et **LIRE sa sortie réelle**. Ne jamais supposer le résultat.
3. Évaluer `exit_when` : si `TESTS_EXIT=0` → **STOP**, annoncer le succès (citer la preuve dans la sortie).
4. Sinon incrémenter. Si compteur ≥ 10 → **STOP**, annoncer la limite sans succès + ce qui bloque.
5. Sinon recommencer.

Status à chaque passe : `🔁 Itération N/10 — <tenté> → check: <résultat>`.

Garde-fous : ne jamais dépasser `max_iterations` ; jamais de succès sans `TESTS_EXIT=0` vu dans la sortie ; jamais skip/désactiver une validation — corriger la cause racine. Si le runner n'est pas détecté (exit 2), **stopper et demander** la commande de test plutôt que boucler à vide.
