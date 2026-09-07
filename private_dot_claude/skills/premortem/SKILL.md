---
name: premortem
description: "Exécute un premortem sur n'importe quel plan, lancement, produit, recrutement, stratégie ou décision. Suppose que ça a déjà échoué 6 mois plus tard et remonte dans le temps pour trouver tous les motifs. Produit un plan révisé avec les angles morts exposés. DÉCLENCHEURS OBLIGATOIRES : 'premortem ça', 'premortem mon', 'exécute un premortem', 'qu'est-ce qui pourrait tuer ça', 'stress-teste ce plan', 'qu'est-ce que je rate ici', 'trouve les angles morts'. DÉCLENCHEURS FORTS : 'qu'est-ce qui pourrait mal tourner', 'est-ce que je rate quelque chose', 'troue ce plan', 'où ça va casser', 'avocat du diable'. NE PAS déclencher sur des demandes simples de retour, des questions factuelles ou des demandes au Conseil LLM. DÉCLENCHER quand quelqu'un a un plan ou un engagement où le coût de se tromper est élevé."
---

# Premortem

Un premortem est l'inverse d'un postmortem. Au lieu de chercher ce qui a mal tourné après qu'une chose a échoué, tu imagines qu'elle a déjà échoué et tu cherches pourquoi avant de commencer.

La méthode vient du psychologue Gary Klein. Il l'a publiée dans Harvard Business Review. Daniel Kahneman (le psychologue lauréat du prix Nobel derrière "Système 1 / Système 2 : les deux vitesses de la pensée") l'a qualifiée de technique la plus précieuse pour la prise de décision. Google, Goldman Sachs et Procter & Gamble l'utilisent avant les grandes décisions.

L'idée clé : quand tu demandes aux gens "qu'est-ce qui pourrait mal tourner ?", ils donnent des réponses prudentes et ambiguës. Quand tu dis "ça a déjà échoué, dis-moi pourquoi", le cerveau bascule en mode narratif et génère des raisons beaucoup plus spécifiques, créatives et honnêtes. Des chercheurs de Wharton et Cornell ont appelé ça la "rétrospection prospective" et ont découvert qu'elle augmente significativement la capacité à identifier les causes de résultats futurs.

Pourquoi c'est important pour les décisions assistées par IA : Claude tend vers des réponses aimables et optimistes. Si tu demandes "est-ce un bon plan ?", il trouvera des raisons de dire oui. Le premortem casse ce pattern en forçant le cadrage "c'est mort, explique comment c'est mort". Claude cesse de chercher des raisons pour lesquelles ton plan fonctionnera et commence à expliquer comment il s'est effondré.

---

## quand exécuter un premortem

Bonnes cibles pour un premortem :
- Un produit ou une fonctionnalité que tu es sur le point de construire
- Un plan de lancement avec de l'argent ou de la réputation en jeu
- Un changement de prix ou de modèle économique
- Un recrutement que tu t'apprêtes à faire
- Un pivot de stratégie ou de positionnement
- Un partenariat ou un accord que tu évalues
- Tout engagement où le coût de se tromper est élevé

