# Baitly Académie · Épisode 20 « Gérer pour le compte d’un propriétaire » · Brief voix off (FR)

> **À quoi sert ce fichier.** Textes, intonation et plans de la voix off de l'épisode 20 (2 min 25).
> **Comment l'utiliser.** Une seule prise (textes balisés dans `../academie-shared/scripts-academie.json`)
> dans `vo/fr/_prise-complete-*.mp3`, puis `python3 align-vo.py academie-20-gestion-proprietaire fr` : les plans suivent la voix.
> Rendu : `node render.mjs academie-20-gestion-proprietaire --format=9x16` puis `--format=16x9`.
> **À qui il s'adresse.** Toi (ElevenLabs), un comédien, un prestataire audio.

## 1. Règles communes

| Point | Consigne |
|---|---|
| **Voix** | **Lucie · Narration** (`LFtQZWdaqmvamcTNGpwl`), **Eleven v4**, Stabilité 0,3, Similarité 0,75, direction « prof enthousiaste ». |
| **Prononciation** | « Bètli » (réécrit Baitly dans les sous-titres). Montants en toutes lettres, réécrits en chiffres dans les sous-titres. |
| **Cadre** | Information générale : les obligations professionnelles (carte, assurance…) sont seulement signalées « selon le pays », sans règle affirmée. Mention à l'écran : « Information générale, pas un conseil juridique ». |
| **Vérité** | Exemple fictif, calculs exacts : 2 000 € dont 300 € de frais ; 20 % du brut = 400 € ; 20 % du net (1 700 €) = 340 € ; écart 60 € ; reversement 2 000 − 300 − 340 − 160 = 1 200 € ; relevé 600 + 800 + 600 = 2 000 € (3, 4 et 3 nuits à 200 €). Phrase produit vérifiée : mandat signé en ligne (lien envoyé au propriétaire, `ContractSignatureService`) ; base de commission brut/net et payeur des frais OTA par contrat (`ManagementContract.CommissionBase`, `OtaFeeBearer`) ; virement seulement une fois approuvé (`PayoutExecutionService`) ; relevé mensuel automatique le 1er du mois (`OwnerStatementScheduler`, règle SEND_OWNER_STATEMENT), au même calcul que le virement (`OwnerPortalService`). |

## 2. Chapitres (ils suivent la voix)

| Chapitre | Répliques | Ce qu'on voit |
|---|---|---|
| 0 · Accroche | b1 | Le logement, la question du propriétaire, les trois pièces |
| 1 · Le mandat | b2-b4 | Les clauses du mandat ; brut 400 € / net 340 €, écart 60 € ; piège : « 20 % des revenus » |
| 2 · Le reversement | b5-b7 | 2 000 − 300 − 340 − 160 = 1 200 € ; piège : mélanger l'argent ; reversement à date fixe |
| 3 · Le relevé | b8-b9 | Relevé de septembre séjour par séjour ; mêmes chiffres que le virement |
| 4 · Mise en pratique | b10 | Les 5 points avant de signer ; règles du pays à vérifier |
| 5 · À retenir | b11 | Trois règles ; Baitly : mandat en ligne, base de commission, validation, relevé automatique |
| Fin | b12 | Logo, baitly.fr |

## 3. Français

| # | Texte | Intonation |
|---|---|---|
| b1 | Un propriétaire vous confie son appartement. En fin de mois, il ne vous demandera qu'une chose : combien je touche… et pourquoi ? Gérer pour le compte d'un autre, c'est d'abord une affaire de clarté. Voyons les trois pièces qui la garantissent : le mandat, le reversement, et le relevé. | curious, engaging, a touch of urgency |
| b2 | Première pièce : le mandat. C'est le contrat qui vous autorise à gérer le logement. Il dit ce que vous faites, combien vous prenez, sur quelle base, et comment on se sépare. | clear, confident teacher, energetic |
| b3 | La base change tout. Un mois à deux mille euros de réservations, dont trois cents euros de frais de plateforme. Vingt pour cent sur le brut : quatre cents euros. Vingt pour cent sur le net de ces frais : trois cent quarante euros. Soixante euros d'écart… chaque mois. | clear, confident teacher, energetic |
| b4 | Le piège : le mandat flou. « Vingt pour cent des revenus » : du brut, ou du net ? Et les frais de plateforme, qui les paie ? Écrivez-le noir sur blanc, avant le premier séjour. | knowing, a little playful |
| b5 | Deuxième pièce : le reversement. C'est ce qui revient au propriétaire, une fois tout déduit : les revenus, moins les frais de plateforme, moins votre commission, moins les dépenses du mois. | clear, confident teacher, energetic |
| b6 | Reprenons : deux mille euros de revenus, moins trois cents de frais, moins trois cent quarante de commission, moins cent soixante de ménage et de petites réparations. Il reste mille deux cents euros pour le propriétaire. | clear, confident teacher, energetic |
| b7 | Le piège : mélanger l'argent. Si les paiements des séjours arrivent chez vous, gardez-les à part de votre trésorerie, et reversez à date fixe, par exemple le cinq de chaque mois. | knowing, a little playful |
| b8 | Troisième pièce : le relevé. Chaque mois, le propriétaire reçoit le détail, séjour par séjour : les nuits, les revenus, chaque frais, votre commission, et ce qui lui est versé. Les mêmes chiffres que son virement. | clear, confident teacher, energetic |
| b9 | Un relevé clair, c'est moins d'appels inquiets… et un propriétaire qui vous fait confiance pour la suite. | clear, confident teacher, energetic |
| b10 | Mise en pratique : avant de signer, vérifiez cinq points. La base de la commission. Qui paie les frais de plateforme. La date du reversement. Le relevé mensuel. Et les règles de votre pays : selon le pays, gérer le bien d'un autre peut exiger une carte professionnelle ou une assurance. Renseignez-vous avant votre premier mandat. | clear, confident teacher, energetic |
| b11 | À retenir : un mandat précis, un reversement calculé poste par poste, à date fixe, et un relevé chaque mois. Dans Bètli, le mandat se signe en ligne ; chaque contrat fixe la base de la commission et qui paie les frais des plateformes ; le reversement part après votre validation ; et le relevé mensuel peut partir tout seul, avec les mêmes chiffres que le virement. | warm, upbeat |
| b12 | Bètli Académie : le métier, expliqué simplement. | bright, proud |
