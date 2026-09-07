---
name: me:lettre
description: >-
  Rédige une lettre de motivation de Kylian Bardini adaptée à une entreprise et une annonce
  précises, puis la rend en PDF A4 à la charte kbrdn.dev. Structure en quatre temps : preuve
  d'ouverture chiffrée, mapping exigence-par-exigence de l'annonce, traitement frontal de la
  mobilité Luxembourg et du « pourquoi vous », clôture avec disponibilité. Puise dans la même
  source de vérité que le CV (`_candidature-kit/pool.fr.md`) : jamais un fait inventé, et
  l'honnêteté sur ce qui manque est un argument, pas un aveu. À utiliser dès que l'utilisateur
  parle de « lettre de motivation », « cover letter », « lettre pour <entreprise> », « candidature
  à cette offre », colle une annonce en demandant une lettre, ou lance `/me:lettre`.
allowed-tools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebFetch"]
---

# me:lettre — lettre de motivation adaptée

## Le modèle de référence, et ce qu'on en garde

Kylian a fourni la lettre d'un ami (Mehdi Dias Gomes → Experis, alternance M2). Elle est bonne, et
elle est analysée ici parce que **sa structure transfère mais pas son positionnement**.

**Ce qui se reprend :**
- **Ouvrir sur une preuve, pas sur une politesse.** Mehdi ouvre par le projet chiffré, pas par
  « je me permets de vous adresser ma candidature ». C'est le point le plus important.
- **Nommer le destinataire.** Il a cherché qui recrute. Ça se voit et ça compte.
- **Mapper l'annonce exigence par exigence**, dans son vocabulaire à elle.
- **Traiter la faiblesse de front.** Sur Angular : « je ne prétendrai pas à une maîtrise », suivi de
  ce qu'il fait pour combler. Ça désamorce au lieu de laisser le recruteur le découvrir.
- **Un paragraphe « pourquoi vous spécifiquement »** — pas « pourquoi une entreprise comme la vôtre ».
- **Proposer de montrer le code.**
- **Zéro formule creuse.** Pas de « dynamique et motivé », pas de « challenge enrichissant ».

**Ce qui ne transfère PAS au profil de Kylian :**
- ❌ *« Votre annonce vise un profil confirmé, et je ne le suis pas encore. »* Désarmant chez un
  candidat en alternance. **Autodestructeur chez Kylian** : il est en CDI, avec ~3 ans d'expérience
  cumulée et un rôle de project lead — soit exactement la fourchette « confirmé » de la grille
  luxembourgeoise (3-5 ans). Il ouvre sur le périmètre qu'il possède, pas sur ce qui lui manque.
- ❌ Tout le bloc alternance : rythme école/entreprise, calendrier, « pour une formation en
  architecture logicielle ». Hors sujet.
