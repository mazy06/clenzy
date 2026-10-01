# Reel 01 « Manifeste » · Brief voix off (FR · EN · AR)

> **À quoi sert ce fichier.** Tout ce qu'il faut pour produire la voix off du Reel 01 dans les trois
> langues avec n'importe quel générateur de voix (ou un comédien) : texte exact de chaque réplique,
> fenêtre de temps disponible, durée visée, intonation, prononciation et format de livraison.
> **Comment l'utiliser.** Générer les 7 répliques de chaque langue, une par fichier, avec les noms
> indiqués ; les déposer dans `vo/fr/`, `vo/en/`, `vo/ar/` ; relancer le rendu. L'animation est déjà
> calée sur les fenêtres ci-dessous : si une réplique déborde, la raccourcir, pas l'accélérer.
> **À qui il s'adresse.** Toi (générateur de voix), un comédien, ou un prestataire audio.

---

## 1. Règles communes aux trois langues

| Point | Consigne |
|---|---|
| **Prononciation du nom** | **« Bètly »** (bèt-li), jamais « ba-ït-li ». Le texte à envoyer au générateur est déjà écrit phonétiquement : FR « Bètli », EN « Betly », AR « بيتلي ». |
| **Adresse** | FR « bètli point F R » · EN « betly dot F R » · AR « بيتلي دوت إف آر ». |
| **Profil de voix** | 30–45 ans, timbre chaud, médium à grave, sourire audible. Une seule et même voix pour les 7 répliques d'une langue. |
| **Ton global** | Professionnel mais chaleureux, calme et assuré. Pas de ton « pub radio », pas d'emphase, pas de voix de bande-annonce. On parle à un hôte, comme une collègue expérimentée. |
| **Débit** | Posé : environ 2,2 mots/s en français, 2,5 en anglais, 1,9 en arabe. Si une réplique dépasse sa fenêtre, on raccourcit le texte (variante courte fournie), on n'accélère pas. |
| **Réglages TTS conseillés** | Stabilité moyenne (≈ 0,5), style / exagération faible (≈ 0,1–0,2), vitesse 0,95–1,0. Générer de préférence tout le script d'une traite puis découper, ou fournir le texte précédent/suivant comme contexte, pour garder la même intonation. |
| **Format de livraison** | WAV 48 kHz mono (24 bits de préférence ; MP3 320 kb/s accepté). Un fichier par réplique : `b1.wav` … `b7.wav`. Pas de musique ni d'effet, pas de réverbération. Silences en début et fin ≤ 0,15 s. Niveau homogène entre fichiers (le rendu normalise ensuite à −14 LUFS). |

## 2. Fenêtres de temps (identiques pour les trois langues)

L'animation est fixe. Chaque réplique **démarre** à son repère et doit **se terminer** avant la
limite, sinon elle chevauche la scène suivante.

| Réplique | Départ | Doit finir avant | Fenêtre max | Durée visée | Ce qu'on voit à l'écran |
|---|---|---|---|---|---|
| b1 | 0,4 s | 3,1 s | 2,7 s | 2,2–2,5 s | Photo de l'hôte devant le planning, titre qui s'écrit |
| b2 | 3,3 s | 6,0 s | 2,7 s | 1,5–2,2 s | Les onglets tombent en cascade |
| b3 | 6,2 s | 11,9 s | 5,7 s | 4,8–5,4 s | Onglets qui vibrent, mots clés, puis tout se compresse |
| b4 | 12,2 s | 16,2 s | 4,0 s | 2,8–3,4 s | Le logo se dessine et s'ouvre sur le planning |
| b5 | 16,6 s | 22,4 s | 5,8 s | 5,0–5,5 s | Cartes des agents ; **le clic sur « Approuver » tombe à 21,35 s** |
| b6 | 23,0 s | 26,4 s | 3,4 s | 3,0–3,3 s | Titre promesse ; **2e phrase affichée à 24,5 s** |
| b7 | 26,8 s | 32,5 s | 5,7 s | 3,8–4,8 s | Logo animé, bouton, adresse, faits produit |

**Deux synchronisations importantes :**
- **b5** : le dernier segment (« et vous validez » / « and you approve » / « وأنت تعتمد ») doit tomber
  entre **21,0 et 22,2 s**, au moment du clic. Donc b5 doit durer **au moins 4,6 s**.
