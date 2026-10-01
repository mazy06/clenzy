# Reel 15 « Les cartes de la journée » · Brief voix off (FR · EN)

> **À quoi sert ce fichier.** Textes, intonation et prononciation de la voix off du Reel 15
> (compilation : une journée d'hôte, carte après carte, le thermostat réglé à distance, puis les
> cartes qu'on choisit de passer en automatique).
> **Comment l'utiliser.** Une seule prise par langue (un paragraphe par réplique) dans
> `vo/<langue>/_prise-complete-<voix>.mp3`, puis `python3 align-vo.py reel-15-cartes-de-la-journee
> <langue>` : les plans suivent la voix. **À qui il s'adresse.** Toi (ElevenLabs), un comédien.

## 1. Règles communes

| Point | Consigne |
|---|---|
| **Voix** | FR **Noé**, EN **Mark** (ElevenLabs v3, stabilité Natural). Arabe après relecture des traductions. |
| **Prononciation** | « Bètly » : FR « Bètli », EN « Betly ». Adresse : « bètli point F R » / « betly dot F R ». |
| **Ton** | Rythmé, léger : une journée qui défile sans stress ; les heures bien détachées. |
| **Vérité produit** | Cartes réelles : `DEPOSIT_RELEASE` (Libérer), `REVIEW_DRAFT_REPLY` (Répondre), `WORK_REVIEW`, `LATE_CHECKOUT_APPROVAL` (Accepter), `OWNER_STATEMENT_SEND` (Envoyer), `NOISE_WARNING_SEND` (Envoyer). Thermostat : lu et réglé À DISTANCE par l'hôte, aucun préchauffage automatique, humidité seulement mesurée. Automatisation : niveaux « Suggérer / Agir puis notifier / Auto » par type (`SupervisionAutomatableTypes`) ; règle de confiance qui PROPOSE d'automatiser un type toujours validé ; ménage jusqu'à Auto, caution au plus « Agir puis notifier », remboursements / retenues / litiges jamais automatiques. |

## 2. Plans (ils suivent la voix)

| Réplique | Ce qu'on voit |
|---|---|
| b1 | Une pile de cartes, l'horloge de la journée |
| b2 | 07:30 carte caution « Libérer » ; 09:00 carte avis « Répondre » |
| b3 | 12:00 contrôle du ménage « Valider » ; 14:00 départ tardif « Accepter » |
| b4 | 16:00 thermostat réglé de 17 à 21 °C à distance ; 19:00 relevé « Envoyer » |
| b5 | 23:40 avertissement de bruit « Envoyer » ; la pile est vide |
| b6 | Règle de confiance « Vous avez validé les 12 dernières libérations de caution », clic « Activer » ; réglages d'automatisation : ménage → Auto, caution → Agir puis notifier, remboursements verrouillés « Toujours validé par vous » |
| b7 | Promesse : « Vous décidez. Baitly s'occupe du reste. » |
| b8 | Logo, bouton, adresse |

## 3. Français

Voix française : **Noé** (`7pDdnNI6PhXmAp0pXFZm`).

| # | Texte | Durée visée | Intonation |
|---|---|---|---|
| b1 | Une journée d'hôte avec Bètli ? Des cartes. Une à la fois, avec tout le contexte. | 3,6 s | Curieux puis posé. |
| b2 | Sept heures et demie : la caution de Sara est libérée. Neuf heures : la réponse à un avis est prête. | 4,6 s | Rythmé, heures détachées. |
| b3 | Midi : le ménage est contrôlé, photos à l'appui. Quatorze heures : un départ tardif, accordé en un clic. | 4,8 s | Même rythme. |
| b4 | Seize heures : entre deux séjours, vous réglez le thermostat à distance. Dix-neuf heures : le relevé part chez le propriétaire. | 5,7 s | Même rythme. |
| b5 | Et à vingt-trois heures quarante, s'il le faut, un avertissement de bruit. … Et entre deux cartes, vous vivez. | 4,8 s | Feutré, puis souriant. |
| b6 | Et ce que vous validez à chaque fois, Bètli vous propose de l'automatiser. Le ménage en automatique, la caution avec une simple notification… et les remboursements, toujours validés par vous. À vous de régler le curseur. | 9,3 s | Posé, pédagogique ; « toujours validés par vous » appuyé. |
| b7 | Vous décidez. … Bètli s'occupe du reste. | 2,2 s | Signature. |
| b8 | Bètli. Rejoignez le pré-lancement dès aujourd'hui, sur bètli point F R. | 3,3 s | Invitation chaleureuse. |

## 4. English

English voice: **Mark** (`WTUK291rZZ9CLPCiFTfh`).

| # | Text | Target | Delivery |
|---|---|---|---|
| b1 | A host's day with Betly? Cards. One at a time, with all the context. | 4,4 s | Curious, then settled. |
| b2 | Seven thirty: Sara's deposit is released. Nine a.m.: a review reply is ready. | 5,0 s | Rhythmic, times detached. |
| b3 | Noon: the cleaning is checked, photos included. Two p.m.: a late checkout, granted in one click. | 6,0 s | Same rhythm. |
| b4 | Four p.m.: between two stays, you set the thermostat remotely. Seven p.m.: the statement goes to the owner. | 6,6 s | Same rhythm. |
| b5 | And at eleven forty p.m., if needed, a noise warning. … And between two cards, you live. | 5,6 s | Hushed, then smiling. |
| b6 | And whatever you always approve, Betly offers to automate. Cleaning on autopilot, deposits with a simple notification… and refunds, always approved by you. You set the dial. | 10,2 s | Calm, explanatory; stress "always approved by you". |
| b7 | You decide. … Betly handles the rest. | 2,4 s | Signature line. |
| b8 | Betly. Join the pre-launch today, at betly dot F R. | 3,2 s | Warm invitation. |
