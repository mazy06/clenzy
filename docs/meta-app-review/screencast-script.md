# Screencast Script — Meta App Review

> Vidéo screencast à fournir avec la soumission Meta App Review.
> **Durée cible** : 3-5 min. **Format** : MP4 1080p, audio fr ou en, sous-titres en.
>
> Cette vidéo prouve à Meta que le use case est légitime et que l'intégration utilise correctement chaque permission demandée.

---

## Scénario complet (5 scènes)

### Scène 1 — Intro Clenzy (30s)

**Visuel** :
- Plein écran landing https://clenzy.fr
- Zoom sur la section "Property Management System"

**Voiceover** :
> "Clenzy est un PMS pour les gestionnaires de location courte durée. Aujourd'hui, je vais montrer comment nos utilisateurs connectent leur WhatsApp Business à Clenzy en quelques clics, grâce à l'Embedded Signup Flow de Meta."

---

### Scène 2 — Login PMS + accès Settings (20s)

**Visuel** :
- https://app.clenzy.fr/login
- Login (email/password)
- Sidebar → Settings → onglet "Messagerie"
- Scroll vers la section "Provider WhatsApp"

**Voiceover** :
> "Dans Clenzy, l'host accède à ses paramètres de messagerie WhatsApp. Sans Embedded Signup, il devrait aller dans Meta Business Manager, créer un Business Account, ajouter un numéro, générer un token… 1 à 3 jours de travail."

---

### Scène 3 — Embedded Signup Flow (90s) — **CŒUR DE LA REVIEW**

**Visuel** :
- Section "Provider WhatsApp" affichée
- Card Meta Cloud API sélectionnée (default)
- Clic sur le bouton "Connecter avec Facebook"
- **Popup Meta s'ouvre** :
  - Login Facebook (utilisateur de test : `clenzy.demo@example.com`)
  - Sélection du Business Manager (ou création)
  - Sélection/ajout d'un phone number WhatsApp Business
  - Vérification SMS (l'utilisateur entre le code)
  - **Écran "Allow"** : montrer les permissions demandées par Clenzy
- Clic "Allow"
- **Retour à Clenzy** : loader "Connexion en cours..."
- Affichage du succès : "WhatsApp connecté ✓", numéro affiché, status "Connecté"

**Voiceover** :
> "L'host clique sur 'Connecter avec Facebook'. La popup Meta s'ouvre. Il se connecte avec son compte Facebook, choisit ou crée son Business Manager, ajoute son numéro WhatsApp Business. Meta lui demande de vérifier par SMS. Une fois validé, Meta lui montre les permissions que Clenzy demande : 'gérer ses WhatsApp Business Accounts' pour récupérer le WABA, 'envoyer des messages' pour les confirmations de réservation, et 'lire ses Business Accounts' pour le matching initial. L'host clique Allow. Tout est provisionné automatiquement : Clenzy a maintenant le WABA ID, le phone number ID, et le System User Token chiffrés en base. **Setup complet en moins de 5 minutes**."

---

### Scène 4 — Auto-submit des templates (60s)

**Visuel** :
- Après le succès Embedded Signup, l'écran descend vers la section "Templates"
- Affichage d'une liste de 5 templates : `booking_confirmation_v1`, `checkin_instructions_v1`, `arrival_code_v1`, `checkout_reminder_v1`, `review_request_v1`
- Chaque template a un statut : "En attente d'approbation Meta" (orange)
- Clic sur un template pour voir le contenu prévisualisé en FR + EN
- Switch sur l'écran Meta Business Manager > Message Templates
- Les 5 templates sont visibles, statut "Pending"

**Voiceover** :
> "Juste après la connexion, Clenzy soumet automatiquement ses 5 templates utility standards au WABA de l'host. L'host peut prévisualiser chaque template en français, anglais, arabe. Meta a maintenant les templates en queue d'approbation, généralement validés en moins de 24 heures. L'host n'a JAMAIS eu besoin de toucher au Business Manager."

---

### Scène 5 — Envoi d'un message réel + 2-way (60s)

**Visuel** :
- Une fois les templates approuvés (simulation : update manuel du status en DB pour la démo)
- Navigation Clenzy > Reservations > détail d'une réservation
- Bouton "Envoyer message WhatsApp"
- Sélection du template "checkin_instructions"
- Aperçu du message rempli avec les vraies données (nom du guest, adresse, code wifi)
- Clic "Envoyer"
- Téléphone (deuxième écran ou émulateur) : réception du WhatsApp côté guest
- Le guest répond "Merci, j'arrive vers 18h"
- Retour Clenzy > Inbox : la réponse s'affiche en temps réel via webhook
- L'host répond depuis l'inbox

**Voiceover** :
> "Pour la démo, le host envoie une instruction de check-in à un guest fictif. Le message arrive sur le téléphone du guest, qui peut répondre. La réponse arrive dans l'inbox Clenzy via les webhooks Meta. L'host répond depuis l'interface. C'est une conversation 2-way complète, naturelle, sans copier-coller, sans changer d'outil. Voilà comment Clenzy utilise les permissions whatsapp_business_management, whatsapp_business_messaging, et business_management pour créer une expérience host fluide tout en respectant les guidelines Meta."

---

## Matériel à préparer avant tournage

- [ ] Utilisateur de test Clenzy : `meta.review.demo@clenzy.fr` (créer un compte propriétaire avec 2-3 propriétés démo)
- [ ] Compte Facebook de test : `clenzy.demo@example.com` (pas un employé Meta, vrai compte FB)
- [ ] Numéro WhatsApp Business de test (carte SIM dédiée à la démo, idéalement +33 pro)
- [ ] Téléphone Android ou émulateur WhatsApp pour montrer le guest qui reçoit/répond
- [ ] Loom / OBS Studio configuré : 1080p, audio externe (micro USB pour clarté)
- [ ] Script imprimé / second écran pour suivre les scènes sans hésiter
- [ ] Pause entre chaque scène pour le montage final

## Édition

- Couper les temps morts (>2s sans action)
- Ajouter des annotations textuelles aux moments clés (ex: "← Permission whatsapp_business_messaging demandée ici")
- Sous-titres anglais obligatoires (Meta review = équipe internationale)
- Intro/outro logo Clenzy 3s chacun
- Export final : MP4 H.264, max 100 MB (limite upload Meta)

## Upload

Une fois la vidéo prête, l'uploader dans App Dashboard > App Review > Permissions and Features > [chaque permission] > "Add screencast".

Tu peux uploader le même screencast pour les 3 permissions, mais avec un commentaire textuel qui pointe le timecode de la scène pertinente :
- `whatsapp_business_management` : timecode `2:30-3:00` (scène 4, auto-submit templates) + `4:30-5:00` (scène 5, sending via API)
- `whatsapp_business_messaging` : timecode `4:00-5:00` (scène 5, envoi + réception)
- `business_management` : timecode `1:30-2:00` (scène 3, popup signup où on récupère les Business Accounts)
