# Baitly Académie · Épisode 18 « Réservation directe ou plateforme ? » · Brief voix off (FR)

> **À quoi sert ce fichier.** Textes, intonation et plans de la voix off de l'épisode 18 (2 min 17).
> **Comment l'utiliser.** Une seule prise (textes balisés dans `../academie-shared/scripts-academie.json`)
> dans `vo/fr/_prise-complete-paulk.mp3`, puis `python3 align-vo.py academie-18-direct-ou-plateforme fr` : les plans suivent la
> voix. Rendu : `node render.mjs academie-18-direct-ou-plateforme --format=9x16` puis `--format=16x9`.
> **À qui il s'adresse.** Toi (ElevenLabs), un comédien, un prestataire audio.

## 1. Règles communes

| Point | Consigne |
|---|---|
| **Voix** | **Paul K · French Ad & Trailer** (`ecxPjiGTvAfpGEams6ec`), **Eleven v4**, Stabilité 0,35, direction « prof enthousiaste » ; « complice » sur les pièges. |
| **Prononciation** | « Bètli ». Chiffres écrits en toutes lettres. |
| **Vérité** | Exemple fictif, calculs exacts ; taux d'exemple (commission 15 %, carte 1,5 % + 0,25 €). Pas de part de marché ni de statistique inventée : la barre « Vos réservations » est une illustration sans chiffres. Règle des plateformes (pas de démarchage depuis leur messagerie) dite sans citer de clause. Phrase produit vérifiée : site de réservation directe sur le même calendrier (CalendarEngine) ; revenu net par canal via l'assistant (`ChannelAttributionService`). |
| **Coupures** | Coupures b9/b10 et b10/b11 imposées dans `FORCE_BOUNDS` (la détection prenait une pause de ponctuation pour une fin de réplique). |

## 2. Chapitres (ils suivent la voix)

| Chapitre | Répliques | Ce qu'on voit |
|---|---|---|
| 0 · Accroche | b1 | Même séjour, deux canaux : « Vous gardez ? » |
| 1 · Le calcul | b2-b4 | 561 € contre 649,85 € ; écart 88,85 € ; 1 777 € sur 20 séjours |
| 2 · Ce que chacun coûte | b5-b6 | Ce que la commission achète / ce que le direct demande |
| 3 · Le seuil | b7 | Le direct gagne sous 88,85 € par réservation ; publicité 30 € → +58,85 € |
| 4 · La stratégie | b8-b10 | Plateforme puis direct ; remise 5 % → +59,30 € ; règle des plateformes ; être facile à trouver |
| 5 · L'équilibre | b11 | Part du direct qui grandit (illustration) |
| 6 · À retenir | b12 | Comparer le net ; le seuil ; Baitly |
| Fin | b13 | Logo, baitly.fr |

## 3. Français

| # | Texte | Intonation |
|---|---|---|
| b1 | Même logement, même séjour, même voyageur. Réservé sur une plateforme ou chez vous, en direct… vous ne gardez pas la même somme. Mais le direct n'est pas gratuit non plus. Faisons le calcul. | beat |
| b2 | Un séjour de six cent soixante euros, ménage compris. Sur une plateforme, avec une commission de quinze pour cent, vous payez quatre-vingt-dix-neuf euros. Il vous reste cinq cent soixante et un euros. | clear, confident teacher, energetic |
| b3 | En direct, vous ne payez que les frais de carte bancaire. Par exemple, un virgule cinq pour cent, plus vingt-cinq centimes : dix euros quinze. Il vous reste six cent quarante-neuf euros quatre-vingt-cinq. | clear, confident teacher, energetic |
| b4 | L'écart : quatre-vingt-huit euros quatre-vingt-cinq par séjour. Sur vingt séjours dans l'année… près de mille huit cents euros. | beat |
| b5 | Alors pourquoi payer une plateforme ? Parce que la commission achète quelque chose : des voyageurs qui ne vous connaissent pas encore, le paiement sécurisé, les avis, et un service client en cas de problème. | clear, confident teacher, energetic |
| b6 | Le direct, lui, a ses propres coûts : un site, de belles photos, parfois de la publicité, et du temps pour répondre, encaisser et gérer les imprévus. | clear, confident teacher, energetic |
| b7 | La bonne question devient : combien vous coûte une réservation directe ? Tant que ce coût reste sous quatre-vingt-huit euros quatre-vingt-cinq, le direct gagne. Trente euros de publicité pour une réservation ? Vous gardez encore cinquante-huit euros quatre-vingt-cinq de plus. | clear, confident teacher, energetic |
| b8 | La stratégie gagnante : la plateforme pour vous faire connaître, le direct pour faire revenir. Un voyageur conquis une première fois peut revenir chez vous, sans commission. | clear, confident teacher, energetic |
| b9 | Même avec cinq pour cent de remise sur les nuits pour le remercier, vous gardez cinquante-neuf euros trente de plus qu'en passant par la plateforme. | clear, confident teacher, energetic |
| b10 | Une règle, cependant : ne l'invitez jamais à réserver ailleurs depuis la messagerie d'une plateforme. Leurs conditions l'interdisent. Soyez simplement facile à trouver : un site à votre nom, une fiche Google, le bouche-à-oreille. | knowing, a little playful |
| b11 | Visez l'équilibre, pas le tout-direct : gardez les plateformes pour remplir, et faites grandir la part du direct, séjour après séjour. | warm, knowing |
| b12 | À retenir : comparez toujours le net, pas le prix. Le direct gagne tant qu'une réservation vous coûte moins que la commission. Dans Bètli, votre site de réservation directe partage le même calendrier que vos plateformes, et votre assistant vous dit quel canal rapporte vraiment, net de commission. | warm, upbeat |
| b13 | Bètli Académie : le métier, expliqué simplement. | bright, proud |
