# Baitly Académie · Épisode 13 « Le ménage de rotation en 5 étapes » · Brief voix off (FR)

> **À quoi sert ce fichier.** Textes, intonation et plans de la voix off de l'épisode 13 (2 min 35).
> **Comment l'utiliser.** Une seule prise (textes balisés dans `../academie-shared/scripts-academie.json`)
> dans `vo/fr/_prise-complete-*.mp3`, puis `python3 align-vo.py academie-13-menage-rotation fr` : les plans suivent la voix.
> Rendu : `node render.mjs academie-13-menage-rotation --format=9x16` puis `--format=16x9`.
> **À qui il s'adresse.** Toi (ElevenLabs), un comédien, un prestataire audio.

## 1. Règles communes

| Point | Consigne |
|---|---|
| **Voix** | **Lucie · Narration** (`LFtQZWdaqmvamcTNGpwl`), **Eleven v4**, Stabilité 0,3, Similarité 0,75, direction « prof enthousiaste ». Prise à vitesse normale. |
| **Prononciation** | « Bètli » (réécrit Baitly dans les sous-titres). Chiffres et heures en toutes lettres (« onze heures », « midi et demi »), réécrits 11 h, 12 h 30… dans les sous-titres. |
| **Coupures** | Détection automatique au silence, sans correction : aucune réplique au débit anormal. |
| **Vérité** | Exemple fictif, calculs exacts : créneau 11 h → 16 h = 5 h ; 30 min + 2 h + 30 min = 3 h, marge 2 h ; départ à 12 h 30 → 3 h 30 disponibles, marge 30 min ; 50 € (ménage refait) + 30 € (geste) = 80 €. Checklist à l'écran = modèle par pièce de l'application du prestataire (`CleaningChecklistScreen.tsx`). Phrase produit vérifiée : mission de ménage créée à chaque départ quand la règle d'automatisation est active (`CREATE_CLEANING_REQUEST`, filet `CleaningBackfillScheduler`), photos avant et après (`InterventionPhoto.PhotoPhase`), validation par l'hôte (`AWAITING_VALIDATION`), versement du prestataire bloqué sans photo de fin (`HousekeeperPayoutService.isProofComplete`). D'où « chaque départ **peut** créer la mission ». |
| **Visuels** | Photos cohérentes avec chaque étape : `../academie-shared/photos/SOURCES.md`. |

## 2. Chapitres (ils suivent la voix)

| Chapitre | Répliques | Ce qu'on voit |
|---|---|---|
| 0 · Accroche | b1 | Photo de ménage ; 11 h Départ, 16 h Arrivée, la barre se remplit : « 5 h pour tout remettre à neuf » |
| 1 · Le créneau | b2-b4 | Barre de 5 h découpée (trajet, ménage, linge et réassort, marge) ; 3 h de travail, 2 h de marge ; piège : départ à 12 h 30, marge 30 min ; vos règles |
| 2 · Les 5 étapes | b5-b8 | Du haut vers le bas, du fond vers la sortie ; les cinq étapes en photo ; piège : serviette, frigo ; checklist pièce par pièce qui se coche |
| 3 · Les photos | b9-b10 | Photos de fin datées par pièce ; message du voyageur sur le canapé, photo de fin qui le contredit ; verre cassé → photo avant ménage → dépôt de garantie |
| 4 · Mettons des chiffres | b11 | 50 €, +50 €, +30 € : 80 € perdus ; sans compter l'avis ; contrôle final 5 minutes |
| 5 · À retenir | b12 | Quatre règles ; Baitly : mission, checklist, photos, validation ; paiement après la photo de fin |
| Fin | b13 | Logo, baitly.fr |

## 3. Français

| # | Texte | Intonation |
|---|---|---|
| b1 | Onze heures : votre voyageur rend les clés. Seize heures : le suivant arrive. Entre les deux, cinq heures pour rendre le logement impeccable. C'est le ménage de rotation. Voyons comment le réussir… à tous les coups. | curious, engaging, a touch of urgency |
| b2 | Première notion : le créneau. C'est le temps entre l'heure de départ et l'heure d'arrivée. Départ à onze heures, arrivée à seize heures : un créneau de cinq heures. | clear, confident teacher, energetic |
| b3 | Faisons le compte, pour un deux-pièces. Le trajet : trente minutes. Le ménage : deux heures. Le linge et le réassort : trente minutes. Total : trois heures. Il reste deux heures de marge… et c'est elle qui absorbe les imprévus. | clear, confident teacher, energetic |
| b4 | Le piège : croire que la marge est acquise. Votre voyageur part à midi et demi au lieu de onze heures : il ne reste que trois heures et demie, et votre marge tombe à trente minutes. Alors fixez une heure de départ tenable, et n'accordez un départ tardif que si le planning le permet. | knowing, a little playful |
| b5 | Deuxième notion : les cinq étapes. Toujours dans le même ordre, du haut vers le bas, et du fond vers la sortie : on ne salit jamais ce qui est déjà propre. | clear, confident teacher, energetic |
| b6 | Un : aérer, retirer le linge sale, vider les poubelles. Deux : la cuisine et la salle de bain, les pièces que le voyageur inspecte en premier. Trois : les lits, avec du linge propre. | clear, confident teacher, energetic |
| b7 | Quatre : les sols, et le réassort : papier toilette, savon, café. Cinq : le contrôle final, checklist en main, et les photos. | clear, confident teacher, energetic |
| b8 | Le piège : faire le ménage de mémoire. Un jour, c'est une serviette qui manque ; le lendemain, un frigo pas vidé. Avec une checklist écrite, pièce par pièce, tout le monde fait le même ménage… même quelqu'un qui vient pour la première fois. | knowing, a little playful |
| b9 | Troisième notion : les photos. Une photo par pièce, à la fin du ménage : c'est la preuve de l'état du logement, juste avant l'arrivée du voyageur. | clear, confident teacher, energetic |
| b10 | Exemple : un voyageur affirme que le canapé était taché à son arrivée. La photo de fin, datée, montre un canapé propre. Et dans l'autre sens : si le ménage suivant trouve un verre cassé, ses photos d'avant ménage le prouvent, pour votre dépôt de garantie. | clear, confident teacher, energetic |
| b11 | Mettons des chiffres. Un ménage coûte cinquante euros. S'il est bâclé, il faut le refaire : cinquante euros de plus. Et vous offrez trente euros au voyageur pour vous excuser. Quatre-vingts euros perdus… sans compter l'avis. Le contrôle final, lui, prend cinq minutes. | clear, confident teacher, energetic |
| b12 | À retenir : un créneau avec de la marge, cinq étapes dans le même ordre, une checklist écrite, et des photos à chaque fois. Dans Bètli, chaque départ peut créer la mission de ménage : votre prestataire suit la checklist pièce par pièce, prend ses photos avant et après, et vous validez. Son paiement attend la photo de fin. | warm, upbeat |
| b13 | Bètli Académie : le métier, expliqué simplement. | bright, proud |
