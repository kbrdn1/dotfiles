# Catalogue — symptôme → candidat → et surtout : quand *ne pas*

Ce fichier ne réexplique pas l'intention des patterns (le modèle la connaît, et la prose de refactoring.guru est sous copyright). Il donne les quatre colonnes que les catalogues omettent : **quand ne pas**, **l'alternative simple**, **ce que le langage rend inutile**, et le **coût réel**.

> Règle de lecture : descendre les colonnes **de gauche à droite** et s'arrêter à la première qui tient. Si « alternative simple » suffit, la recommandation est l'alternative simple — le nom du pattern ne sert alors qu'à dire « c'est un Strategy sans les classes ».

---

## Routage par symptôme

| Ce que dit le user | Candidats | Vérifier d'abord |
|---|---|---|
| « selon le type / le mode / le provider, faire autrement » | Strategy · State · dict dispatch | combien de cas, et qui ajoute le suivant |
| « une longue chaîne de `if/elif` sur un type » | Strategy · polymorphisme · table | les cas sont-ils *vraiment* ouverts ? |
| « il faut prévenir plusieurs trucs quand ça change » | Observer · pub/sub · callbacks | 1 seul abonné → appel direct |
| « l'objet se comporte différemment selon où il en est » | State · machine à états · enum + match | transitions invalides : build ou runtime ? |
| « ça branche sur une lib externe / une vieille API » | Adapter · Facade · anti-corruption layer | une fonction de 10 lignes suffit souvent |
| « construire l'objet demande 12 paramètres » | Builder · options object · named args | le langage a-t-il les kwargs ? |
| « je veux ajouter des comportements empilables » | Decorator · middleware · HOF | 2 combinaisons figées → deux fonctions |
| « il faut créer un objet dont on ignore le type exact » | Factory Method · Abstract Factory · fn de création | une `fn create(kind) -> T` suffit-elle ? |
| « une seule instance partagée » | ⚠️ Singleton — voir plus bas | 90 % du temps : injecter la dépendance |
| « des étapes de traitement enchaînées, interruptibles » | Chain of Responsibility · middleware | `array.reduce` / pipeline |
| « annuler / rejouer une action » | Command · Memento · event log | closure + pile |
| « parcourir une structure sans exposer son interne » | Iterator | le langage a des générateurs |
| « appliquer plusieurs opérations sur une hiérarchie » | Visitor · pattern matching | sum type + `match` |
| « arbre, hiérarchie, éléments qui contiennent des éléments » | Composite | type récursif |
| « deux axes qui varient indépendamment » | Bridge · génériques | produit cartésien réel ou imaginé ? |
| « trop d'objets identiques en mémoire » | Flyweight · interning · cache | mesuré au profileur ? sinon non |
| « masquer un sous-système compliqué » | Facade | un module de fonctions |
| « intercepter les accès (cache, lazy, contrôle) » | Proxy · décorateur de fonction | wrapper direct |
| « accès aux données, requêtes, persistance » | Repository · Data Mapper (PoEAA) | l'ORM en fait déjà un |
| « la logique métier est éparpillée dans les controllers » | Service Layer · Use Case (PoEAA) | souvent le bon appel |
| « N objets se parlent tous entre eux » | Mediator | ⚠️ dégénère en god object |

---

## Créationnels

