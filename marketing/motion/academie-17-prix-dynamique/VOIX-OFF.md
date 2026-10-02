# Baitly Académie · Épisode 17 « Le prix dynamique en 3 règles » · Brief voix off (FR)

> **À quoi sert ce fichier.** Textes, intonation et plans de la voix off de l'épisode 17 (2 min 23).
> **Comment l'utiliser.** Une seule prise (textes balisés dans `../academie-shared/scripts-academie.json`)
> dans `vo/fr/_prise-complete-*.mp3`, puis `python3 align-vo.py academie-17-prix-dynamique fr` : les plans suivent la voix.
> Rendu : `node render.mjs academie-17-prix-dynamique --format=9x16` puis `--format=16x9`.
> **À qui il s'adresse.** Toi (ElevenLabs), un comédien, un prestataire audio.

## 1. Règles communes

| Point | Consigne |
|---|---|
| **Voix** | **Lucie · Narration** (`LFtQZWdaqmvamcTNGpwl`), **Eleven v4**, Stabilité 0,3, Similarité 0,75, direction « prof enthousiaste ». Les épisodes alternent voix féminine (Lucie) et masculine (Noé). |
| **Prononciation** | « Bètli ». Chiffres écrits en toutes lettres. |
| **Coupures** | Frontières imposées dans `FORCE_BOUNDS` (align-vo.py) : la pause de la virgule « ne rapporte rien, » passait pour la fin de b8. |
| **Vérité** | Exemple fictif, calculs exacts : 750 € ÷ 30 = 25 € ; 60 € ÷ 3 = 20 € ; 45 € la nuit ; 45 ÷ 0,85 = 52,94 → 53 € affichés (commission 7,95 €, il reste 45,05 €) ; 100 € + 20 % = 120 € ; 4 week-ends = 8 nuits × 20 € = 160 € (« si ces nuits se vendent toujours ») ; 100 € − 10 % = 90 € ; − 20 % = 80 €. Aucun taux de hausse ou de remise présenté comme une norme du marché. Phrase produit vérifiée : bornes plancher/plafond par logement (`YieldPropertyBoundsDto`, requises pour que le moteur agisse), plans tarifaires `WEEKEND` et `LAST_MINUTE` (`RatePlanType`, résolus par `PriceEngine`). |

## 2. Chapitres (ils suivent la voix)

| Chapitre | Répliques | Ce qu'on voit |
|---|---|---|
| 0 · Accroche | b1 | Une semaine à 100 € tous les jours ; samedi « trop bon marché », mardi « vide » ; les trois règles |
| 1 · Le plancher | b2-b4 | Coût d'une nuit (25 € + 20 € = 45 €) ; piège de la commission : 53 € affichés ; « en dessous, à perte » |
| 2 · Les week-ends | b5-b7 | Barres de la semaine, vendredi et samedi à 120 € (+20 %), +160 € sur 4 week-ends ; signes d'un prix trop bas ; vacances et événements |
| 3 · La dernière minute | b8-b10 | Mardi encore libre : J-10 100 €, J-7 90 €, J-3 80 €, ligne du plancher à 53 € ; piège : baisser trop tôt |
| 4 · En pratique | b11 | Trois questions chaque semaine, trois réponses |
| 5 · À retenir | b12 | Trois règles ; Baitly |
| Fin | b13 | Logo, baitly.fr |

## 3. Français

| # | Texte | Intonation |
|---|---|---|
| b1 | Même logement, même prix, tous les jours de l'année ? C'est simple… mais le samedi, vous vendez trop bon marché, et le mardi, votre logement reste vide. Le prix dynamique, ce n'est pas de la magie : ce sont trois règles. Voyons-les une par une. | curious, engaging, a touch of urgency |
| b2 | Règle numéro un : le plancher. C'est le prix en dessous duquel vous ne descendez jamais. Pour le trouver, calculez ce que vous coûte une nuit. | clear, confident teacher, energetic |
| b3 | Vos charges du mois, sept cent cinquante euros, divisées par trente nuits : vingt-cinq euros. Le ménage et le linge, soixante euros par séjour, pour des séjours de trois nuits en moyenne : vingt euros par nuit. Une nuit vous coûte donc quarante-cinq euros. | clear, confident teacher, energetic |
| b4 | Attention au piège : la commission de la plateforme. À quinze pour cent, pour garder quarante-cinq euros, il faut afficher cinquante-trois euros. Votre plancher, c'est cinquante-trois euros. En dessous, votre calendrier se remplit… mais vous perdez de l'argent. | knowing, a little playful |
| b5 | Règle numéro deux : les week-ends. La demande n'est pas la même tous les jours : le vendredi et le samedi, elle monte. Votre prix doit monter aussi. | clear, confident teacher, energetic |
| b6 | Cent euros en semaine, cent vingt euros le vendredi et le samedi : plus vingt pour cent. Si ces nuits se vendent toujours, sur quatre week-ends, huit nuits : cent soixante euros de plus… sans une seule nuit en plus. | clear, confident teacher, energetic |
| b7 | Comment savoir si vous êtes au bon prix ? Regardez quand vos week-ends se réservent. S'ils partent tous deux mois à l'avance, vous êtes trop bon marché. Même logique pour les vacances scolaires et les événements : un salon, un festival, un match. | knowing, a little playful |
| b8 | Règle numéro trois : la dernière minute. Une nuit invendue ne rapporte rien, et elle ne se revend jamais. | clear, confident teacher, energetic |
| b9 | Un mardi encore libre à sept jours : moins dix pour cent, quatre-vingt-dix euros. Toujours libre à trois jours : moins vingt pour cent, quatre-vingts euros. Et jamais sous votre plancher : cinquante-trois euros. | clear, confident teacher, energetic |
| b10 | Le piège, ici : baisser trop tôt, ou trop fort. Vos voyageurs apprennent à attendre… et vous bradez des nuits qui seraient parties au bon prix. | knowing, a little playful |
| b11 | En pratique, chaque semaine, posez-vous trois questions. Un prix sous mon plancher ? Je remonte. Mes week-ends partent trop vite ? J'augmente. Une nuit libre à sept jours ? Je baisse, par paliers, sans jamais passer sous le plancher. | clear, confident teacher, energetic |
| b12 | À retenir : un plancher que rien ne traverse, des week-ends au prix de la demande, et une dernière minute maîtrisée. Dans Bètli, fixez un plancher et un plafond par logement, des tarifs week-end et dernière minute : les ajustements proposés par le moteur de prix restent toujours entre vos bornes. | warm, upbeat |
| b13 | Bètli Académie : le métier, expliqué simplement. | bright, proud |