- **b6** : marquer une vraie pause (0,5–0,8 s) entre les deux phrases, pour que la seconde commence
  vers **24,5 s**, quand elle s'affiche.

---

## 3. Français (fr-FR)

**Voix** : **Lucie** (ElevenLabs v3), français de France, accent neutre.

Voix française : **Lucie** (`LFtQZWdaqmvamcTNGpwl`). Textes réécrits le 28 septembre 2026 pour remplir chaque scène (85 à 95 %) sans blanc.

Voix française : **Lucie** (`LFtQZWdaqmvamcTNGpwl`). Textes réécrits le 28 septembre 2026 pour remplir chaque scène (85 à 95 %) sans blanc.

Voix française : **Lucie** (`LFtQZWdaqmvamcTNGpwl`). Textes réécrits le 28 septembre 2026 pour remplir chaque scène (85 à 95 %) sans blanc.

Voix française : **Lucie** (`LFtQZWdaqmvamcTNGpwl`). Textes réécrits le 28 septembre 2026 pour remplir chaque scène (85 à 95 %) sans blanc.

Voix française : **Lucie** (`LFtQZWdaqmvamcTNGpwl`). Textes réécrits le 28 septembre 2026 pour remplir chaque scène (85 à 95 %) sans blanc.

Voix française : **Lucie** (`LFtQZWdaqmvamcTNGpwl`). Textes réécrits le 28 septembre 2026 pour remplir chaque scène (85 à 95 %) sans blanc.

| # | Texte à générer (tel quel) | Durée visée | Intonation |
|---|---|---|---|
| b1 | Vous avez ouvert un logement pour accueillir. | 2,8 s | Posé, chaleureux, comme une confidence. Légère mise en valeur de « accueillir ». |
| b2 | Pas pour vivre dans vos onglets ouverts. | 2,5 s | Petit sourire, complicité. Chute nette sur « onglets ». |
| b3 | Les réservations, les prix, le ménage, les messages… tout arrive en même temps, et de partout. | 5,8 s | Énumération rythmée, micro-respiration entre chaque élément, le rythme s'accélère légèrement ; une pointe de lassitude amusée sur « tout arrive en même temps ». |
| b4 | Bètli réunit tout dans un seul espace, autour de votre planning. | 4,0 s | Retour au calme, apaisé et assuré. Appui doux sur « un seul espace ». |
| b5 | Et une équipe d'agents I.A. s'occupe du reste : ils préparent, proposent… et vous validez. | 5,6 s | Explicatif, confiant. Verbes bien détachés, courte suspension avant « et vous validez », dit avec chaleur. |
| b6 | Faites grandir vos revenus. … Pas votre charge de travail. | 3,6 s | Phrase signature. 1re phrase énergique et claire, pause, 2e phrase un ton plus bas, avec un sourire. |
| b7 | Bètli. Rejoignez le pré-lancement dès aujourd'hui, sur bètli point F R. | 4,4 s | Nom de marque net, courte pause, invitation chaleureuse, adresse bien articulée. |

Texte affiché en sous-titres (orthographe normale) : « Baitly », « IA », « baitly.fr ».

## 4. English (en)

**Voix** : anglais international neutre (léger accent britannique ou « mid-Atlantic » accepté), pas
d'accent américain très marqué, pas de ton publicitaire.

English voice: **Mark** (`WTUK291rZZ9CLPCiFTfh`). Texts rewritten on 28 September 2026 to fill each scene (85 to 95 %) with no gaps.

English voice: **Mark** (`WTUK291rZZ9CLPCiFTfh`). Texts rewritten on 28 September 2026 to fill each scene (85 to 95 %) with no gaps.

English voice: **Mark** (`WTUK291rZZ9CLPCiFTfh`). Texts rewritten on 28 September 2026 to fill each scene (85 to 95 %) with no gaps.

English voice: **Mark** (`WTUK291rZZ9CLPCiFTfh`). Texts rewritten on 28 September 2026 to fill each scene (85 to 95 %) with no gaps.

English voice: **Mark** (`WTUK291rZZ9CLPCiFTfh`). Texts rewritten on 28 September 2026 to fill each scene (85 to 95 %) with no gaps.

English voice: **Mark** (`WTUK291rZZ9CLPCiFTfh`). Texts rewritten on 28 September 2026 to fill each scene (85 to 95 %) with no gaps.

