# Baitly Académie · Épisode 11 « La checklist sécurité du logement » · Brief voix off (FR)

> **À quoi sert ce fichier.** Textes, intonation et plans de la voix off de l'épisode 11 (2 min).
> **Comment l'utiliser.** Une seule prise (textes balisés dans `../academie-shared/scripts-academie.json`)
> dans `vo/fr/_prise-complete-*.mp3`, puis `python3 align-vo.py academie-11-securite fr` : les plans suivent la voix.
> Rendu : `node render.mjs academie-11-securite --format=9x16` puis `--format=16x9`.
> **À qui il s'adresse.** Toi (ElevenLabs), un comédien, un prestataire audio.

## 1. Règles communes

| Point | Consigne |
|---|---|
| **Voix** | **Noé · Content Creator** (`7pDdnNI6PhXmAp0pXFZm`, français standard), **Eleven v4**, Stabilité 0,4, Similarité 0,8, direction « prof enthousiaste ». Prise ralentie de 6 % (`atempo=0.94`) ; prise brute dans `vo/_noe-brut/`. |
| **Prononciation** | « Bètli », « C E », « N F E N quatorze six cent quatre » (réécrits Baitly, CE, NF EN 14604 dans les sous-titres). |
| **Vérification** | Obligations FRANÇAISES vérifiées sur service-public.gouv.fr le 01/10/2026 : détecteur de fumée (fiche F19950, page vérifiée le 13/05/2026 ; CCH L142-1 à L142-4, R142-1 à R142-5 ; marquage CE + NF EN 14604 ; en location saisonnière, le propriétaire installe, entretient, renouvelle) et piscine (fiche F1722, page vérifiée le 13/02/2026 ; piscines privées enterrées non couvertes ; barrière NF P90-306, alarme NF P90-307, couverture NF P90-308, abri NF P90-309 ; en place avant l'arrivée du locataire ; amende de 45 000 € ; CCH L134-10, D134-51 à D134-54, L183-13). Maroc et Arabie saoudite NON vérifiés : renvoi explicite aux autorités locales. Le reste est présenté comme recommandé, jamais comme obligatoire. À revoir tous les six mois (PROGRAMME.md § 4). |
| **Mention** | À l'écran : sources, « à jour au 01/10/2026 · information générale, pas un conseil juridique ». |
| **Vérité produit** | Numéro utile et consignes dans le livret (`PracticalInfo.emergencyContact`), consignes de ménage par logement (`Property.cleaningNotes`). |

## 2. Chapitres (ils suivent la voix)

| Chapitre | Répliques | Ce qu'on voit |
|---|---|---|
| 0 · Accroche | b1 | Le détecteur ; quelques dizaines d'euros contre un incendie ; obligatoire, recommandé, à vérifier |
| 1 · L'obligatoire | b2-b4 | Détecteur de fumée (source) ; piscine, 4 dispositifs normés, 45 000 € (source) ; piège : France vérifiée, Maroc, Arabie saoudite et ville à vérifier |
| 2 · Le recommandé | b5 | Monoxyde de carbone, extincteur, couverture anti-feu, trousse, lampe torche |
| 3 · Les consignes | b6 | Livret d'accueil : extincteur, coupures eau / gaz / électricité, 112, votre numéro |
| 4 · Mise en pratique | b7-b8 | 3 vérifications à chaque ménage ; registre de sécurité |
| 5 · À retenir | b9 | Quatre règles ; Baitly ; sources |
| Fin | b10 | Logo, baitly.fr |

## 3. Français

| # | Texte | Intonation |
|---|---|---|
| b1 | Un détecteur de fumée coûte quelques dizaines d'euros. Un incendie dans un logement loué, lui, n'a pas de prix. La sécurité, c'est la partie du métier qu'on espère ne jamais utiliser. Voyons la checklist complète : l'obligatoire, le recommandé, et ce qu'il faut vérifier à chaque séjour. | curious, engaging, a touch of urgency |
| b2 | Première notion : l'obligatoire. En France, chaque logement doit avoir au moins un détecteur de fumée, marqué C E et conforme à la norme N F E N quatorze six cent quatre. En location saisonnière, c'est au propriétaire de l'installer, de l'entretenir et de le remplacer. | clear, confident teacher, energetic |
| b3 | Vous avez une piscine ? Si elle est enterrée et non couverte, elle doit avoir un dispositif de sécurité : une barrière, une alarme, une couverture ou un abri, installé avant l'arrivée du voyageur. Sans lui, l'amende peut atteindre quarante-cinq mille euros. | clear, confident teacher, energetic |
| b4 | Le piège : croire que les règles sont les mêmes partout. Au Maroc, en Arabie saoudite, ailleurs, chaque pays fixe les siennes, parfois chaque ville. Vérifiez-les auprès des autorités locales avant d'accueillir. | knowing, a little playful |
| b5 | Deuxième notion : le recommandé. Un détecteur de monoxyde de carbone, dès qu'il y a une chaudière, un poêle ou une cheminée. Un extincteur et une couverture anti-feu dans la cuisine. Une trousse de premiers secours, et une lampe torche. | clear, confident teacher, energetic |
| b6 | Troisième notion : les consignes. Le voyageur doit savoir, sans chercher : où est l'extincteur, comment couper l'eau, le gaz et l'électricité, et quel numéro appeler. En Europe, le cent douze. Et votre numéro, pour tout le reste. | clear, confident teacher, energetic |
| b7 | Mise en pratique : à chaque ménage, trois vérifications de plus. Appuyer sur le bouton test du détecteur. Voir l'extincteur et la couverture à leur place. Compléter la trousse si elle a servi. Trente secondes… à chaque séjour. | clear, confident teacher, energetic |
| b8 | Et notez tout : la date d'achat de chaque équipement, le contrôle de l'extincteur, le remplacement des piles. Le jour d'un problème, c'est votre preuve que tout était en ordre. | clear, confident teacher, energetic |
| b9 | À retenir : l'obligatoire d'abord, le détecteur de fumée et la sécurité de la piscine ; le recommandé ensuite ; des consignes claires pour le voyageur ; et trois vérifications à chaque ménage. Dans Bètli, votre livret d'accueil affiche votre numéro utile et vos consignes, et chaque logement garde ses consignes de ménage : notez-y vos vérifications de sécurité. | warm, upbeat |
| b10 | Bètli Académie : le métier, expliqué simplement. | bright, proud |
