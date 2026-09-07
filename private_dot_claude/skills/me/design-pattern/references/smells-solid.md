# Code smells → SOLID → refactoring

Grille de diagnostic de `analyze`. Les 23 smells sont ceux du catalogue [refactoring.guru/refactoring/smells](https://refactoring.guru/refactoring/smells) (5 catégories), les techniques celles du [catalogue Fowler](https://refactoring.com/catalog/), SOLID celui de R. C. Martin.

**Sens de lecture** : le smell est le **symptôme observable**, le principe violé est la **cause**, la technique est le **remède**. Un pattern n'arrive qu'en quatrième position, et seulement si le refactoring seul ne suffit pas.

> ⚠️ Un smell n'est **pas** un bug. C'est une odeur : elle justifie de regarder, pas de refactorer. Chaque ligne ci-dessous a sa colonne « pas un smell quand » — elle est obligatoire à traverser avant d'écrire un finding.

---

## Bloaters — ça a grossi sans qu'on regarde

| Smell | Signal mesurable | Principe | Remède | Pas un smell quand |
|---|---|---|---|---|
| **Long Method** | > ~50 lignes, ou plus d'un niveau d'abstraction dans le corps | SRP | Extract Function · Replace Temp with Query · decompose conditional | c'est une séquence linéaire sans branche (setup, config, migration) — la découper la rend *moins* lisible |
| **Large Class** | nombre de champs sans cohésion, groupes de méthodes disjoints | SRP | Extract Class · Extract Delegate | c'est une façade explicite avec une seule raison de changer |
| **Primitive Obsession** | `string`/`int` porteurs de règles (devise, e-mail, id) validées à N endroits | — | Replace Primitive with Object · Value Object · newtype | valeur sans invariant, un seul call site |
| **Long Parameter List** | > 4-5 params, ou params qui voyagent toujours ensemble | — | Introduce Parameter Object · Preserve Whole Object | params réellement indépendants ; le langage a des named args |
| **Data Clumps** | les 3 mêmes champs répétés dans 5 signatures | — | Extract Class · Parameter Object | co-occurrence accidentelle (2 fois ≠ un motif) |

## Object-Orientation Abusers — l'objet est là, pas la conception

| Smell | Signal | Principe | Remède | Pas un smell quand |
|---|---|---|---|---|
| **Switch Statements** | même `switch` sur le même type dupliqué à plusieurs endroits | **OCP** | Replace Conditional with Polymorphism · Strategy · State | un seul switch, cas fermés, exhaustivité vérifiée par le compilateur (`match` Rust, union TS) — c'est **la bonne réponse**, pas un smell |
| **Temporary Field** | champ rempli seulement pendant un appel | SRP | Extract Class · passer en paramètre / valeur de retour | — |
| **Refused Bequest** | la sous-classe hérite de méthodes qu'elle ne veut pas / qu'elle fait planter | **LSP** | Replace Inheritance with Delegation · remonter/descendre les membres | héritage purement pour l'interface (préférer alors une interface) |
| **Alternative Classes with Different Interfaces** | deux classes font la même chose avec des noms différents | ISP / LSP | Rename Method · Extract Superclass · unifier | domaines réellement distincts avec un vocabulaire propre |

## Change Preventers — un changement en impose dix

| Smell | Signal | Principe | Remède | Pas un smell quand |
|---|---|---|---|---|
| **Divergent Change** | une classe modifiée pour des raisons **sans rapport** (compter les motifs dans `git log`) | **SRP** | Extract Class · Split Phase | — |
| **Shotgun Surgery** | un changement → N fichiers touchés à chaque fois (le mesurer sur l'historique) | SRP / OCP | Move Function/Field · Inline Class · centraliser | changement transverse ponctuel (renommage) |
| **Parallel Inheritance Hierarchies** | ajouter une classe ici en impose une là-bas | — | Move Function · fusionner les hiérarchies | — |

## Dispensables — ça n'a rien à faire là

| Smell | Signal | Principe | Remède | Pas un smell quand |
|---|---|---|---|---|
| **Duplicate Code** | même logique en N exemplaires | DRY | Extract Function · Pull Up Method | **2 occurrences.** Règle AHA : attendre la 3ᵉ. Une mauvaise abstraction coûte plus cher que la duplication |
| **Dead Code** | inatteignable, jamais appelé (le vérifier : dynamique, réflexion, API publique) | — | supprimer | code exporté d'une lib, chemin appelé par config/reflection |
| **Lazy Class** | classe qui ne fait presque rien | — | Inline Class | classe volontairement minimale (Value Object, marker) |
| **Data Class** | que des champs + getters/setters | — | Move Function (rapprocher le comportement des données) | DTO de frontière, struct de config — **c'est leur rôle** |
| **Speculative Generality** | abstraction, hook, paramètre, interface à une seule impl « pour plus tard » | YAGNI | Collapse Hierarchy · Inline Class · Remove Parameter | point d'extension **utilisé** par un tiers réel |
| **Comments** | commentaire qui explique un code obscur | — | Extract Function · Rename · rendre l'intention lisible | commentaire qui explique un **pourquoi** (workaround, contrainte métier, décision) — celui-là est précieux, ne jamais le supprimer |

## Couplers — ça se connaît trop bien

| Smell | Signal | Principe | Remède | Pas un smell quand |
|---|---|---|---|---|
| **Feature Envy** | une méthode utilise plus les données d'une autre classe que les siennes | SRP | Move Function · Extract Function | orchestrateur assumé (service layer) |
| **Inappropriate Intimacy** | accès à l'interne d'une autre classe, dépendance croisée | Demeter | Move Function · Hide Delegate · Extract Class | — |
| **Message Chains** | `a.b().c().d().e()` | Demeter | Hide Delegate · Extract Function | chaîne fluide *conçue* pour ça (builder, query builder) — pas un smell |
| **Middle Man** | classe dont toutes les méthodes délèguent | — | Remove Middle Man · Inline | façade voulue à une frontière (adapter, port) |
| **Incomplete Library Class** | il manque une méthode à une lib qu'on ne peut pas modifier | OCP | Introduce Foreign Method · Local Extension / wrapper | — |

---

## SOLID — le principe, le smell qui le trahit, le test

| Principe | Trahi par | Le test qui tranche | Le piège inverse |
|---|---|---|---|
| **S** — Single Responsibility | Large Class, Divergent Change, Long Method | *« Combien d'acteurs différents peuvent demander de modifier ce fichier ? »* (Martin : une responsabilité = un acteur, pas « fait une seule chose ») | classes à une méthode partout, logique éclatée en 40 fichiers |
| **O** — Open/Closed | Switch Statements dupliqués, Shotgun Surgery à chaque nouveau cas | *« Ajouter un cas m'oblige-t-il à éditer du code existant et testé ? »* Si le cas suivant est ajouté par toi la semaine prochaine, la réponse « oui » est acceptable | points d'extension partout pour des cas qui n'arrivent jamais |
| **L** — Liskov Substitution | Refused Bequest, `throw NotImplemented`, `instanceof` chez l'appelant | *« La sous-classe peut-elle remplacer la base sans que l'appelant sache lequel il tient ? »* | hiérarchies figées par peur de casser LSP — la composition résout la plupart des cas |
| **I** — Interface Segregation | interface large dont chaque impl ignore la moitié | *« Une implémentation est-elle forcée de dépendre de méthodes qu'elle n'utilise pas ? »* | une interface par méthode, illisible |
| **D** — Dependency Inversion | `new Postgres()` en dur dans le domaine ; tests impossibles sans I/O | *« Existe-t-il une deuxième implémentation réelle (mock utilisé compris) ? »* Sinon l'interface est de la Speculative Generality | abstraction de tout, y compris de ce qui ne changera jamais (`Date`, `fs`) |

**Où SOLID est faux ami.** Ce sont des heuristiques OO, nées dans un contexte Java/C#. En Go, Rust ou dans du code fonctionnel, la moitié se dissout : DIP = passer une `fn` en paramètre, OCP = un sum type exhaustif, LSP = sans objet sans héritage d'implémentation. Diagnostiquer avec, ne pas certifier avec.

**Ordre de traitement en `analyze`** : d'abord ce qui **casse** (LSP violé = bug latent, Observer sans désabonnement = fuite), puis ce qui **coûte** et se mesure sur l'historique git (Shotgun Surgery, Divergent Change), enfin le reste. Un smell sans coût observé est une note, pas une action.
