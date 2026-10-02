# Baitly Académie · Épisode 14 « Les 7 questions que tous les voyageurs posent » · Brief voix off (FR)

> **À quoi sert ce fichier.** Textes, intonation et plans de la voix off de l'épisode 14 (2 min).
> **Comment l'utiliser.** Une seule prise (textes balisés dans `../academie-shared/scripts-academie.json`)
> dans `vo/fr/_prise-complete-*.mp3`, puis `python3 align-vo.py academie-14-questions-voyageurs fr` : les plans suivent la voix.
> Rendu : `node render.mjs academie-14-questions-voyageurs --format=9x16` puis `--format=16x9`.
> **À qui il s'adresse.** Toi (ElevenLabs), un comédien, un prestataire audio.

## 1. Règles communes

| Point | Consigne |
|---|---|
| **Voix** | **Noé · Content Creator** (`7pDdnNI6PhXmAp0pXFZm`, français standard), **Eleven v4**, Stabilité 0,4, Similarité 0,8, direction « prof enthousiaste ». Prise ralentie de 6 % (`atempo=0.94`, hauteur inchangée) ; prise brute dans `vo/_noe-brut/`. |
| **Prononciation** | « Bètli » (réécrit Baitly dans les sous-titres). Chiffres en toutes lettres, réécrits en chiffres dans les sous-titres. |
| **Coupures** | Détection automatique au silence, sans correction : aucune réplique au débit anormal. |
| **Vérité** | Exemple fictif, calculs exacts : 20 séjours × 3 questions × 5 min = 300 min = 5 h par mois ; si le livret règle 2 questions sur 3 : 100 min = 1 h 40. Phrase produit vérifiée : lien du livret envoyé par l'automatisation « Envoyer le livret » (`SEND_GUIDE`, déclenchable quelques jours avant l'arrivée ou le jour même), lien ouvert 7 jours avant l'arrivée par défaut (`GuideConfig.leadDays`), code d'accès masqué avant l'heure d'arrivée dans le fuseau du logement (`WelcomeGuideService.isAccessCodeUnlocked`), assistant du livret nourri du seul contenu du livret (`serializeForChat`). D'où « votre livret **peut** partir automatiquement ». |
| **Visuels** | Photos : `../academie-shared/photos/SOURCES.md`. Le code 4827 affiché est fictif. |

## 2. Chapitres (ils suivent la voix)

| Chapitre | Répliques | Ce qu'on voit |
|---|---|---|
| 0 · Accroche | b1 | Messages de voyageurs qui s'empilent : Wi-Fi, heure d'arrivée, parking, plaque |
| 1 · Ce qu'elles coûtent | b2-b3 | Un message à lire, une réponse à écrire ; en plein ménage, tard le soir ; 20 × 3 × 5 = 300 min, 5 h |
| 2 · Les 7 questions | b4-b6 | Les sept questions par moment du séjour ; piège : le livret de 20 pages ; la bonne réponse : une phrase, une photo |
| 3 · Le bon moment | b7-b8 | Quelques jours avant / pendant le séjour / la veille du départ ; le code d'accès masqué, les risques, puis révélé le jour même |
| 4 · Mise en pratique | b9 | 300 min → 100 min (1 h 40) ; les messages qui restent : panne, imprévu, demande particulière |
| 5 · À retenir | b10 | Trois règles ; Baitly : livret envoyé automatiquement, code masqué, assistant |
| Fin | b11 | Logo, baitly.fr |

## 3. Français

| # | Texte | Intonation |
|---|---|---|
| b1 | « Quel est le code Wi-Fi ? » Si vous louez depuis un moment, vous l'avez lu des dizaines de fois. Les voyageurs posent presque toujours les mêmes sept questions. Voyons lesquelles… et comment y répondre avant qu'elles arrivent. | curious, engaging, a touch of urgency |
| b2 | D'abord, ce que coûtent ces questions. Chacune, c'est un message à lire, une réponse à écrire, et souvent au mauvais moment : en plein ménage, ou tard le soir. | clear, confident teacher, energetic |
| b3 | Faisons le calcul. Vingt séjours par mois, trois questions par séjour, cinq minutes par réponse : trois cents minutes. Cinq heures par mois… à répéter les mêmes réponses. | clear, confident teacher, energetic |
| b4 | Voici les sept. Avant l'arrivée : un, comment j'entre ? Deux, à quelle heure puis-je arriver ? Trois, où puis-je me garer ? | clear, confident teacher, energetic |
| b5 | Pendant le séjour : quatre, le Wi-Fi. Cinq, comment marchent le chauffage, les plaques, la machine à café ? Six, où vont les poubelles ? Et au départ : sept, que dois-je faire en partant ? | clear, confident teacher, energetic |
| b6 | Le piège : le livret de vingt pages, envoyé la veille. Personne ne le lit. Il faut une réponse courte par question, avec une photo dès qu'il s'agit d'un lieu. Par exemple : « La boîte à clés est à gauche de la porte en bois. » Une phrase, une photo. | knowing, a little playful |
| b7 | Deuxième notion : le bon moment. Chaque réponse a le sien. Quelques jours avant l'arrivée : l'adresse, le parking, l'heure d'arrivée. Pendant le séjour : le Wi-Fi et les modes d'emploi. La veille du départ : les consignes de sortie. | clear, confident teacher, energetic |
| b8 | Et le code d'accès ? Surtout pas trop tôt. Un code envoyé une semaine avant peut circuler, ou servir à entrer avant l'heure… pendant que le ménage est en cours. Le code, c'est le jour même, à l'heure d'arrivée. | knowing, a little playful |
| b9 | Mise en pratique. Si votre livret répond à deux questions sur trois, vos trois cents minutes tombent à cent : une heure quarante par mois, au lieu de cinq heures. Et les messages qui restent sont ceux qui comptent vraiment : une panne, un imprévu, une demande particulière. | clear, confident teacher, energetic |
| b10 | À retenir : sept questions, une réponse courte pour chacune, envoyée au bon moment, et le code d'accès le jour même. Dans Bètli, votre livret d'accueil peut partir automatiquement quelques jours avant l'arrivée ; le code d'accès y reste masqué jusqu'à l'heure d'arrivée, et un assistant répond aux questions du voyageur à partir de votre livret. | warm, upbeat |
| b11 | Bètli Académie : le métier, expliqué simplement. | bright, proud |
