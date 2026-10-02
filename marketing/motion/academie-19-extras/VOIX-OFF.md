# Baitly Académie · Épisode 19 « Les extras qui rapportent » · Brief voix off (FR)

> **À quoi sert ce fichier.** Textes, intonation et plans de la voix off de l'épisode 19 (2 min 25).
> **Comment l'utiliser.** Une seule prise (textes balisés dans `../academie-shared/scripts-academie.json`)
> dans `vo/fr/_prise-complete-*.mp3`, puis `python3 align-vo.py academie-19-extras fr` : les plans suivent la voix.
> Rendu : `node render.mjs academie-19-extras --format=9x16` puis `--format=16x9`.
> **À qui il s'adresse.** Toi (ElevenLabs), un comédien, un prestataire audio.

## 1. Règles communes

| Point | Consigne |
|---|---|
| **Voix** | **Noé · Content Creator** (`7pDdnNI6PhXmAp0pXFZm`, français standard), **Eleven v4**, Stabilité 0,4, Similarité 0,8, direction « prof enthousiaste ». Prise ralentie de 6 % (`atempo=0.94`, hauteur inchangée) ; prise brute dans `vo/_noe-brut/`. |
| **Prononciation** | « Bètli », « Get Your Guide », « Klouk », « Straïpe » (réécrits GetYourGuide, Klook, Stripe dans les sous-titres). Chiffres en toutes lettres. |
| **Coupures** | Frontières imposées dans `FORCE_BOUNDS` : Noé enchaîne sans pause, la détection coupait b9 au milieu de la première phrase de b10. |
| **Vérité** | Exemple fictif, calculs exacts : 35 € × 4 ventes (1 voyageur sur 5, 20 séjours) = 140 € ; 65 € × 2 = 130 €, 8 % = 10,40 € (le taux dépend de chaque programme, dit à la voix et à l'écran) ; 30 € + 25 € = 55 €, pack à 50 €. Prix des services = suggestions de base de Baitly (`upsellTemplate.ts`). Partenaires cités = programmes réellement connectés (`ActivityProvider` : GETYOURGUIDE, VIATOR, KLOOK ; clients `GetYourGuideActivityClient`, `ViatorActivityClient`, liens affiliés Klook) ; les associations activité ↔ plateforme du livret sont illustratives. Phrase produit vérifiée : extras diffusés sur le livret et le site de réservation (`diffuse_on_livret` / `diffuse_on_booking`), paiement Stripe (`UpsellService`), types d'extras personnalisés (`UpsellTypesManager`), packs à prix combiné (`bundle_offer_ids`), conditions (`minNights`, `leadTimeHours`). |
| **Visuels** | Photos cohérentes avec chaque extra et logos officiels : `../academie-shared/photos/SOURCES.md`. |

## 2. Chapitres (ils suivent la voix)

| Chapitre | Répliques | Ce qu'on voit |
|---|---|---|
| 0 · Accroche | b1 | Quatre extras en photo : arrivée plus tôt, départ plus tard, transfert, activité |
| 1 · Vos services | b2-b4 | Cinq services avec photo et prix ; départ tardif 35 € → +140 € par mois ; piège : départ 14 h / arrivée 15 h ; vos conditions |
| 2 · Les activités | b5-b7 | Logos GetYourGuide, Viator, Klook ; livret d'accueil avec trois activités et leur logo ; atelier de cuisine : 130 €, 8 %, 10,40 € |
| 3 · Sur mesure | b8-b9 | Surf, massage, vélos électriques, dîner du chef ; formulaire « Nouvel extra » ; pack 55 € → 50 € |
| 4 · Le bon moment | b10 | À la réservation / quelques jours avant / pendant le séjour ; une photo, un prix clair, un bouton |
| 5 · À retenir | b11 | Trois types d'extras ; Baitly ; paiement en ligne avec le logo Stripe |
| Fin | b12 | Logo, baitly.fr |

## 3. Français

| # | Texte | Intonation |
|---|---|---|
| b1 | Votre voyageur a réservé, le séjour est payé… mais il n'a pas fini de dépenser. Une arrivée plus tôt, un départ plus tard, un transfert, une activité : ce sont les extras. Voyons lesquels rapportent, et comment les vendre. | curious, engaging, a touch of urgency |
| b2 | Premier type : les extras de votre logement. Ce sont vos propres services : une arrivée anticipée, un départ tardif, un ménage en cours de séjour, un panier petit-déjeuner, un transfert depuis l'aéroport. | clear, confident teacher, energetic |
| b3 | Faisons le calcul. Un départ tardif à trente-cinq euros, choisi par un voyageur sur cinq. Sur vingt séjours par mois : quatre ventes, cent quarante euros. Pour quelques heures de plus… sans une seule nuit de plus. | clear, confident teacher, energetic |
| b4 | Le piège : vendre ce que vous ne pouvez pas tenir. Un départ tardif le jour d'une nouvelle arrivée, c'est le ménage qui n'a plus le temps. Alors fixez vos conditions : selon disponibilité, un délai pour commander, un nombre de nuits minimum. | knowing, a little playful |
| b5 | Deuxième type : les activités. Vous n'avez pas à les organiser : des plateformes comme Get Your Guide, Viator ou Klouk proposent des milliers d'expériences, partout dans le monde. | clear, confident teacher, energetic |
| b6 | Avec Bètli, vous connectez votre compte partenaire : les activités autour de votre logement s'affichent dans votre livret d'accueil. Une montgolfière au lever du soleil, un atelier de cuisine, une soirée dans le désert… le voyageur réserve, et vous touchez une commission. | clear, confident teacher, energetic |
| b7 | Exemple : un atelier de cuisine à soixante-cinq euros, pour deux personnes : cent trente euros. Avec une commission de huit pour cent, dix euros quarante pour vous, sans rien organiser. Le voyageur paie la plateforme, et chaque programme fixe son taux. | clear, confident teacher, energetic |
| b8 | Troisième type : vos extras sur mesure. Vous n'êtes pas limité à une liste toute faite. Un cours de surf avec un moniteur du coin, un massage à domicile, des vélos électriques, un dîner préparé par un chef : créez votre extra, avec son titre, sa photo et son prix. | clear, confident teacher, energetic |
| b9 | Et composez des packs. Arrivée anticipée et panier petit-déjeuner : trente plus vingt-cinq, cinquante-cinq euros… proposés ensemble à cinquante euros. Le voyageur économise, et vous vendez deux extras au lieu d'un. | clear, confident teacher, energetic |
| b10 | Le moment compte autant que le prix. À la réservation : le transfert et l'arrivée anticipée. Quelques jours avant l'arrivée : le petit-déjeuner et les activités. Pendant le séjour : le ménage et le départ tardif. Et à chaque fois : une photo, un prix clair, un bouton. | clear, confident teacher, energetic |
| b11 | À retenir : vos services, les activités de vos partenaires, et vos extras sur mesure, proposés au bon moment. Dans Bètli, vos extras s'affichent dans le livret d'accueil et sur votre site de réservation, le voyageur paie en ligne avec Straïpe, et chaque vente s'ajoute à vos revenus. | warm, upbeat |
| b12 | Bètli Académie : le métier, expliqué simplement. | bright, proud |
