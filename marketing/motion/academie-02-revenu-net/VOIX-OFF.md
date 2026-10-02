# Baitly Académie · Épisode 02 « Votre revenu net, vraiment » · Brief voix off (FR)

> **À quoi sert ce fichier.** Textes, intonation et plans de la voix off de l'épisode 02 (2 min 15).
> **Comment l'utiliser.** Une seule prise (textes balisés dans `../academie-shared/scripts-academie.json`)
> dans `vo/fr/_prise-complete-paulk.mp3`, puis `python3 align-vo.py academie-02-revenu-net fr` : les plans suivent la
> voix. Rendu : `node render.mjs academie-02-revenu-net --format=9x16` puis `--format=16x9`.
> **À qui il s'adresse.** Toi (ElevenLabs), un comédien, un prestataire audio.

## 1. Règles communes

| Point | Consigne |
|---|---|
| **Voix** | **Paul K · French Ad & Trailer** (`ecxPjiGTvAfpGEams6ec`), **Eleven v4**, Stabilité 0,35, direction « prof enthousiaste » ; « complice » sur les pièges. |
| **Prononciation** | « Bètli ». Chiffres écrits en toutes lettres. |
| **Vérité** | Exemple fictif, calculs exacts ; taux de commission de 15 % donné comme exemple (à l'écran : « Taux d'exemple · selon plateforme et contrat »). Phrase produit vérifiée dans le code : rentabilité nette par logement, commission du canal et coûts d'intervention déduits (`PropertyPnlService`, via l'assistant). |

## 2. Chapitres (ils suivent la voix)

| Chapitre | Répliques | Ce qu'on voit |
|---|---|---|
| 0 · Accroche | b1 | Réservation confirmée, 670 € payés |
| 1 · Ce que paie le voyageur | b2-b3 | Relevé : 600 + 60 + 10 = 670 € ; la taxe de séjour est reversée → 660 € |
| 2 · La commission | b4-b5 | 15 % = 99 € → versement 561 € ; piège : « pas votre revenu » |
| 3 · Les coûts du séjour | b6-b8 | Ménage 55 €, linge 15 €, consommables et énergie 23 € → 468 € (93,60 € par nuit) ; piège : ménage facturé 60 €, dépensé 70 € |
| 4 · Le mois | b9-b10 | 4 séjours = 1 872 € − charges fixes 450 € = 1 422 € avant impôts ; où partent les 2 680 € payés |
| 5 · Que faire | b11 | Net par nuit, prix plancher, comparer les canaux (renvoi vers l'épisode 18) |
| 6 · À retenir | b12 | La chaîne du net ; Baitly |
| Fin | b13 | Logo, baitly.fr |

## 3. Français

| # | Texte | Intonation |
|---|---|---|
| b1 | Un voyageur vous paie six cent soixante-dix euros pour cinq nuits. Bonne nouvelle… mais combien vous reste-t-il vraiment ? Suivons cet argent, étape par étape, jusqu'à votre poche. | beat |
| b2 | D'abord, ce que paie le voyageur : six cents euros d'hébergement, cinq nuits à cent vingt euros. Soixante euros de frais de ménage. Et dix euros de taxe de séjour. | clear, confident teacher, energetic |
| b3 | Première étape : la taxe de séjour ne vous appartient pas. Vous, ou la plateforme, la reversez à la commune. Il reste six cent soixante euros. | clear, confident teacher, energetic |
| b4 | Deuxième étape : la commission de la plateforme. Prenons quinze pour cent, ménage compris : quatre-vingt-dix-neuf euros. Vous recevez un versement de cinq cent soixante et un euros. | clear, confident teacher, energetic |
| b5 | Attention au piège : ce versement n'est pas votre revenu. Beaucoup d'hôtes s'arrêtent là… alors que le logement n'a même pas encore été nettoyé. | beat |
| b6 | Troisième étape : les coûts du séjour. Le ménage : cinquante-cinq euros. Le linge : quinze euros. Les consommables et l'énergie : vingt-trois euros. | clear, confident teacher, energetic |
| b7 | Il vous reste quatre cent soixante-huit euros. Vous affichiez cent vingt euros la nuit… vous en gardez quatre-vingt-treize soixante. | beat |
| b8 | Deuxième piège : les frais de ménage facturés ne sont pas un bénéfice. Soixante euros facturés, soixante-dix euros dépensés avec le linge : ce poste vous coûte dix euros par séjour. | knowing, a little playful |
| b9 | Dernière étape : le mois. Quatre séjours comme celui-ci : mille huit cent soixante-douze euros. Retirez vos charges fixes, assurance, internet, abonnements, copropriété : quatre cent cinquante euros. | clear, confident teacher, energetic |
| b10 | Votre revenu net du mois : mille quatre cent vingt-deux euros, avant impôts. Un peu plus de la moitié de ce que vos voyageurs ont payé. | emphatic, knowing |
| b11 | Que faire de ce chiffre ? D'abord, suivez le net par nuit, pas le prix affiché. Ensuite, fixez un prix plancher : jamais sous vos coûts, commission comprise. Enfin, comparez vos canaux : une commission plus basse change tout. C'est le sujet de l'épisode dix-huit. | clear, confident teacher, energetic |
| b12 | À retenir : prix payé, moins la taxe de séjour, moins la commission, moins les coûts du séjour, moins les charges du mois. Dans Bètli, votre assistant calcule la rentabilité nette de chaque logement, commissions et interventions déduites. | warm, upbeat |
| b13 | Bètli Académie : le métier, expliqué simplement. | bright, proud |
