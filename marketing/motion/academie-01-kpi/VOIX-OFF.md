# Baitly Académie · Épisode 01 « Les 3 KPI de base » · Brief voix off (FR)

> **À quoi sert ce fichier.** Textes, intonation et prononciation de la voix off de l'épisode 01,
> version longue (2 min 43).
> **Comment l'utiliser.** Une seule prise (un paragraphe par réplique, textes balisés dans
> `../academie-shared/scripts-academie.json`) dans `vo/fr/_prise-complete-paulk.mp3`, puis
> `python3 align-vo.py academie-01-kpi fr` : les plans suivent la voix. Rendu :
> `node render.mjs academie-01-kpi --format=9x16` puis `--format=16x9`.
> La version courte de 60 s (7 répliques) est archivée dans `vo/_v1-60s/` ; ses vidéos sont
> `out/academie-01-kpi-v1-60s-fr-*.mp4`.
> **À qui il s'adresse.** Toi (ElevenLabs), un comédien, un prestataire audio.

## 1. Règles communes

| Point | Consigne |
|---|---|
| **Voix** | **Paul K · French Ad & Trailer** (`ecxPjiGTvAfpGEams6ec`), **Eleven v4**, Stabilité 0,35, direction « prof enthousiaste » : clair, assuré, énergique ; « complice » sur les pièges. |
| **Prononciation** | « Bètli » ; « RevPAR » se dit « rève-par » ; « A.D.R. » s'épelle. Chiffres écrits en toutes lettres. |
| **Durée** | Moins de 3 min : limite des Reels Instagram. |
| **Vérité** | Exemple fictif, calculs exacts. La vidéo enseigne la définition métier (nuits bloquées retirées des nuits disponibles, chiffre d'affaires hébergement seul) ; la phrase produit reste vérifiable : calcul automatique par logement et comparaison avec l'année précédente (`AiAnalyticsService`). |
| **Coupures** | La détection automatique se trompait d'une phrase sur b5 et b12-b15 : frontières imposées dans `FORCE_BOUNDS` d'`align-vo.py`, à refaire si la prise change. |

## 2. Chapitres (ils suivent la voix)

| Chapitre | Répliques | Ce qu'on voit |
|---|---|---|
| 0 · Accroche | b1 | Calendrier qui se remplit ; « Votre calendrier est plein… mais rapporte-t-il vraiment ? » ; les trois indicateurs |
| 1 · Occupation | b2-b4 | Formule, 22/30 = 73 % ; piège : 5 nuits bloquées hachurées → 22/25 = 88 % |
| 2 · Prix moyen | b5-b7 | Formule, 2 640 € / 22 = 120 €, barres ; piège : reçu voyageur (ménage 330 €, taxe de séjour 110 €) → 3 080 € / 22 = 140 €, « +20 € de trop » |
| 3 · RevPAR | b8-b10 | Formule, 2 640 € / 30 = 88 €, 22 barres et 8 nuits vides en pointillé ; « 22/30 × 120 € = 88 € » |
| 4 · Trois stratégies | b11-b12 | Brader (95 €, 27 nuits, 85,50 €), viser trop haut (160 €, 12 nuits, 64 €), prix juste (120 €, 22 nuits, 88 €, meilleur RevPAR) |
| 5 · Lire ensemble | b13-b15 | Grille occupation × prix : trop bon marché, trop cher, annonce à revoir, bravo ; « Comparez juin à juin » |
| 6 · À retenir | b16 | Les trois indicateurs et leur formule ; « Dans Baitly : calculés automatiquement… » |
| Fin | b17 | Logo, Baitly Académie, baitly.fr |

## 3. Français

| # | Texte | Intonation |
|---|---|---|
| b1 | Votre calendrier est plein… mais est-ce que votre logement rapporte vraiment ? Trois chiffres suffisent pour le savoir. Apprenons à les calculer, à les lire… et à décider. | Curieux, accrocheur. |
| b2 | Premier chiffre : le taux d'occupation. Quelle part de vos nuits avez-vous vendue ? Les nuits vendues, divisées par les nuits disponibles. | Prof clair et énergique. |
| b3 | En juin, votre studio est ouvert trente nuits, et vous en vendez vingt-deux. Vingt-deux sur trente : soixante-treize pour cent. | Prof clair et énergique. |
| b4 | Attention au piège : une nuit que vous bloquez, pour vous ou pour des travaux, n'est pas à vendre. Cinq nuits bloquées ? Vous divisez par vingt-cinq… et votre taux passe à quatre-vingt-huit pour cent. | Complice, un peu joueur. |
| b5 | Deuxième chiffre : le prix moyen par nuit, ou A.D.R. Combien rapporte une nuit vendue ? Le chiffre d'affaires hébergement, divisé par les nuits vendues. | Prof clair et énergique. |
| b6 | Vos vingt-deux nuits ont rapporté deux mille six cent quarante euros : cent vingt euros la nuit. | Prof clair et énergique. |
| b7 | Deuxième piège : ne comptez que l'hébergement. Ajoutez les trois cent trente euros de ménage et les cent dix euros de taxe de séjour, et votre prix moyen gonfle à cent quarante euros… vingt euros de trop. | Complice, un peu joueur. |
| b8 | Troisième chiffre, le plus important : le RevPAR, le revenu par nuit disponible. Le même chiffre d'affaires… mais divisé par toutes les nuits, y compris les nuits vides. | Prof clair et énergique. |
| b9 | Deux mille six cent quarante euros sur trente nuits : quatre-vingt-huit euros. C'est aussi l'occupation multipliée par le prix moyen. | Prof clair et énergique. |
| b10 | Une nuit vide ne rapporte rien, et le RevPAR ne l'oublie jamais : il réunit les deux premiers chiffres en un seul. | Appuyé, complice. |
| b11 | Comparons trois stratégies. Un : vous bradez à quatre-vingt-quinze euros. Vingt-sept nuits vendues, quatre-vingt-dix pour cent… mais un RevPAR de quatre-vingt-cinq euros cinquante. | Prof clair et énergique. |
| b12 | Deux : vous visez cent soixante euros. Douze nuits seulement : RevPAR, soixante-quatre euros. Trois : le prix juste, cent vingt euros. Vingt-deux nuits… et le meilleur RevPAR, quatre-vingt-huit euros. | Prof clair et énergique. |
| b13 | Maintenant, lisez-les ensemble. Occupation haute, prix bas : vous êtes trop bon marché, montez vos prix. Occupation basse, prix élevé : trop cher, ajustez. | Prof clair et énergique. |
| b14 | Occupation basse, prix bas : ce n'est pas le prix, c'est l'annonce. Photos, description, visibilité. Et si les deux sont hauts… bravo, surveillez le marché. | Prof clair et énergique. |
| b15 | Et comparez toujours juin à juin, jamais juin à mai : la saison change tout. | Chaleureux, complice. |
| b16 | À retenir : l'occupation dit combien vous vendez, le prix moyen à combien, et le RevPAR ce que vos nuits rapportent vraiment. Dans Bètli, les trois se calculent tout seuls, logement par logement, comparés à l'année précédente. | Chaleureux, enlevé. |
| b17 | Bètli Académie : le métier, expliqué simplement. | Lumineux, fier. |