Mauvaises cibles pour un premortem :
- Des idées vagues sans aucun plan concret encore (aide-les à planifier d'abord, puis fais le premortem)
- Des questions avec une seule réponse correcte (réponds-y simplement)
- Des demandes de retour créatif sur un brouillon (c'est de l'édition, pas un premortem)
- Des décisions déjà prises et irréversibles (un premortem n'est utile que quand tu peux encore changer de cap)

---

## collecte de contexte (le minimum nécessaire)

Un premortem est aussi bon que le contexte sur lequel il s'exécute. Une information vague produit des scénarios d'échec vagues qui n'aident personne. Avant d'exécuter le premortem, tu dois atteindre un seuil minimal de contexte.

### étape 1 : chercher le contexte existant

Avant de demander quoi que ce soit à l'utilisateur, cherche le contexte déjà disponible :

**A. La conversation actuelle.** L'utilisateur peut avoir discuté d'un plan, d'un lancement, d'un produit ou d'une décision plus tôt dans cette session. Lis la conversation et extrais ce qui est pertinent.

**B. L'espace de travail.** Scanne rapidement les fichiers qui peuvent contenir du contexte pertinent :
- `CLAUDE.md` ou `claude.md` (contexte d'entreprise, préférences, contraintes)
- Tout dossier `memory/` (profils d'audience, détails business, décisions passées)
- Les fichiers que l'utilisateur a explicitement référencés ou joints
- Tout fichier de projet, brief ou plan lié à ce qui est soumis au premortem

Utilise `Glob` et des appels rapides à `Read`. N'y consacre pas plus de 30 secondes. Tu cherches les fichiers clés qui ancreront les scénarios d'échec dans la réalité.

### étape 2 : évaluer la suffisance du contexte

Après le scan, vérifie si tu en as assez pour exécuter un premortem utile. Tu as besoin de trois choses :

1. **Qu'est-ce que c'est ?** — Une compréhension claire de ce qui est soumis au premortem (un produit, un lancement, un recrutement, un changement de prix, une stratégie). Tu dois pouvoir le décrire à l'utilisateur en une phrase.

2. **Pour qui c'est / qui ça affecte ?** — L'audience, le client, l'équipe, les parties prenantes. Les scénarios d'échec dépendent en grande partie de qui est impliqué.

3. **À quoi ressemble le succès ?** — Quel résultat l'utilisateur attend-il ? L'échec se définit en inversant le succès. Si tu ne sais pas ce que signifie le succès, tu ne peux pas définir ce que signifie l'échec.

### étape 3 : combler les lacunes de manière conversationnelle

Si tu as les trois, passe immédiatement au premortem. Ne pose pas de questions inutiles.

S'il t'en manque une ou plusieurs, demande d'abord la pièce manquante la plus importante. Une question à la fois. Évalue après chaque réponse si tu en as maintenant assez. Continue à demander jusqu'à atteindre le seuil, mais ne demande jamais plus que nécessaire.

Exemples de questions de contexte ciblées :
- "Qu'est-ce que tu t'apprêtes exactement à lancer / construire / décider ?" (si tu ne sais pas ce que c'est)
- "Pour qui c'est ?" (si tu connais le plan mais pas l'audience)
- "À quoi ressemblerait une victoire pour ça ?" (si tu connais le plan et l'audience mais pas les critères de succès)

L'objectif est d'atteindre le minimum le plus vite possible sans donner l'impression à l'utilisateur qu'il remplit un formulaire. Conversationnel, pas interrogatoire. Si tu peux déduire une réponse du contexte, fais-le plutôt que demander.

---

## comment se déroule une session de premortem

### étape 1 : poser le cadrage

Après avoir collecté assez de contexte, pose le cadrage du premortem explicitement. Quelque chose comme :

"Bien, j'ai assez de contexte. On lance le premortem. La prémisse : 6 mois ont passé. [Le plan / lancement / décision] a échoué. C'est fini. On regarde en arrière pour essayer de comprendre ce qui a mal tourné."

Ce cadrage compte. Il change le mode de "évalue ce plan" (qui déclenche des réponses complaisantes) à "explique pourquoi c'est mort" (qui déclenche une identification honnête et spécifique des échecs).

### étape 2 : générer les raisons d'échec (premortem brut)

Exécute le premortem brut comme une analyse unique et complète. Pas de catégories préétablies, pas de lentilles, pas de contraintes. Juste la méthode Klein de base :

"Ce plan a échoué 6 mois plus tard. Génère chaque raison authentique pour laquelle il aurait pu mourir. Sois exhaustif. Sois spécifique. Ancre chaque raison dans les détails réels du plan. Ne remplis pas avec des raisons faibles et ne t'arrête pas trop tôt s'il y en a plus."

Le résultat doit être une liste complète de raisons d'échec, chacune exprimée en 1-2 phrases. Sois honnête et exhaustif. Certains plans peuvent avoir 4 modes d'échec authentiques. D'autres peuvent en avoir 9. Le nombre doit être celui qui est réel pour ce plan spécifique.

Chaque raison d'échec doit être :
- Spécifique à ce plan (pas un conseil générique qui s'applique à n'importe quoi)
- Ancrée dans des détails réels que l'utilisateur a fournis
- Une menace authentique (pas un inconvénient mineur ou un cas extrêmement improbable)

### étape 3 : agents d'analyse approfondie (un par raison d'échec, tous en parallèle)

Prends chaque raison d'échec de l'étape 2 et lance un sous-agent par raison, tous en parallèle. Chaque agent prend sa raison d'échec assignée et l'analyse en profondeur de manière indépendante.

**Template de prompt pour sous-agent :**

```
Tu es un chercheur dans une analyse de premortem. Une raison d'échec spécifique t'a été assignée pour une analyse approfondie.

Le plan :
---
[contexte complet : qu'est-ce que c'est, pour qui c'est, à quoi ressemble le succès, plus le contexte pertinent de l'espace de travail]
---

CADRAGE DU PREMORTEM : 6 mois ont passé. Ce plan a échoué.

TA RAISON D'ÉCHEC ASSIGNÉE : [la raison d'échec spécifique de l'étape 2]

Ton travail est de creuser cet échec. Écris l'histoire de la façon dont il s'est réellement déroulé. Sois spécifique. Utilise des détails du plan. Rends-le réel, comme une étude de cas de quelque chose qui s'est vraiment produit.

Ton résultat doit inclure :

1. L'HISTOIRE DE L'ÉCHEC : Une narration de 2-3 paragraphes de la façon dont cet échec spécifique s'est déroulé. Utilise des détails du plan. Nomme des moments spécifiques où les choses ont mal tourné et pourquoi.

2. LE PRÉSUPPOSÉ SOUS-JACENT : La seule chose que l'utilisateur tenait pour acquise et qui a rendu cet échec possible. Exprime-le en une phrase.

3. SIGNAUX D'ALERTE PRÉCOCES : 1-2 signaux concrets et observables que l'utilisateur pourrait surveiller et qui indiqueraient que ce mode d'échec commence à se développer. Ce doit être des choses qu'on peut réellement voir ou mesurer, pas des sensations vagues.

Garde la réponse totale en dessous de 300 mots. Sois direct. Ne l'atténue pas. Ne l'adoucis pas.
```

### étape 4 : synthèse

Une fois que tous les agents ont terminé, lis chaque analyse approfondie et produis la synthèse :

**RAPPORT DE PREMORTEM**

1. **L'Échec Le Plus Probable** — Quel scénario d'échec est le plus probable étant donné ce que tu sais du plan ? Pourquoi ? C'est celui sur lequel l'utilisateur doit se concentrer en premier.

2. **L'Échec Le Plus Dangereux** — Quel scénario d'échec causerait le plus de dégâts s'il survenait, même s'il est moins probable ? C'est celui qui mérite d'être sécurisé.

3. **Le Présupposé Caché** — Parmi toutes les analyses d'échec, quel est le présupposé le plus important que l'utilisateur fait et qu'il n'a probablement pas remis en question ? C'est souvent là que vit la vraie valeur du premortem : ce qui est si évident pour l'utilisateur qu'il a oublié que c'était un présupposé.

4. **Le Plan Révisé** — Sur la base des scénarios d'échec, quels changements spécifiques rendraient le plan plus résilient ? Sois concret. Ne dis pas "considère ton prix". Dis "teste le prix à X € avec 20 personnes avant de t'engager publiquement". Chaque révision doit correspondre directement à un scénario d'échec spécifique.

5. **La Checklist Pré-Lancement** — 3 à 5 choses spécifiques que l'utilisateur doit vérifier, tester ou implémenter avant d'exécuter. Chacune doit prévenir ou détecter l'un des modes d'échec identifiés.

### étape 5 : générer le rapport de premortem

Génère un rapport HTML visuel et sauvegarde-le dans l'espace de travail de l'utilisateur.

**Fichier :** `premortem-report-[timestamp].html`

Le rapport doit être un fichier HTML unique autonome avec CSS en ligne. Principes de design :
- Fond sombre (#0a0e1a ou similaire), typographie propre, facile à scanner
- La section de synthèse (échec le plus probable, échec le plus dangereux, présupposé caché, plan révisé, checklist) doit apparaître de manière proéminente au début car c'est ce que la plupart des gens liront en premier
- Une carte visuelle par raison d'échec montrant l'analyse approfondie. Chaque carte doit afficher la raison d'échec en en-tête, l'histoire de l'échec, le présupposé sous-jacent et les signaux d'alerte précoces. Utilise des couleurs d'accent distinctes pour chaque carte afin qu'elles soient visuellement scannables.
- Un indicateur visuel clair de gravité / probabilité pour chaque mode d'échec
- Le visuel d'ensemble : montre le nombre d'agents qui ont été exécutés et leurs résultats comme une grille ou une disposition de cartes, pour que l'utilisateur puisse voir l'ampleur complète du premortem d'un coup d'œil
- Pied de page avec timestamp et ce qui a été soumis au premortem

Ouvre le fichier HTML après l'avoir généré.

### étape 6 : sauvegarder la transcription

Sauvegarde la transcription complète du premortem sous `premortem-transcript-[timestamp].md` au même endroit. Cela inclut :
- Le contexte qui a été collecté (quoi, qui, critères de succès)
- Les raisons d'échec du premortem brut
- Toutes les analyses approfondies des agents
- La synthèse complète

---

## format de sortie

Chaque session de premortem produit deux fichiers :

```
premortem-report-[timestamp].html    # rapport visuel à scanner
premortem-transcript-[timestamp].md  # transcription complète comme référence
```

L'utilisateur voit d'abord le rapport HTML. La transcription est disponible s'il veut creuser dans le raisonnement derrière chaque scénario d'échec.

Fournis aussi un résumé concis dans le chat : l'échec le plus probable, le présupposé caché et la seule révision la plus importante du plan. Trois phrases maximum. Le rapport contient tous les détails.

---

## exemple : premortem d'un lancement de produit

**Utilisateur :** "premortem ça : je suis sur le point de lancer un atelier en direct à 297 € sur comment utiliser Claude Cowork pour des équipes marketing. 50 places. Adressé aux directeurs marketing dans des entreprises de 10-50 employés."

**Le premortem brut identifie 6 raisons d'échec :**
1. Les directeurs marketing dans des entreprises de cette taille ont besoin d'une approbation pour dépenser 297 € en développement professionnel, ajoutant une friction que tu n'as pas anticipée
2. "Claude Cowork pour le marketing" est un pitch centré sur un outil dans un marché où la plupart des directeurs sont encore en train de décider si l'IA est pertinente pour eux
3. L'audience qui achète réellement pourrait être des solopreneurs, pas des directeurs d'équipe, créant un décalage entre le contenu et les participants
4. Construire un atelier pour des équipes marketing nécessite des environnements de démo avec des données marketing réalistes et des configurations multi-utilisateurs, ce qui prend 5 semaines de préparation, pas les 2 que tu as budgétées
5. Si 60 % des participants sont des solopreneurs, tes avis et études de cas ne résonneront pas avec l'audience de directeurs marketing dont tu as besoin pour les cohortes futures
6. À 297 € avec 50 places, le revenu maximum est de 14 850 €, ce qui peut ne pas justifier le temps de préparation face à d'autres opportunités de revenus

**6 agents creusent chaque raison de manière indépendante, produisant des histoires d'échec, des présupposés sous-jacents et des signaux d'alerte précoces.**

**Synthèse :** L'échec le plus probable est le décalage d'audience : tu vises des personnes qui ont besoin d'approbation pour dépenser 297 €, ce qui ajoute une friction que tu n'as pas anticipée. L'échec le plus dangereux : attirer des solopreneurs au lieu de directeurs d'équipe signifie que tes études de cas et témoignages ne résonneront pas avec l'acheteur cible réel pour les cohortes futures, aggravant le problème avec le temps. Présupposé caché : tu supposes que "les directeurs marketing dans des entreprises de 10-50 personnes" est une audience atteignable, mais ces personnes ne s'identifient pas comme ça et ne sont pas dans les mêmes endroits. Plan révisé : lance une session pilote à 47 € pour 20 personnes d'abord. Utilise ça pour identifier si tes vrais acheteurs sont des directeurs d'équipe ou des solopreneurs, et construis l'atelier complet pour ceux qui se présentent réellement.

---

## notes importantes

- **Lance toujours tous les agents d'échec en parallèle.** Le lancement séquentiel gaspille du temps et permet aux réponses précédentes d'influencer les suivantes.
- **Pose toujours le cadrage du premortem explicitement.** "Ça a déjà échoué" est le mécanisme psychologique qui fait fonctionner cette méthode. Sans ça, l'analyse retombe en évaluation de risques polie au lieu d'une identification honnête des échecs.
- **Sois exhaustif mais ne remplis pas.** Trouve chaque raison d'échec authentique. Ne t'arrête pas à 3 s'il y en a 7. Mais ne force pas 7 s'il n'y en a que 3. Le nombre doit être celui qui est réel pour ce plan spécifique.
- **La synthèse est le produit.** La plupart des utilisateurs liront la synthèse et survoleront les cartes d'échec individuelles. Rends la synthèse spécifique et actionnable.
- **N'adoucis pas.** Le but d'un premortem est de dire à l'utilisateur des choses qu'il ne veut pas entendre avant que la réalité ne le fasse. Si un plan a des problèmes sérieux, dis-le directement.
- **Le plan révisé doit être concret.** Ne dis pas "considère tester ton prix". Dis "lance un pilote à 47 € avec 20 personnes avant de t'engager sur l'atelier complet à 297 €". Chaque révision doit être quelque chose que l'utilisateur peut réellement faire cette semaine.
- **Respecte le seuil minimal de contexte.** Exécuter un premortem avec un contexte insuffisant produit des échecs génériques qui font perdre du temps à l'utilisateur. Mieux vaut poser une question de plus que produire un mauvais premortem.
- **Ce n'est pas le Conseil LLM.** Le conseil donne plusieurs perspectives sur une décision maintenant. Le premortem envoie Claude dans le futur où la décision a déjà échoué et remonte pour expliquer pourquoi. Mécanisme psychologique différent, résultat différent. Si l'utilisateur semble vouloir plusieurs perspectives plutôt qu'une analyse d'échecs, suggère le conseil à la place.
