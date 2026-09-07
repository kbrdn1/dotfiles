# Pool de contenu vérifié — candidatures Kylian Bardini

> **Règle absolue.** Adapter une candidature = **sélectionner, réordonner, reformuler l'accent**
> depuis ce pool. **Jamais ajouter un fait qui n'y figure pas.** Si une offre demande une compétence
> absente d'ici, on ne la fabrique pas : soit on l'omet, soit on la traite honnêtement dans la lettre
> (« je n'y suis pas encore, voici ce qui s'en rapproche »).
>
> Chaque élément porte sa source. Une source vide = à vérifier avec Kylian avant usage.

---

## Contexte de recherche

- **Cible** : Luxembourg. Frontalier depuis Nancy aujourd'hui, **installation prévue secteur Thionville**
  (Thionville → Luxembourg-Ville ≈ 30 min, contre ≈ 1 h 45 depuis Nancy — c'est un argument, il se dit).
- **Disponibilité** : formulation affichée sur les CV et lettres = **« dès que possible, préavis
  négociable »** (choix du 31/07/2026). Réalité à tenir en entretien : préavis négociable,
  1 semaine dans l'idéal, **1 mois maximum**.
- **Confidentialité** : l'employeur actuel n'est **pas** au courant. Rien de public, rien de commité
  dans `kbrdn.dev` (repo GitHub public). Livrables dans iCloud `Travail/CV/`.
- **Nationalité** : française — citoyen UE, aucune démarche de permis de travail.
- **Diplômes réellement obtenus** : BAC+2 CCI Longwy EESC, Bachelor MNS.
  **Le cursus Ingénierie Informatique (2023-2025) n'a pas donné lieu à diplôme.**
  → on écrit l'école et l'intitulé du cursus avec ses dates, **sans jamais** les mots « Master »,
  « diplômé », « titre ». On ne surenchérit pas non plus avec « non obtenu » : la formulation
  factuelle suffit et n'induit personne en erreur.
  → **« Ingénieur » ne doit pas apparaître dans le titre FR.** En EN, « Engineer » est un intitulé
  de poste courant et reste utilisable.

## État du marché luxembourgeois (relevé le 25/07/2026)

À garder en tête pour la sélection des mots-clés — ce sont des observations, pas des faits à écrire sur le CV.

- **PHP/Laravel : quasi inexistant au Luxembourg.** Moovijob renvoie 0 offre sur « développeur PHP »,
  tous filtres confondus. → Laravel/Symfony restent dans les compétences (c'est l'expérience réelle)
  mais ne portent jamais le titre ni l'accroche.
- **Java/Spring : 200+ offres** (Indeed Luxembourg, 09/07/2026), dominant en banque.
  .NET en assurance, Node+React en fintech, Python en data.
- **Go et Rust : rares et bien payés** (+5 à 10 % vs Java/Node). → `gwm` et `LazyCurl` sont des
  différenciateurs réels, pas de la décoration. Les remonter face aux profils systèmes/outillage.
- Stack type d'une SSII locale (offre InTech, Lux-Ville, 11/07/2026) : React/Vue/Angular/TS/Next ·
  Java (Spring Boot, Quarkus)/Node · GitLab, Jenkins, Docker, Kubernetes, OpenShift, Ansible ·
  JUnit, Vitest, Jest, Cypress.
- Grille : confirmé 3-5 ans ≈ 58-72 k€ brut/an. « Senior » = 6-10 ans là-bas → ne pas se titrer senior.

---

## Variantes de titre

| Cible | FR | EN |
|---|---|---|
| Défaut / full stack | Développeur Full Stack — TypeScript & Cloud | Full Stack Engineer — TypeScript & Cloud |
| Backend / API | Développeur Backend — API & Architecture | Backend Engineer — API & Architecture |
| Frontend | Développeur Frontend — Vue, Nuxt, TypeScript | Frontend Engineer — Vue, Nuxt, TypeScript |
| DevOps / Cloud | Développeur Full Stack & Cloud — AWS, CI/CD | Full Stack & Cloud Engineer — AWS, CI/CD |

---

## Expérience — Jewely x Flippad (oct. 2023 → présent)

CDI depuis **déc. 2025**, précédemment alternance. *Source : i18n/locales/fr.ts du portfolio — « CDI (anciennement alternance) ».*

### Fiches Pédagogiques — refonte complète
*Source : `app/content/fr/blogs/fiches-pedagogiques.mdx`, article publié.*

- Project lead **et** architecte backend de la refonte from scratch : 17 mois, 3 développeurs,
  une centaine de tables, ~4 000 commits sur l'API (7 800 cumulés back + front), 40+ releases
  backend avant la v1.0. Front v1.0 en mars 2026.
- Conception de l'API : architecture modulaire, moteur de recherche full-text à filtres combinés
  (niveau, thème, type de fiche, domaine scolaire), pipeline de traitement de fichiers, validation.
- Parcours de paiement Stripe couvrant abonnements individuels, achats à l'unité, licences
  établissements (mandats administratifs, invitations de collaborateurs), abonnements manuels,
  codes promotionnels.
- Migration de données legacy sans perte de référencement : préservation des URLs, plan de
  redirections, sur un site à fort trafic organique.
- Réécriture d'une plateforme entière **sans interrompre celle en production** — bascule
  conditionnée à la couverture fonctionnelle complète de l'ancienne.
- Audit de sécurité complet (authentification, validation des entrées, contrôle d'accès, paiements)
  mené en mars 2026, puis remédiation.
- Pilotage : planning, découpage en phases, priorisation avec le client, coordination d'un studio
  de design externe (La Guilde) et arbitrage de la faisabilité technique des maquettes.
- Back-office éditorial livré au client : ajout de fiches avec traitement automatique des fichiers,
  gestion des collections, statistiques, abonnements et promotions.

> ⚠️ **Le chiffre « 300 000 utilisateurs »** circule (lettre de Mehdi Dias Gomes). Il **n'apparaît pas**
> dans l'article de Kylian. **À confirmer avec lui avant tout usage.** S'il est exact, c'est le plus gros
> levier de contenu de toute la candidature et il passe en tête d'accroche.

### Autres produits
*Source : CV existant + i18n du portfolio.*

- ERP **Jewely** destiné aux bijouteries de luxe : développement de fonctionnalités, paiement en
  plusieurs fois via Alma, amélioration continue de plusieurs services.
- Configurateur de bijoux multi-marques et personnalisable pour bijouteries de luxe.
- Back-office **Assmat-Facile** : gestion des utilisateurs, opérations financières via Stripe,
  génération de rapports annuels, exports de données et statistiques.
- Déploiement production et pré-production sur **AWS et Heroku via GitHub Actions** :
  API Gateway, Lambda, EC2, S3, CloudWatch.

### Période CDI (déc. 2025 → aujourd'hui)
*Source : analyse des dépôts git locaux, relevé du 25/07/2026. Tous les chiffres sont vérifiables
par `git log --author=kylianb1@icloud.com`.*

**2 980 commits depuis le 1er décembre 2025**, répartis sur six dépôts :

| Dépôt | Commits depuis le CDI | Total Kylian |
|---|---:|---:|
| `fiches-pedagogiques-api-rest` | 1 392 | **4 528 / 5 244 du dépôt (86 %)** |
| `fiches-pedagogiques-front` | 737 | 852 |
| `bijouterie-julian` (Jewely Ecommerce) | 567 | 616 |
| `luxurydigitalsolutions-erp` (Jewely ERP) | 269 | 414 |
| `jewely-brand-product-configurator` | 8 | 723 |
| `assmat-facile` | 7 | 177 |

#### Jewely Ecommerce — CMS e-commerce multi-tenant (juin → juillet 2026, 616 commits en 6 semaines)
Laravel 12 / PHP 8.3, dashboard Vue 3 + Inertia + TypeScript, storefronts Alpine.js + Blade,
Tailwind 4, Vite 6, MySQL 8, Redis 7, AWS S3 + CloudFront, Docker Swarm + Traefik, GitHub Actions.
Un socle, trois boutiques de marque, deux en production.

- **Paiements — 95 commits, le scope dominant.** Passerelles activables par boutique : Stripe, Alma
  (2x/3x/4x), Sogecommerce, Apple Pay (fichier `.well-known` scopé par boutique via route stateless),
  crypto via Lyzi. Liens de paiement avec acompte, templates transactionnels Brevo dédiés.
  Durcissement du *gating* des chemins-argent suite à revue de code (lecture DB fraîche sur les gates).
- **Registre de feature flags par boutique** (#381) : modules, wishlist, bandeau, disponibilité des
  passerelles, pilotables depuis le dashboard.
- **Migration du dashboard en 100 % TypeScript** (#319) : mise en place d'un *ratchet* de typage
  `vue-tsc` en CI (baseline **1 721** erreurs), puis **1 721 → 0**, zéro `any`, `allowJs:false`.
  Scripts `type-check:ratchet` et `no-any:check` de sa main — la CI échoue à la moindre régression.
- **Release engineering** : 8 versions de v1.0.0 à v1.2.3 en six semaines, `config/version.php`
  comme source unique, changelog tenu, propagation `dev → main → preprod` sur un monorepo multi-boutiques.
- Synchronisation ERP → e-commerce : exclusion de marques, backfill, caractéristiques produit,
  l'ERP promu source de vérité.
- Intégrations : Tudor e-Stock (+ tracking UTM), Instagram Graph API, microsites de marques
  horlogères, i18n N-langues du branding, sitemaps, recherche, médias vidéo.
- Analyses techniques rédigées : intégration Lyzi crypto, Tudor e-Stock, Apple/Google/Samsung Pay,
  évaluation de l'upgrade Laravel 13.

#### Fiches Pédagogiques — mise en production et exploitation (déc. 2025 → juillet 2026, 2 129 commits)
- Lancement de la plateforme refondue, puis 4 versions (v1.0.1 → v1.3.0).
- **Plan de redirections 301/410** et mapping des URLs legacy (`/fiches/*`, `/classe/*`, alias de
  cycle) sur un site à fort trafic organique — le SEO n'a pas été perdu à la bascule.
- **Observabilité et conformité** : intégration Sentry front (wizard, source maps région EU),
  Google Analytics 4, opt-in newsletter RGPD décoché par défaut.
- Côté API, scopes dominants : statistiques, authentification, recherche, licences établissements,
  Stripe et paiements, contrôle d'accès. Commande `school:audit-license-access` (diagnostic + réparation).
- Côté front : back-office, composables, stores, typage — 737 commits.

#### Jewely ERP — module d'import (déc. 2025 → mars 2026, 269 commits dont 232 sur l'import)
- **Architecture d'import extensible à plugins** : drivers Shopify et Zoho, découpage en phases,
  détection automatique des entités, UI de progression et de reporting, options CLI, configuration
  par fichier pour paramétrer un nouveau client sans toucher au code.
- Sert l'onboarding : reprendre le catalogue d'un client depuis sa plateforme d'origine.

#### 🔴 Reste à confirmer avec Kylian
- Encadre-t-il / mentore-t-il quelqu'un ? C'est le signal qui fait passer de « confirmé » à « lead ».
- Chiffres produit qu'un git log ne donne pas : utilisateurs, CA, trafic, volume de commandes.
- Ce qui a changé de périmètre et d'autonomie au passage en CDI.

---

## Expérience — Virtual Immersion (nov. 2022 → sept. 2023, alternance)
*Source : i18n/locales/fr.ts du portfolio.*

- API de gestion de fichiers en Symfony.
- Intégration d'expériences d'immersion en réalité mixte sur WordPress.
- Navigation cartographique interactive d'un parc animalier en React.
- Application des principes d'architecture logicielle (MVC, CRUD, Atomic Design).

---

## Projets open source
*Source : articles de blog `app/content/fr/blogs/*.mdx`.*

### gwm — gestionnaire de git worktrees (Rust)
Binaire unique, CLI + TUI ratatui. Convention de branche `<type>/#<issue>-<desc>` partagée entre
projets, bootstrap déclaratif par repo (`.gwm.toml`), garde-fou TOFU sur les fichiers
d'environnement (né d'un incident réel : `RefreshDatabase` lancé contre une base RDS de production),
API JSON + daemon, mode workspace multi-repo. **1.0 fin juin 2026**, contrats machine gelés sous
SemVer. libgit2 vendored. Remplace des wrappers bash par projet.

### LazyCurl — client HTTP en TUI (Go)
Bubble Tea + Lipgloss. Layout multi-panneaux inspiré de Lazygit, navigation vim, collections
versionnables avec le code (`.lazycurl/`), variables d'environnement `{{var}}`, scripting JavaScript
(75+ méthodes d'API), assertions de test (16 matchers), import de commandes cURL, de specs
OpenAPI 3.x et de collections Postman. Binaire unique, démarrage ~50 ms.

### dotfiles
Environnement de développement reproductible : chezmoi pour les configs, Nix pour les outils,
bootstrap en une commande. Open source.

### kbrdn.dev
Portfolio et blog technique : Nuxt 4, Nuxt Content v3 (collections), i18n FR/EN, Nuxt UI v4,
Tailwind 4, Docker multi-stage, CI/CD GitHub Actions vers Dokploy sur VPS.

---

## Compétences — par preuve

| Techno | Preuve | Utilisable comme |
|---|---|---|
| TypeScript, Vue, Nuxt, React | Flippad + portfolio | expérience professionnelle |
| Laravel, Symfony, PHP | Flippad + Virtual Immersion | expérience professionnelle |
| Node.js, Hono.js, AdonisJS, Prisma, Drizzle | Flippad + cursus | expérience professionnelle |
| AWS (Lambda, API Gateway, EC2, S3, CloudWatch), Heroku | Flippad, déploiements réels | expérience professionnelle |
| Docker, GitHub Actions, Nginx | Flippad + portfolio | expérience professionnelle |
| Stripe, Alma | Flippad, parcours de paiement complets | expérience professionnelle |
| Elasticsearch, Redis, MySQL, MongoDB | Flippad + cursus | expérience professionnelle |
| Rust | gwm 1.0, projet abouti et publié | projet personnel abouti |
| Go | LazyCurl, projet abouti et publié | projet personnel abouti |
| Kubernetes, Blockchain, Deep/Machine learning, Flutter, C#/.NET | **cursus uniquement** | ne pas présenter comme de l'expérience |
| **Java, Spring Boot** | licence uniquement | 🔴 **à construire** — cf. ci-dessous |

### 🔴 Java / Spring Boot — décision prise le 25/07/2026
Kylian s'y met. Tant qu'il n'existe pas de projet réel, **Java n'apparaît nulle part**.
Dès qu'un projet tourne (une API Spring Boot déployée, testée, publiée sur GitHub), il rejoint
« Projets open source » et débloque le segment banque/consulting — 200+ offres.
Emplacement réservé dans le pool, pas dans le CV.

---

## Langues

- Français — langue maternelle.
- Anglais — **écrit et compréhension courants, oral opérationnel.** Profil dissocié, confirmé par
  Kylian le 25/07/2026 : lecture et rédaction sans difficulté (documentation technique au quotidien),
  compréhension orale quasi sans problème, mais **production orale lente** — recherche de mots et
  construction de phrases, faute de pratique depuis le lycée.
  → On écrit la formulation descriptive, **pas un niveau CECRL sec**. Un « B2 » déclenche un
  screening téléphonique en anglais dès le premier appel, c'est-à-dire pile sur son point faible ;
  la formulation descriptive gère l'attente sans mentir et sans se saborder.
  → EN : « fluent written and comprehension, working proficiency spoken ».
- Allemand / Luxembourgeois — aucun. Ne pas inventer une ligne « notions ».

---

## Loisirs

Confirmés par Kylian le 03/08/2026 : **littérature, histoire, sport, jeux vidéo.**

Rendus sur une seule ligne (`Littérature · Histoire · Sport · Jeux vidéo`), sans détail ni
justification — la rubrique sert d'accroche de fin d'entretien, pas d'argument technique. Ne pas
gonfler avec des sous-catégories ou des titres d'œuvres : chaque ligne ajoutée se prend sur le
budget d'une page.
→ EN : « Literature · History · Sport · Video games ».

Orthographe : « jeux vidéo » — *vidéo* est invariable en apposition. Ne pas écrire « jeux vidéos ».

---

## Accroches — variantes

**Défaut (full stack)**
> Développeur full stack depuis 2022, en CDI chez Jewely x Flippad après deux ans d'alternance dans
> la même équipe. Project lead et architecte backend de la refonte complète d'une plateforme
> éducative : 17 mois, 3 développeurs, ~4 000 commits côté API. Du TypeScript/Vue au Laravel/Node
> jusqu'au déploiement AWS.

**Backend / architecture**
> Architecte backend et project lead d'une refonte de plateforme menée sur 17 mois : une centaine
> de tables, moteur de recherche full-text, parcours de paiement Stripe multi-cas, migration de
> données sans perte de référencement. En CDI chez Jewely x Flippad depuis décembre 2025.

**Frontend**
> Développeur full stack orienté interface : Vue, Nuxt et TypeScript au quotidien chez Jewely x
> Flippad, sur un ERP pour bijouteries de luxe et un configurateur produit multi-marques. Solide
> côté backend, ce qui rend le dialogue avec l'API immédiat.

**Cloud / DevOps**
> Développeur full stack qui possède aussi sa chaîne de déploiement : production et pré-production
> sur AWS et Heroku via GitHub Actions (API Gateway, Lambda, EC2, S3, CloudWatch), Docker, Nginx.
> Côté outillage, deux binaires publiés en Rust et en Go.
