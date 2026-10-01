# Baitly Académie · Épisode 12 « Votre assurance couvre-t-elle la location courte durée ? » · Brief voix off (FR)

> **À quoi sert ce fichier.** Textes, intonation et plans de la voix off de l'épisode 12 (2 min).
> **Comment l'utiliser.** Une seule prise (textes balisés dans `../academie-shared/scripts-academie.json`)
> dans `vo/fr/_prise-complete-*.mp3`, puis `python3 align-vo.py academie-12-assurance fr` : les plans suivent la voix.
> Rendu : `node render.mjs academie-12-assurance --format=9x16` puis `--format=16x9`.
> **À qui il s'adresse.** Toi (ElevenLabs), un comédien, un prestataire audio.

## 1. Règles communes

| Point | Consigne |
|---|---|
| **Voix** | **Noé · Content Creator** (`7pDdnNI6PhXmAp0pXFZm`, français standard), **Eleven v4**, Stabilité 0,4, Similarité 0,8, direction « prof enthousiaste ». Prise ralentie de 6 % (`atempo=0.94`) ; prise brute dans `vo/_noe-brut/`. |
| **Prononciation** | « Bètli » (réécrit Baitly dans les sous-titres). Montants en toutes lettres, réécrits en chiffres dans les sous-titres. |
| **Cadre** | Information générale, pas un conseil : l'épisode ne pose que des QUESTIONS à l'assureur et n'affirme aucune règle de droit ni clause type (« souvent pensée pour y vivre » reste une généralité prudente). Mention à l'écran : « Information générale : vos garanties dépendent de votre contrat ». Les garanties de plateforme sont décrites sans nommer de plateforme : conditions et plafonds propres, valables pour leurs seules réservations. |
| **Vérité** | Exemple fictif, calculs exacts : 3 réservations annulées = 900 € ; réparations 3 000 € couvertes, franchise 300 € ; perte de revenus couverte → 300 € à payer ; sans → 300 € + 900 € = 1 200 €. Phrase produit vérifiée : photos avant et après de chaque ménage (`InterventionPhoto` BEFORE/AFTER), photos des incidents signalés (`IssuePhotoService`). |
| **Visuels** | Photo du plombier (dégât des eaux) : `../academie-shared/photos/SOURCES.md`. |

## 2. Chapitres (ils suivent la voix)

| Chapitre | Répliques | Ce qu'on voit |
|---|---|---|
| 0 · Accroche | b1 | Le plombier ; dégât des eaux, voyageur qui doit partir, 3 réservations annulées ; « Votre assurance… » |
| 1 · Votre contrat | b2 | Assurance habitation ≠ location courte durée ; ne rien supposer, demander, garder la réponse écrite |
| 2 · Les 6 questions | b3-b6 | Les six questions ; piège : la garantie d'une plateforme, et les réservations directes |
| 3 · Les chiffres | b7 | 3 000 € et 900 € ; 300 € avec la perte de revenus couverte, 1 200 € sans |
| 4 · Les preuves | b8-b9 | État avant le séjour, photos des dégâts, échanges ; mise en pratique : les questions par écrit, logement par logement |
| 5 · À retenir | b10 | Quatre règles ; Baitly : photos des ménages et des incidents ; mention « information générale » |
| Fin | b11 | Logo, baitly.fr |

## 3. Français

| # | Texte | Intonation |
|---|---|---|
| b1 | Dégât des eaux, un dimanche soir, en plein séjour. Votre voyageur doit partir, et vos trois réservations suivantes sont annulées. Qui paie ? Votre assurance… si elle couvre vraiment la location courte durée. Voyons les questions à lui poser, avant le sinistre. | curious, engaging, a touch of urgency |
| b2 | Première notion : votre contrat n'est pas forcément le bon. Une assurance habitation est souvent pensée pour y vivre, pas pour accueillir des voyageurs. Alors ne supposez rien : posez la question à votre assureur, et gardez sa réponse par écrit. | clear, confident teacher, energetic |
| b3 | Première question : mon contrat couvre-t-il la location de courte durée, pour ce logement précis ? Si vous louez plusieurs logements, vérifiez-le pour chacun. | clear, confident teacher, energetic |
| b4 | Ensuite, les dommages. Deux : les dégâts causés par un voyageur sont-ils couverts ? Trois : et le vol ? Quatre : votre responsabilité, si un voyageur se blesse chez vous ? | clear, confident teacher, energetic |
| b5 | Cinq : la perte de revenus. Si le logement devient inhabitable après un sinistre, les nuits annulées sont-elles remboursées ? Six : quelles franchises, quels plafonds, et quelles exclusions ? | clear, confident teacher, energetic |
| b6 | Le piège : compter sur la plateforme. Certaines proposent une garantie pour les dommages, mais avec leurs propres conditions et plafonds… et elle ne vaut que pour les réservations faites chez elles. Vos réservations directes, elles, n'en ont pas. | knowing, a little playful |
| b7 | Deuxième notion : les chiffres. Trois mille euros de réparations, et trois réservations annulées : neuf cents euros. Avec une franchise de trois cents euros et la perte de revenus couverte, il vous reste trois cents euros à payer. Sans cette garantie : trois cents plus neuf cents, mille deux cents euros. | clear, confident teacher, energetic |
| b8 | Troisième notion : les preuves. Le jour du sinistre, votre assureur vous demandera l'état du logement avant le séjour, les photos des dégâts, et vos échanges avec le voyageur. Sans photos, c'est votre parole contre la sienne. | clear, confident teacher, energetic |
| b9 | Mise en pratique : envoyez ces six questions par écrit à votre assureur, logement par logement, et classez ses réponses avec votre contrat. Une heure de travail… pour ne pas découvrir vos exclusions le jour du sinistre. | clear, confident teacher, energetic |
| b10 | À retenir : ne supposez rien, posez les six questions par écrit, faites couvrir la perte de revenus, et gardez vos preuves. Dans Bètli, chaque ménage conserve ses photos avant et après, et chaque incident signalé, ses photos : les pièces que votre assureur vous demandera. | warm, upbeat |
| b11 | Bètli Académie : le métier, expliqué simplement. | bright, proud |