| Pattern | Quand il gagne | Quand **ne pas** | Alternative simple | Le langage le mange |
|---|---|---|---|---|
| **Factory Method** | le type concret dépend d'un contexte que l'appelant ignore, et de nouveaux types viennent de l'extérieur | un seul type produit ; le type est connu de l'appelant | une fonction `create_x(kind)` ; une `dict[str, Ctor]` | Python/JS/Go/Rust : classes de première classe ou `match` → la fonction *est* le pattern |
| **Abstract Factory** | familles cohérentes de produits (backend SQL vs mémoire vs mock) qui doivent rester assorties | une seule famille ; les produits ne sont pas réellement couplés entre eux | un module par backend, choisi au boot | Go : `interface` + package. Rust : trait + impl. Pas de hiérarchie de factories |
| **Builder** | beaucoup d'optionnels **et** des invariants à valider avant construction | ≤ 4 paramètres ; aucun invariant | kwargs (Python), objet d'options (TS), `Default::default()` + struct update (Rust) | Python/Kotlin/Swift : named+default args tuent le pattern. Rust : `derive(Builder)` si vraiment nécessaire |
| **Prototype** | copier un objet coûteux dont la config est déjà correcte | objets simples | `structuredClone`, `copy.deepcopy`, `#[derive(Clone)]` | intégré partout — le pattern n'a plus de contenu hors C++ |
| **Singleton** | ⚠️ presque jamais. Une ressource unique **imposée par l'OS** (handle de device, pool de connexions) | tout le reste. C'est de l'état global déguisé : tests non isolables, ordre d'init implicite, hostile à la concurrence | **injecter** l'instance ; la créer une fois en composition root | module ESM / module Python (déjà singleton), `OnceLock`/`LazyLock` (Rust), `sync.Once` (Go) |

## Structurels

| Pattern | Quand il gagne | Quand **ne pas** | Alternative simple | Le langage le mange |
|---|---|---|---|---|
| **Adapter** | interface tierce impossible à modifier, utilisée en plusieurs points | un seul call site | une fonction de conversion | fonctions libres partout ; pas besoin de classe |
| **Bridge** | deux axes de variation **réellement** indépendants (n×m implémentations sinon) | un seul axe varie vraiment — c'est le cas le plus fréquent, et le Bridge y est du pur surcoût | génériques / trait bound / paramètre de type | Rust/TS génériques ; composition simple |
| **Composite** | traiter uniformément feuille et nœud d'un arbre | structure plate ; profondeur toujours 1 | type récursif (`type Node = Leaf \| Branch(Node[])`) | sum types + récursion : pas de hiérarchie de classes |
| **Decorator** | comportements empilables dans un ordre variable, choisis à l'exécution | 2 combinaisons connues et figées | HOF, `@decorator` (Python), middleware `(req, next)` | Python decorators, JS closures, tower/axum layers (Rust) |
| **Facade** | sous-système complexe, surface d'usage étroite | le sous-système est déjà simple — la façade devient un passe-plat (*Middle Man*) | un module exportant 3 fonctions | un fichier `index.ts` / `mod.rs` bien exposé |
| **Flyweight** | **mesuré** : millions d'objets, état intrinsèque partageable | avant d'avoir profilé. Optimisation par anticipation | cache / interning / `@lru_cache` | `intern()`, `Rc`/`Arc`, string interning natif |
| **Proxy** | contrôle d'accès, lazy loading, cache transparent, remoting | quand un appel explicite serait plus lisible — le proxy cache le coût réseau/IO, ce qui se paie en debug | wrapper explicite | `Proxy` (JS), `__getattr__` (Python), `Deref` (Rust) |

## Comportementaux