| # | Text to generate (verbatim) | Target | Delivery |
|---|---|---|---|
| b1 | You opened your doors to welcome guests. | 2,5 s | Calm and warm, a quiet confidence. Gentle lift on "welcome". |
| b2 | Not to live in your open tabs all day long. | 2,7 s | Knowing smile. Crisp landing on "tabs". |
| b3 | Bookings, rates, housekeeping, messages… it all lands at the same time, from everywhere. | 5,5 s | Rhythmic list, tiny breaths between items, slight build-up; a hint of amused weariness on "it all lands at once". |
| b4 | Betly brings it all together in one place, around your calendar. | 4,0 s | Settled and reassuring. Soft emphasis on "one place". |
| b5 | And a team of A.I. agents takes care of the rest: they prepare, they propose… and you approve. | 5,9 s | Clear and confident. Detach the verbs, short suspension, then a warm "and you approve". |
| b6 | Grow your revenue. … Not your workload. | 2,4 s | Signature line. First sentence bright and clear, pause, second a touch lower, smiling. |
| b7 | Betly. Join the pre-launch today, at betly dot F R. | 3,2 s | Brand name crisp, short pause, warm invitation, articulate the address. |

Variantes courtes si une réplique déborde : b3 « Bookings, rates, cleaning, messages… all at once. » ·
b5 « And a team of A.I. agents does the rest: they prepare, propose… and you approve. »

Sous-titres : « Baitly », « AI », « baitly.fr ».

## 5. العربية (ar)

**Voix** : arabe standard moderne (فصحى) avec une prononciation du Golfe naturelle (marché saoudien),
ton respectueux et chaleureux. Éviter les accents égyptien ou levantin marqués. Le texte ci-dessous
est vocalisé sur les mots sensibles pour aider la synthèse.

| # | النص (كما هو) | Durée visée | Intonation |
|---|---|---|---|
| b1 | فتحتَ أبوابَكَ لتستقبلَ ضيوفَك. | 2,4 s | Calme, chaleureux, confidence. Mise en valeur de « لتستقبلَ ». |
| b2 | لا لتعيشَ بينَ تبويباتِ المتصفّح. | 2,2 s | Complicité, léger sourire. Chute nette en fin de phrase. |
| b3 | الحجوزات، والأسعار، والتنظيف، والرسائل… كلُّها تصلُ في الوقتِ نفسِه. | 5,4 s | Énumération rythmée avec micro-pauses, légère accélération, pointe de lassitude amusée sur « كلُّها تصلُ في الوقتِ نفسِه ». |
| b4 | بيتلي يجمعُ كلَّ شيءٍ في مساحةٍ واحدة. | 3,2 s | Apaisé, assuré. Appui doux sur « مساحةٍ واحدة ». |
| b5 | ووكلاءُ الذكاءِ الاصطناعي يتولّون الباقي: يُحضّرون، ويقترحون… وأنتَ تعتمد. | 5,4 s | Explicatif, confiant. Verbes détachés, courte suspension, puis « وأنتَ تعتمد » dit avec chaleur, au moment du clic. |
| b6 | نمِّ إيراداتِك. … لا أعباءَ عملِك. | 3,0 s | Phrase signature. 1re phrase claire et énergique, pause, 2e plus posée, avec un sourire. |
| b7 | بيتلي. انضمَّ إلى ما قبلَ الإطلاق، على بيتلي دوت إف آر. | 4,6 s | Nom de marque net, courte pause, invitation chaleureuse, adresse articulée. |

L'arabe est la langue la plus serrée : viser un débit naturel mais soutenu (≈ 1,9 mot/s). Si b5 déborde
encore, variante plus courte : « والوكلاءُ الأذكياءُ يتولّون الباقي: يُحضّرون، ويقترحون… وأنتَ تعتمد. »

Sous-titres : « بيتلي », « الذكاء الاصطناعي », « baitly.fr ». L'orthographe arabe officielle de la marque
est « بيتلي » (alignée sur la landing et l'application).

---

## 6. Livraison et intégration

```
reel-01-manifeste/vo/fr/b1.wav … b7.wav
reel-01-manifeste/vo/en/b1.wav … b7.wav
reel-01-manifeste/vo/ar/b1.wav … b7.wav
```

Puis : `node render.mjs reel-01-manifeste --lang=fr` (ou `en`, `ar`) → `out/reel-01-manifeste-fr.mp4`.
Si une durée réelle sort de sa fenêtre, me le signaler : je décale le départ de la réplique suivante
ou je raccourcis le texte, sans refaire l'animation.
