# Script 04 · « Vous approuvez. Ils exécutent. » (agents IA)

> **À quoi sert ce fichier.** Script de production complet d'une vidéo motion design Baitly, feature
> spotlight sur les agents IA et la validation humaine.
> **Comment l'utiliser.** Suivre les beats ; couleurs, polices et courbes sont définies dans le
> [brand book](../brand-book/brand-book.md). Voix off à enregistrer mot pour mot.
> **À qui il s'adresse.** Motion designer, monteur, comédien voix off, responsable marketing.

> **Version produite (v2, 27 septembre 2026)** : `marketing/motion/reel-04-agents-ia/`, FR · EN · AR,
> 46 s, mode Jour. Constellation → liste d'agents + fiche (Surveille / Propose, textes de la landing)
> qui suit les métiers cités → carte HITL Revenue (ajuster puis approuver) → automatisations et bornes
> → journal. Brief voix : `reel-04-agents-ia/VOIX-OFF.md`.

## Métadonnées

| | |
|---|---|
| **Titre** | Vous approuvez. Ils exécutent. |
| **Durée cible** | 45 s |
| **Formats** | 9:16 master · 16:9 (1920×1080) YouTube / LinkedIn |
| **Réseaux** | LinkedIn, YouTube, Instagram |
| **Objectif** | Consideration : expliquer les agents IA et lever la peur de perdre le contrôle |
| **Cible** | Conciergeries, hôtes multi-logements |

## Les 10 agents (référence visuelle)

Couleurs de domaine issues du PMS (`client/src/modules/supervision/constants.ts`). À utiliser
**uniquement** en pastille (8–12 px) ou en fin liseré d'icône, jamais en aplat de fond.

| Agent | Couleur | Surveille | Propose |
|---|---|---|---|
| Communication | `#3B6FE0` | Messages entrants, tous canaux, toutes langues | Réponses prêtes, traduites, appuyées sur le livret |
| Revenue | `#7C5CE0` | Occupation, pace, saisonnalité, prix du marché | Ajustements bornés, plancher garanti |
| Opérations | `#1F9E8D` | Arrivées, départs, missions | Ménage replanifié, missions assignées |
| Finance | `#C77D2E` | Encaissements, factures | Rapprochements, factures émises |
| Avis & Réputation | `#D6457E` | Avis publiés | Réponses rédigées |
| Synchronisation | `#3AA0C9` | Canaux connectés | Dates fermées partout, alertes de conflit |
| Conformité | `#5E7A99` | Déclarations, taxes | Fiches voyageurs transmises |
| Voyageur | `#E0685C` | Séjour en cours | Services et extras au bon moment |
| Propriétaire | `#A2845E` | Mandats, relevés | Relevés prêts, net à verser |
| Croissance | `#5BAE4E` | Site direct, conversions | Actions pour vendre en direct |

## Beats

| Timecode | Voix off (texte exact) | Directions d'animation / visuel | À l'écran |
|---|---|---|---|
| **0–4 s** | « Et si dix collègues veillaient sur vos logements, jour et nuit ? » | Fond Bleu nuit `#1B2A35`. Dix pastilles de couleur (les agents) apparaissent une à une en cercle autour du tracé de la maison du logo (stroke `#9CB4E2` sur fond sombre), 70 ms d'écart, léger « pop » d'opacité (pas de scale > 1,05). | « 10 agents » en Space Grotesk 700, Texte sombre `#D7E1EE`. |
| **4–10 s** | « Chez Baitly, chaque agent a un métier : les prix, les messages, le ménage, les paiements, la conformité… » | Le cercle se déplie en une liste verticale (constellation → équipe). Chaque ligne : pastille + nom d'agent (Manrope 600). La liste défile doucement vers le haut. | Noms des agents. |
| **10–18 s** | « Ils surveillent en continu. Quand une action est utile, ils vous la proposent, avec le contexte et la simulation. » | On reste en mode Nuit (fond `#111B31`), la carte est posée en Ardoise nuit `#2E4356`. Gros plan sur une **carte de validation** (HITL) de l'agent **Revenue** : titre « Trois nuits creuses à Marrakech », détail « Baisse proposée de 760 à 690 MAD · plancher 680 MAD », mini-graphique avant / après, trois boutons : **Approuver** (plein, Sable `#E0C89B`, texte `#2B211A`), **Ajuster** (contour), **Refuser** (texte). Les lignes de contexte s'écrivent une à une. | Libellés « Surveille » → « Propose » en eyebrow. |
| **18–24 s** | « Vous approuvez, vous ajustez, ou vous refusez. » | Un curseur survole « Ajuster » : un curseur de prix s'ouvre, le prix passe à 700 MAD (compteur tabular-nums), puis « Approuver » est pressé. Retour visuel : la carte se replie en une ligne avec coche Sable `#E0C89B`. | « Vous gardez la main. » |
| **24–31 s** | « Et pour les tâches que vous leur confiez, ils agissent seuls, dans les limites que vous avez fixées. » | Vue « Automatisation » : trois interrupteurs (Messages d'accueil, Replanification ménage, Réponses aux avis) passent sur « Auto ». Une jauge montre les bornes du yield : zone de baisse sous 55 % d'occupation, zone de hausse au-delà de 85 %, ligne plancher. | « Dans vos limites. » |
| **31–38 s** | « Chaque décision est expliquée et journalisée. Vous savez toujours qui a fait quoi, et pourquoi. » | Le journal d'activité s'écrit en temps réel : 4 lignes horodatées avec pastille d'agent, action, statut (« approuvé par vous », « automatique »). Surlignage doux (fond Sable `#E0C89B` à 20 %) de la ligne la plus récente. | « 100 % des décisions expliquées et journalisées » |
| **38–45 s** | « Une équipe qui travaille pour vos logements. Sous votre contrôle. Baitly. Rejoignez le pré-lancement sur baitly.fr. » | Retour aux 10 pastilles qui se regroupent et rejoignent le tracé du logo ; les deux packets bleu et teal démarrent leur cycle. CTA dessous. | Logo · « Rejoignez le pré-lancement » · **baitly.fr** |

**Voix off : 105 mots.**

## Notes de production

- **Palette** : bleu nuit + Terre cuite uniquement (brand book, « Palette de création »). Les couleurs d'interface (bleu-gris, teal, couleurs d'agents, de canaux) n'apparaissent qu'à l'intérieur des maquettes UI. Le planning est montré avec ses briques Terre cuite.
- **Voix** : experte et posée, comme un chef d'équipe qui présente ses collaborateurs. Aucun ton « futuriste » ou robotique. Ne jamais parler d'« intelligence artificielle qui remplace » : l'IA **propose**, l'humain **décide**.
- **Rythme** : medium, avec un temps suspendu (silence 0,5 s) juste avant « Vous approuvez, vous ajustez, ou vous refusez. »
- **Musique** : électronique organique, synthés doux et percussions boisées, 95 BPM. Pas de sons « sci-fi », pas de bips robotiques.
- **Faits utilisés** (vérifiables) : 10 agents (`AGENT_IDS`), bornes 55 % / 85 %, plancher dur, décisions journalisées. Les montants (760 / 690 / 680 MAD) sont un **exemple** repris de la landing.
- **À éviter** : cerveaux lumineux, circuits, robots, dégradés violets, glow néon (bannis par l'identité).
- **CTA final exact** : « Rejoignez le pré-lancement » · **baitly.fr** (après ouverture : « Voir les agents en action » · **baitly.fr/demo**).
