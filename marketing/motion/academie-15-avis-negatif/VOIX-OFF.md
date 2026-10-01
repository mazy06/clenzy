# Baitly Académie · Épisode 15 « Répondre à un avis négatif » · Brief voix off (FR)

> **À quoi sert ce fichier.** Textes, intonation et plans de la voix off de l'épisode 15 (2 min 18).
> **Comment l'utiliser.** Une seule prise (textes balisés dans `../academie-shared/scripts-academie.json`)
> dans `vo/fr/_prise-complete-*.mp3`, puis `python3 align-vo.py academie-15-avis-negatif fr` : les plans suivent la voix.
> Rendu : `node render.mjs academie-15-avis-negatif --format=9x16` puis `--format=16x9`.
> **À qui il s'adresse.** Toi (ElevenLabs), un comédien, un prestataire audio.

## 1. Règles communes

| Point | Consigne |
|---|---|
| **Voix** | **Lucie · Narration** (`LFtQZWdaqmvamcTNGpwl`), **Eleven v4**, Stabilité 0,3, Similarité 0,75, direction « prof enthousiaste ». |
| **Prononciation** | « Bètli » (réécrit Baitly dans les sous-titres). Chiffres en toutes lettres (« quatre virgule soixante-sept »), réécrits 4,67 dans les sous-titres. |
| **Coupures** | Détection automatique au silence, sans correction. Les citations « … » restent entières dans les sous-titres (règle de `chunks`). |
| **Vérité** | Exemple fictif, calculs exacts : 20 avis à 4,8 = 96 ; + un avis à 2 → 98 ÷ 21 = 4,67 ; + 14 avis à 5 → 168 ÷ 35 = 4,80 (13 ne suffisent pas : 4,79). Réponse type : 4 phrases, 38 mots. Phrase produit vérifiée : une carte par avis sans réponse, les plus mal notés d'abord (`ReviewModerationScanner`), brouillon de l'agent Réputation jamais publié seul (`ReviewReplyDraftService`). La réponse validée est enregistrée dans Baitly (`ReviewService.respondToReview`) : la vidéo ne dit PAS qu'elle part sur la plateforme (le renvoi vers l'OTA via Channex est un point d'accès séparé). |

## 2. Chapitres (ils suivent la voix)

| Chapitre | Répliques | Ce qu'on voit |
|---|---|---|
| 0 · Accroche | b1 | L'avis à 2 étoiles ; « Votre réflexe : vous défendre · Mauvaise idée » ; lue par les futurs voyageurs |
| 1 · À qui vous répondez | b2-b3 | La fiche du logement avec l'avis et la réponse de l'hôte ; piège : la réponse à chaud ; attendre, répondre calmement |
| 2 · Les 4 étapes | b4-b7 | Merci, le point précis, l'action, la note positive (avec les phrases) ; piège : la réponse copiée ; le geste en privé |
| 3 · Ce que coûte un avis | b8-b9 | 4,80 → 4,67 ; 14 avis à 5 étoiles pour revenir ; la note ne change pas, le voyageur qui hésite oui |
| 4 · Mise en pratique | b10 | La réponse complète, chaque étape surlignée ; « Donne-t-elle envie de réserver ? » |
| 5 · À retenir | b11 | Trois règles ; Baitly : carte à traiter, brouillon de l'agent Réputation, rien publié sans validation |
| Fin | b12 | Logo, baitly.fr |

## 3. Français

| # | Texte | Intonation |
|---|---|---|
| b1 | Deux étoiles. « Salle de bain pas propre à notre arrivée. Déçus. » Votre premier réflexe : vous défendre. Mauvaise idée. Cette réponse, ce n'est pas au voyageur que vous l'écrivez… c'est à tous ceux qui la liront avant de réserver. Voyons comment répondre, en quatre étapes. | curious, engaging, a touch of urgency |
| b2 | Première notion : à qui vous répondez. Votre réponse reste publiée sous l'avis. Le futur voyageur la lit en choisissant son logement : il ne juge pas le problème, il juge votre façon de le traiter. | clear, confident teacher, energetic |
| b3 | Le piège : répondre à chaud. « C'est faux, le logement était impeccable. » Même si vous avez raison, le lecteur ne voit qu'une dispute. Laissez passer quelques heures, puis répondez calmement, en quelques lignes. | knowing, a little playful |
| b4 | Deuxième notion : les quatre étapes. Un : remerciez. « Merci d'avoir pris le temps de nous écrire. » | clear, confident teacher, energetic |
| b5 | Deux : reconnaissez le point précis, sans vous justifier. « Vous avez raison : la salle de bain n'était pas à la hauteur à votre arrivée. » | clear, confident teacher, energetic |
| b6 | Trois : dites ce qui a changé. Pas une excuse : une action. « Nous avons ajouté un contrôle photo après chaque ménage. » Quatre : terminez sur une note positive. « Nous espérons vous accueillir à nouveau. » | clear, confident teacher, energetic |
| b7 | Le piège : la réponse toute faite, copiée sous chaque avis. Elle montre que vous ne lisez pas. Et le geste commercial ? Il se règle en message privé, jamais dans la réponse publique. | knowing, a little playful |
| b8 | Troisième notion : ce que coûte un avis. Vingt avis, une moyenne de quatre virgule huit. Un avis à deux étoiles, et la moyenne tombe à quatre virgule soixante-sept. Pour revenir à quatre virgule huit ? Quatorze avis à cinq étoiles. | clear, confident teacher, energetic |
| b9 | Votre réponse ne changera pas la note. Mais elle change ce que pense le voyageur qui hésite. Et l'avis vous dit quoi corriger : c'est une information, pas une attaque. | clear, confident teacher, energetic |
| b10 | Mise en pratique. Voici la réponse complète : quatre phrases, une quarantaine de mots. Merci, le point précis, l'action, une note positive. Relisez-la avec les yeux d'un futur voyageur : donne-t-elle envie de réserver ? | clear, confident teacher, energetic |
| b11 | À retenir : vous répondez pour les futurs voyageurs, à froid, en quatre étapes, et le geste se règle en privé. Dans Bètli, chaque avis sans réponse remonte dans vos cartes à traiter, les plus mal notés en premier, avec un brouillon de réponse proposé par l'agent Réputation. Rien n'est publié sans vous : vous relisez, vous ajustez, vous validez. | warm, upbeat |
| b12 | Bètli Académie : le métier, expliqué simplement. | bright, proud |