| Pattern | Quand il gagne | Quand **ne pas** | Alternative simple | Le langage le mange |
|---|---|---|---|---|
| **Chain of Responsibility** | pipeline dont les maillons sont configurables et peuvent court-circuiter | chaîne fixe de 2-3 étapes | `reduce` sur un tableau de fonctions | middleware natif (Express, axum, Laravel) |
| **Command** | undo/redo, file d'attente, journal, exécution différée | appel direct suffisant | closure + pile/queue | closures partout ; Rust : `Box<dyn FnOnce()>` |
| **Iterator** | exposer un parcours sans fuiter la structure | quand un tableau ferait l'affaire | générateur | `yield` (Python/JS), trait `Iterator` (Rust), `range` (Go 1.23) — le pattern est dans le langage |
| **Mediator** | ⚠️ N composants à couplage réellement croisé (UI complexe) | par défaut. Le médiateur **attire** la logique et devient le god object — souvent le smell qu'on croyait soigner | event bus, ou simplement remonter l'état d'un cran | store/reducer, signals |
| **Memento** | snapshot/restore d'un état interne encapsulé | état déjà immuable ou trivialement copiable | structure immuable + copie | `structuredClone`, `#[derive(Clone)]`, persistent data structures |
| **Observer** | 1→N notifications, abonnés inconnus à l'écriture | 1 seul abonné connu → appel direct. ⚠️ sans désabonnement = fuite mémoire, et le flux devient intraçable en debug | callback passé en paramètre | `EventEmitter`, signals (Vue/Svelte/Solid), channels (Go/Rust), `Observable` (RxJS) |
| **State** | transitions nombreuses, comportement par état, transitions invalides à interdire | 2-3 états sans comportement propre | enum + `match` ; table de transitions | Rust : enum + `match`, ou typestate (invalides = erreur de compilation). TS : union discriminée + reducer |
| **Strategy** | algorithmes interchangeables, ajoutés par des tiers | ≤ 3 cas fermés → `match`/`switch` assumé | dict `{clé: fonction}` | fonctions de première classe : le « pattern » est un paramètre de type `fn`. Rust : `Box<dyn Fn>` ou enum |
| **Template Method** | squelette fixe, quelques points de variation, hiérarchie déjà présente | ⚠️ impose l'héritage — préférer Strategy (composition) neuf fois sur dix | fonction d'ordre supérieur prenant les hooks | HOF ; `Box<dyn Fn>` en paramètre |
| **Visitor** | opérations nombreuses sur une hiérarchie **stable** (AST, compilo) | hiérarchie qui bouge : ajouter un type casse tous les visiteurs. Le cas courant | `match` sur un sum type | pattern matching exhaustif (Rust, TS, Python 3.10+) — le double dispatch devient inutile |

## Application / persistance (Fowler, PoEAA)

| Pattern | Quand il gagne | Quand **ne pas** |
|---|---|---|
| **Repository** | isoler le domaine du stockage ; requêtes métier nommées ; tests sans DB | l'ORM (Eloquent, Prisma, ActiveRecord) est déjà un Repository — en empiler un second est un passe-plat |
| **Unit of Work** | plusieurs écritures à valider atomiquement | la transaction du framework suffit |
| **Data Mapper / Active Record** | Mapper : domaine riche découplé du schéma · AR : CRUD proche du schéma | ne pas mélanger les deux dans un même repo |
| **Service Layer / Use Case** | logique métier éparpillée dans les controllers ; réutilisée par HTTP + CLI + jobs | une seule entrée, logique triviale → controller |
| **DTO** | frontière de sérialisation (HTTP, queue) | à l'intérieur d'une même couche |
| **CQRS** | lecture et écriture ont des contraintes **réellement** divergentes (charge, modèle) | ⚠️ par défaut. Coût énorme, souvent adopté par mimétisme |
| **Event sourcing** | l'historique **est** le métier (compta, audit légal) | ⚠️ « au cas où » — irréversible en pratique |

---

## Trois pièges récurrents

1. **Le pattern qui répond à la mauvaise question.** Strategy vs State : Strategy = *l'appelant* choisit le comportement, State = *l'objet* le change lui-même en fonction de ce qui lui arrive. Se tromper produit une machine à états pilotée de l'extérieur — le pire des deux.
2. **La factory à un produit.** Une factory qui ne fabrique qu'un type est un constructeur avec des étapes en plus. Supprimer.
3. **L'interface anticipée.** Une interface avec une seule implémentation n'est pas du DIP, c'est de la *Speculative Generality*. Le DIP se paie quand une **deuxième** implémentation existe (le mock de test compte s'il est réel et utilisé).
