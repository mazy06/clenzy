# Reel 08 « 23 h 40 » · Brief voix off (FR · EN)

> **À quoi sert ce fichier.** Textes, intonation et prononciation de la voix off du Reel 08 (tapage
> nocturne : capteur de bruit, avertissement WhatsApp, blocage du calendrier en cas de récidive).
> **Comment l'utiliser.** Générer toutes les répliques d'une seule prise (un paragraphe par
> réplique), déposer `vo/<langue>/_prise-complete-<voix>.mp3`, puis `python3 align-vo.py
> reel-08-23h40 <langue>` : les plans suivent la voix (aucun blanc entre les scènes).
> **À qui il s'adresse.** Toi (ElevenLabs), un comédien, un prestataire audio.

## 1. Règles communes

| Point | Consigne |
|---|---|
| **Voix** | FR **Lucie**, EN **Mark** (ElevenLabs v3, stabilité Natural). Arabe après relecture des traductions. |
| **Prononciation** | « Bètly » : FR « Bètli », EN « Betly ». Adresse : « bètli point F R » / « betly dot F R ». |
| **Ton** | Ouverture nocturne et complice (la peur que tout hôte connaît), puis calme et rassurant. Jamais moqueur envers le voyageur. |
| **Vérité produit** | Capteurs Minut et Tuya ; avertissement WhatsApp (repli email), 1 par séjour et par 24 h ; blocage du calendrier proposé par une carte, jamais automatique, refusé si des nuits sont déjà réservées. |

## 2. Plans (ils suivent la voix)

| Réplique | Ce qu'on voit |
|---|---|
| b1 | La nuit : le salon dans la pénombre, 23:40, la jauge de bruit monte et dépasse le seuil ; « Appel manqué · voisin » |
| b2 | La carte HITL de l'agent Opérations : jauge, message prêt, clic sur « Envoyer l'avertissement » |
| b3 | Le téléphone de la voyageuse : le message arrive, elle répond ; la jauge redescend, « Retour au calme » |
| b4 | Trois alertes en quinze jours, carte « Bloquer 7 jours », le planning se hachure |
| b5 | Promesse : « Vos voisins dorment. Vous aussi. » |
| b6 | Logo, bouton, adresse |

Synchronisations (mots déclencheurs dans `align-vo.py`) : la jauge dépasse le seuil sur « musique » ;
l'appel manqué sur « voisins » ; le clic « Envoyer » sur « prêt » ; la réponse sur « Deux minutes » ;
la jauge redescend sur « redescend » ; le clic « Bloquer » sur « main » ; le logo sur « Bètli ».

## 3. Français

Voix française : **Lucie** (`LFtQZWdaqmvamcTNGpwl`).

| # | Texte | Durée visée | Intonation |
|---|---|---|---|
| b1 | Samedi, vingt-trois heures quarante. Dans votre appartement, la musique monte… et les voisins aussi. | 5,9 s | Feutré, nocturne ; petit sourire sur « et les voisins aussi ». |
| b2 | Le capteur de bruit de Bètli le repère aussitôt. Une carte vous propose d'avertir le voyageur, avec un message déjà prêt. | 7,0 s | Posé, rassurant. |
| b3 | Le message part sur WhatsApp. … Deux minutes plus tard, le volume redescend, et la nuit reste calme. | 6,0 s | Détendu, soulagé. |
| b4 | Et si les soirées se répètent, Bètli vous propose de bloquer le calendrier quelques jours, le temps de reprendre la main. | 7,0 s | Ferme et calme. |
| b5 | Vos voisins dorment. … Vous aussi. | 2,8 s | Doux ; la seconde phrase avec le sourire. |
| b6 | Bètli. Rejoignez le pré-lancement dès aujourd'hui, sur bètli point F R. | 4,4 s | Invitation chaleureuse. |

## 4. English

English voice: **Mark** (`WTUK291rZZ9CLPCiFTfh`).

| # | Text | Target | Delivery |
|---|---|---|---|
| b1 | Saturday, eleven forty p.m. In your apartment, the music is getting louder… and so are the neighbours. | 6,2 s | Hushed, late-night; a smile on "and so are the neighbours". |
| b2 | Betly's noise sensor picks it up right away. A card suggests warning the guest, with a message ready to go. | 6,8 s | Calm, reassuring. |
| b3 | The message goes out on WhatsApp. … Two minutes later, the volume drops, and the night stays calm. | 6,2 s | Relaxed, relieved. |
| b4 | And if the parties keep coming back, Betly suggests blocking the calendar for a few days, so you can take back control. | 7,3 s | Firm and calm. |
| b5 | Your neighbours sleep. … And so do you. | 2,6 s | Soft; the second sentence smiling. |
| b6 | Betly. Join the pre-launch today, at betly dot F R. | 3,2 s | Warm invitation. |
