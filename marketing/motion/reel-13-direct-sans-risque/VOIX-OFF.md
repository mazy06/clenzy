# Reel 13 « Le direct, sans les risques » · Brief voix off (FR · EN)

> **À quoi sert ce fichier.** Textes, intonation et prononciation de la voix off du Reel 13 (risques
> de paiement du site direct : panier abandonné relancé, réservation suspecte bloquée, litige bancaire
> documenté). **Comment l'utiliser.** Une seule prise par langue (un paragraphe par réplique) dans
> `vo/<langue>/_prise-complete-<voix>.mp3`, puis `python3 align-vo.py reel-13-direct-sans-risque
> <langue>` : les plans suivent la voix. **À qui il s'adresse.** Toi (ElevenLabs), un comédien.

## 1. Règles communes

| Point | Consigne |
|---|---|
| **Voix** | FR **Noé**, EN **Mark** (ElevenLabs v3, stabilité Natural). Arabe après relecture des traductions. |
| **Prononciation** | « Bètly » : FR « Bètli », EN « Betly ». Adresse : « bètli point F R » / « betly dot F R ». |
| **Ton** | Confiant et protecteur : le direct rapporte plus, Baitly en retire les risques. |
| **Vérité produit** | Relance = `CART_RECOVERY_SEND` (1 h, 24 h, 72 h ; consentement vérifié). Score de fraude = signaux (tentatives répétées, email jetable, montant atypique, pays incohérent), carte `FRAUD_BLOCK` ; le score est désactivé par défaut, à activer avant diffusion. Litige = `CHARGEBACK_SUBMIT`, dossier assemblé depuis nos données et déposé à Stripe. |

## 2. Plans (ils suivent la voix)

| Réplique | Ce qu'on voit |
|---|---|
| b1 | Le site direct à l'étape Paiement ; le visiteur s'arrête, « Panier abandonné » |
| b2 | Carte de l'agent Communication : relance en trois temps, clic « Envoyer la relance » ; 24 h plus tard, « Réservation confirmée » |
| b3 | Carte de l'agent Finance : score de risque 82/100, signaux ; clic « Bloquer », dates libérées |
| b4 | Carte « Déposer les preuves du litige » : les pièces s'empilent, clic « Déposer le dossier » |
| b5 | Promesse : « Le direct. Sans les risques. » |
| b6 | Logo, bouton, adresse |

## 3. Français

Voix française : **Noé** (`7pDdnNI6PhXmAp0pXFZm`).

| # | Texte | Durée visée | Intonation |
|---|---|---|---|
| b1 | Votre site de réservation directe : zéro commission. Mais ce soir, un visiteur s'arrête juste avant de payer. | 5,0 s | Enjoué, puis une petite déception. |
| b2 | Une carte vous propose de le relancer : une heure après, puis le lendemain. Et la réservation revient, sans commission. | 5,3 s | Malin, satisfait sur la fin. |
| b3 | Une réservation paraît suspecte ? Le score de risque vous alerte, et vous la bloquez avant qu'elle ne vous coûte. | 5,2 s | Vigilant, protecteur. |
| b4 | Et si un paiement est contesté des semaines plus tard, le dossier de preuves est déjà prêt : séjour, fiche voyageur, livret. Vous le déposez en un clic. | 6,9 s | Rassurant, net. |
| b5 | Le direct. … Sans les risques. | 2,2 s | Signature. |
| b6 | Bètli. Rejoignez le pré-lancement dès aujourd'hui, sur bètli point F R. | 3,3 s | Invitation chaleureuse. |

## 4. English

English voice: **Mark** (`WTUK291rZZ9CLPCiFTfh`).

| # | Text | Target | Delivery |
|---|---|---|---|
| b1 | Your direct booking site: zero commission. But tonight, a visitor stops right before paying. | 5,8 s | Upbeat, then a small letdown. |
| b2 | A card suggests following up: an hour later, then the next day. And the booking comes back, commission-free. | 6,8 s | Clever, satisfied at the end. |
| b3 | A booking looks suspicious? The risk score flags it, and you block it before it costs you. | 5,7 s | Watchful, protective. |
| b4 | And if a payment is disputed weeks later, the evidence is already gathered: the stay, the guest record, the guide. You submit it in one click. | 8,8 s | Reassuring, crisp. |
| b5 | Direct bookings. … Without the risks. | 2,4 s | Signature line. |
| b6 | Betly. Join the pre-launch today, at betly dot F R. | 3,2 s | Warm invitation. |
