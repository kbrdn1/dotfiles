# Analyse de convergence — quand arrêter une boucle de review

> Référence **partagée** par `me:loop:codex-review-pr` et `me:loop:claude-review-pr`.
> Elle vaut pour tout loop dont l'eval gate est un **reviewer LLM** (par opposition à un
> code de sortie de test, qui converge tout seul). Éditer **ici**, pas dans les loops.

Un reviewer LLM trouve **toujours** quelque chose à dire sur du code non trivial. Boucler jusqu'à `P0P1P2_COUNT=0` suppose que la suite des findings converge vers zéro ; en pratique elle converge vers l'épuisement du reviewer. Sans cette analyse, la boucle passe de « corriger des défauts » à « durcir des garde-fous contre des scénarios de plus en plus improbables » sans que rien ne le signale.

D'où une **troisième sortie**, `exit_on_stagnation`, distincte du succès : on s'arrête avec un `P0P1P2_COUNT` non nul, en l'annonçant comme tel et en listant ce qui reste. Ce n'est pas un échec : c'est reconnaître qu'une passe de plus produirait du durcissement théorique au lieu d'un correctif.

**Quand la dérouler** : à partir de l'itération 3, puis à chaque passe. Ne pas attendre `max_iterations` — arrêter à la 4ᵉ passe quand c'est justifié vaut mieux que d'en enchaîner quatre de plus par automatisme.

Tenir un tableau des passes dès la première : `passe | findings | P0 | P1 | P2 | nature`. Il se lit d'un coup d'œil et c'est lui qui tranche.

## Les cinq signaux

| # | Signal | Comment l'observer | Ce qu'il veut dire |
|:--|:--|:--|:--|
| 1 | **Findings auto-générés** | Le finding pointe-t-il une ligne du diff métier, ou une ligne écrite pour corriger une passe **antérieure** ? (`git log -S` / `git blame` sur la ligne citée) | Le plus fort. Deux passes de suite à corriger ses propres correctifs ⇒ la boucle s'auto-alimente. |
| 2 | **Gravité qui s'effondre** | P0/P1 en baisse, P2 en hausse ou stable | La valeur marginale décroît. |
| 3 | **Scénarios improbables** | Écrire le scénario du finding en une phrase, avec toutes ses conjonctions. « Si A **et** B **et** C, alors… » | Trois conjonctions ou plus ⇒ on durcit du théorique. |
| 4 | **Premier faux positif** | Un finding réfutable par une preuve (test qui passe, code du framework) | Signal net d'épuisement : le reviewer racle. |
| 5 | **Code jamais exécuté** | Le chemin corrigé a-t-il tourné contre le vrai système (API tierce joignable, service démarré) ? | **Décisif.** Durcir du code non exécuté, c'est raffiner des hypothèses. La prochaine information utile vient d'une recette, pas d'une passe. |

## La décision

- **Continuer** — les findings portent encore sur le diff métier, ou au moins un P0/P1 décrit un scénario plausible en exploitation.
- **`exit_on_stagnation`** — signal 1 sur deux passes consécutives, **ou** signal 5 combiné à (2, 3 ou 4).

Un signal isolé ne suffit pas : une passe qui trouve un vrai P1 dans un garde-fou reste utile (ça arrive — un fail-closed mal ordonné, un token oublié dans une liste de neutralisation).

## Le rapport d'arrêt

Ne jamais s'arrêter sur un simple « ça n'avance plus ». Produire :

1. Le **tableau des passes** complet.
2. Le **basculement** : à partir de quelle passe les findings ont cessé de porter sur le code métier.
3. La **trajectoire de gravité**, en citant le finding le plus grave de la première passe et celui de la dernière — le contraste fait la démonstration.
4. Les **findings restants**, avec pour chacun : corrigé / réfuté (avec preuve) / laissé de côté (avec la raison).
5. Ce qui **reste à valider hors review** — c'est là qu'est la vraie information suivante.

## Le piège que cette analyse ne couvre pas

La review ne voit que le diff. Pendant une boucle longue, ce qui se passe **à côté** est invisible : effets de bord d'exécution, e-mails partis, écritures chez un tiers, fichiers touchés. Vécu (#440, juillet 2026) : huit passes à raffiner des scénarios théoriques pendant que la suite de tests expédiait 18 vrais e-mails chez le client — aucune passe ne l'a vu, ce n'était pas dans le diff.

Donc, dès qu'une passe touche un chemin à effet externe (envoi, paiement, écriture chez un tiers, upload) : vérifier **une fois** ce que la suite de tests provoque réellement, avant de reboucler. Une garde d'environnement dans le service concerné coûte moins cher qu'un client qui découvre le problème à ta place.