- ❌ *« Je suis déjà en alternance au Luxembourg »* — l'argument le plus fort de Mehdi, et Kylian ne
  l'a pas. Ce paragraphe est à **remplacer**, pas à adapter : Kylian traite la mobilité de front
  (frontalier aujourd'hui, installation prévue secteur Thionville → ~30 min de Luxembourg-Ville).
- ❌ *« PHP est mon terrain principal. »* Vrai pour Mehdi, et suicidaire au Luxembourg où PHP ne
  recrute pas (0 offre sur Moovijob). Kylian ouvre sur TypeScript/cloud, PHP suit.
- ⚠️ **Les deux décrivent le même projet** (Fiches Pédagogiques, équipe de trois). Kylian était
  **project lead et architecte backend** — c'est distinctif et plus fort que « 1 600 commits ».
  Il doit le dire comme ça, jamais reprendre les chiffres de Mehdi.
- ⚠️ Longueur : ~450 mots chez Mehdi, c'est trop. Viser **300-350 mots**, quatre paragraphes.
- ⚠️ Le nombre de commits est une métrique faible pour un recruteur non technique. Préférer
  durée, taille d'équipe, périmètre, impact. Les commits en appui, jamais en tête.

## Structure imposée — quatre paragraphes

**1. La preuve.** Un fait concret et chiffré du pool, choisi pour répondre à l'exigence centrale de
l'annonce. Pas de préambule. Le recruteur doit savoir en une phrase pourquoi il continue à lire.

**2. Le mapping.** Reprendre les exigences de l'annonce dans son vocabulaire, et y répondre par du
vécu. Y compris — surtout — ce qui manque : le nommer, dire ce qui s'en rapproche, dire ce qui est
en cours. Ne jamais laisser le recruteur découvrir un trou tout seul.

**3. Mobilité et « pourquoi vous ».** Le Luxembourg filtre sur la géographie : frontalier depuis
Nancy aujourd'hui, **installation prévue secteur Thionville**, c'est-à-dire ~30 min de
Luxembourg-Ville. Ça se dit, ça ne se laisse pas deviner depuis l'adresse. Puis une raison propre à
cette entreprise — son secteur, son produit, sa façon de travailler. Une phrase qui ne fonctionnerait
pour aucune autre boîte.

**4. La clôture.** Disponibilité (dès que possible, préavis négociable — cf. pool), proposition d'entretien sur place
ou en visio, proposition de montrer le code. Formule de politesse au registre de l'annonce.
**Rien d'autre** : la clôture ne sert pas à glisser un dernier aveu. Tout ce qui manque a été traité
au §2, ou n'avait pas à être dit.

### Ce qu'on ne volontarise pas

Le non-diplôme (cursus Ingénierie Informatique sans titre) **ne se mentionne que si l'annonce exige
explicitement un diplôme de niveau Master**, et alors au §2 avec les autres écarts — jamais en §4.
Le CV gère déjà la question honnêtement en ne revendiquant aucun titre. Ouvrir le sujet sans qu'on
le demande, c'est offrir un motif de rejet que personne n'a réclamé. Attention aussi aux mentions
« niveau Master » qui viennent des **tags de taxonomie** d'un job board (Moovijob en génère
automatiquement) et non du texte de l'annonce : ce ne sont pas des exigences.

## Registre

| Langue de l'annonce | Registre |
|---|---|
| Français | Appareil formel complet : lieu + date, objet, « Madame, » / « Monsieur, », « Veuillez agréer… ». |
| Anglais | Business letter courte : « Dear Ms X, » … « Kind regards, ». Pas de lieu/date, pas d'objet solennel — un `Re:` suffit. Plus direct, moins protocolaire. |

Le destinataire se cherche : nom du recruteur ou du responsable technique sur l'annonce, LinkedIn,
page équipe du site. À défaut, « Madame, Monsieur, » — mais l'avoir cherché se sent dans le reste.

## Rendu

Même moteur que le CV, avec `doc: "lettre"` :

```bash
bun ~/.claude/skills/me/_candidature-kit/kit.ts /tmp/.../lettre.<slug>.json \
  --out ~/Library/Mobile\ Documents/com~apple~CloudDocs/Travail/CV/<slug>/Lettre_Kylian_Bardini.pdf
```

Schéma du JSON :

```json
{
  "doc": "lettre",
  "lang": "fr",
  "identity": { "name": "…", "title": "…", "location": "…", "email": "…", "phone": "…", "links": [] },
  "recipient": { "name": "Madame Untel", "role": "Talent Acquisition", "company": "…", "address": ["Luxembourg"] },
  "place": "Nancy", "date": "le 25 juillet 2026",
  "subject": "Objet : Candidature — Développeur Full Stack (réf. …)",
  "salutation": "Madame Untel,",
  "body": ["§1 la preuve", "§2 le mapping", "§3 mobilité + pourquoi vous", "§4 clôture"],
  "closing": "Veuillez agréer, Madame, l'expression de mes salutations distinguées."
}
```

`identity` se recopie depuis `profil.fr.json` — même source, pas de doublon à maintenir.
Le gate tourne aussi sur la lettre (max 2 pages, mais une page reste l'objectif).

## Règles

- **Jamais un fait absent de `pool.fr.md`.** Une lettre gonflée se démonte en entretien plus vite
  qu'un CV : le recruteur creuse exactement les phrases qu'on a écrites.
- **« Ingénieur » ne s'auto-attribue pas** — cursus sans diplôme. Cf. `pool.fr.md`.
- **Confidentialité** : l'employeur actuel n'est pas au courant. Rien de publié, rien de commité
  dans le repo public `kbrdn.dev`. Livrables dans iCloud `Travail/CV/<slug>/`.
- Une lettre par entreprise. Un paragraphe 3 recyclable tel quel d'une boîte à l'autre est un
  paragraphe raté.
- Relire à voix haute : si une phrase pourrait figurer dans la lettre de n'importe qui, elle dégage.
