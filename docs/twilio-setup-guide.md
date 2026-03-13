# Guide de configuration Twilio — Clenzy PMS

> **Objectif** : Configurer Twilio pour permettre l'envoi de SMS et WhatsApp aux guests depuis la plateforme Clenzy.
>
> **Destinataire** : Responsable administratif / operations
>
> **Temps estime** : 30 min de configuration + 24-48h d'attente pour validation reglementaire

---

## Prerequis

- Un compte Twilio actif (https://console.twilio.com)
- Un Kbis ou extrait d'immatriculation de la societe (PDF)
- L'adresse officielle de la societe
- Une carte bancaire pour l'achat de numeros (~1-2 EUR/mois par numero)

---

## Etat actuel de la configuration

| Variable | Valeur | Statut |
|----------|--------|--------|
| `TWILIO_ACCOUNT_SID` | `ACc3ca946581904081ce5e37710f19e41d` | OK |
| `TWILIO_AUTH_TOKEN` | `fcb76c91411989c28ce37a349e0fa78b` | OK |
| `TWILIO_MESSAGING_SERVICE_SID` | — | A configurer (Etape 2) |
| `TWILIO_WHATSAPP_FROM` | — | Optionnel (Etape 4) |
| `TWILIO_VERIFY_SID` | — | Optionnel (Etape 5) |

---

## Etape 1 — Creer un Regulatory Bundle (obligatoire pour numero francais)

Les numeros francais (+33) necessitent une validation reglementaire ARCEP.

1. Aller sur : **Twilio Console** → **Phone Numbers** → **Regulatory Compliance** → **Bundles**
   - URL directe : https://console.twilio.com/us1/develop/phone-numbers/regulatory-compliance/bundles
2. Cliquer **"Create a Bundle"**
3. Remplir :
   - **Country** : France
   - **Number Type** : National
   - **Business Type** : Business
4. Remplir les informations de l'entreprise :
   - **Business Name** : [Nom de la societe, ex: Sinatech]
   - **Business Registration Number** : [Numero SIREN ou SIRET]
   - **Address** : [Adresse complete du siege social]
5. **Uploader le document** :
   - Type : Business Registration Document
   - Fichier : **Kbis de moins de 3 mois** (PDF)
6. Soumettre le bundle

> **Delai** : La validation prend generalement **24 a 48 heures**.
> Vous recevrez un email de Twilio quand le bundle est approuve ("Approved").
> Ne passez a l'etape 2 qu'apres approbation.

---

## Etape 2 — Acheter un numero de telephone et creer le Messaging Service

### 2.1 — Acheter un numero francais

1. Aller sur : **Phone Numbers** → **Manage** → **Buy a Number**
   - URL directe : https://console.twilio.com/us1/develop/phone-numbers/manage/search
2. Rechercher :
   - **Country** : France (+33)
   - **Capabilities** : cocher **SMS**
3. Choisir un numero et cliquer **"Buy"**
4. **Assigner le Regulatory Bundle** cree a l'etape 1 (il sera dans le dropdown "Assign approved Bundle")
5. Confirmer l'achat (~1.15 EUR/mois)

> **Note** : Le numero achete sera utilise pour envoyer les SMS aux guests.
> Notez ce numero, il sera lie au Messaging Service.

### 2.2 — Creer un Messaging Service

1. Aller sur : **Messaging** → **Services**
   - URL directe : https://console.twilio.com/us1/develop/sms/services
2. Cliquer **"Create Messaging Service"**
3. **Step 1 — Create Messaging Service** :
   - **Friendly Name** : `Clenzy PMS`
   - **Use case** : "Notify my users" (ou "Mixed" si vous prevoyez aussi du marketing)
   - Cliquer **"Create Messaging Service"**
4. **Step 2 — Add Senders** :
   - Cliquer **"Add Senders"**
   - **Sender Type** : Phone Number
   - Selectionner le numero achete a l'etape 2.1
   - Confirmer
   - Cliquer **"Step 3: Set up integration"**
5. **Step 3 — Set up integration** :
   - Laisser les options par defaut ("Drop the message")
   - Cliquer **"Step 4: Add compliance info"**
6. **Step 4 — Add compliance info** :
   - Remplir les informations de conformite demandees
   - Cliquer **"Complete Messaging Service Setup"**

7. **Recuperer le SID** :
   - Retourner sur la page du service : **Messaging** → **Services** → **Clenzy PMS**
   - Le **Messaging Service SID** est affiche en haut (commence par `MG...`)

> **Valeur a transmettre au developpeur** :
> ```
> TWILIO_MESSAGING_SERVICE_SID=MG...............................
> ```

---

## Etape 3 — Configurer les webhooks (a faire par le developpeur)

> Cette etape sera realisee par l'equipe technique.
> Rien a faire de votre cote.

Les URLs de webhook a configurer dans le Messaging Service :
- **Status Callback URL** : `https://app.clenzy.fr/api/webhooks/twilio/status`
- **Inbound Message URL** : `https://app.clenzy.fr/api/webhooks/twilio/inbound`

---

## Etape 4 — WhatsApp Business (optionnel)

Pour envoyer des messages WhatsApp aux guests.

### 4.1 — Mode Sandbox (test immediat)

1. Aller sur : **Messaging** → **Try it out** → **Send a WhatsApp message**
   - URL directe : https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
2. Suivre les instructions pour connecter votre telephone au sandbox
3. Le numero sandbox est temporaire et uniquement pour les tests

> **Valeur de test** :
> ```
> TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
> ```

### 4.2 — Mode Production (numero WhatsApp dedie)

1. Aller sur : **Messaging** → **Senders** → **WhatsApp senders**
2. Cliquer **"Add new sender"**
3. Vous devrez :
   - Avoir un compte **Meta Business Manager** verifie
   - Associer un numero de telephone a WhatsApp Business API
   - Faire approuver des **message templates** par Meta (necessaire pour les messages proactifs)
4. Une fois configure, noter le numero WhatsApp

> **Valeur a transmettre au developpeur** :
> ```
> TWILIO_WHATSAPP_FROM=whatsapp:+33XXXXXXXXX
> ```

> **Delai** : La verification Meta Business peut prendre **plusieurs jours a semaines**.
> Le mode Sandbox permet de tester en attendant.

---

## Etape 5 — Verify Service (optionnel)

Pour la verification OTP (code par SMS) des guests.

1. Aller sur : **Verify** → **Services**
   - URL directe : https://console.twilio.com/us1/develop/verify/services
2. Cliquer **"Create new"**
3. Remplir :
   - **Friendly Name** : `Clenzy Verification`
   - **Verification Channels** : cocher **SMS** (et optionnellement **WhatsApp**, **Email**)
4. Cliquer **"Create"**
5. Le **Verify Service SID** est affiche (commence par `VA...`)

> **Valeur a transmettre au developpeur** :
> ```
> TWILIO_VERIFY_SID=VA...............................
> ```

---

## Resume — Valeurs a transmettre au developpeur

Une fois toutes les etapes completees, transmettre ces valeurs **de maniere securisee** (pas par email en clair, utiliser un gestionnaire de mots de passe partage ou un canal chiffre) :

```
TWILIO_ACCOUNT_SID=ACc3ca946581904081ce5e37710f19e41d       (deja configure)
TWILIO_AUTH_TOKEN=fcb76c91411989c28ce37a349e0fa78b           (deja configure)
TWILIO_MESSAGING_SERVICE_SID=MG...                           (Etape 2)
TWILIO_WHATSAPP_FROM=whatsapp:+33...                         (Etape 4, optionnel)
TWILIO_VERIFY_SID=VA...                                      (Etape 5, optionnel)
```

---

## Couts estimes

| Element | Cout |
|---------|------|
| Numero francais (+33) | ~1.15 EUR/mois |
| SMS sortant (France) | ~0.07 EUR/SMS |
| SMS sortant (Maroc) | ~0.05 EUR/SMS |
| SMS sortant (Arabie Saoudite) | ~0.04 EUR/SMS |
| WhatsApp (conversation initiee par l'entreprise) | ~0.05-0.08 EUR/message |
| WhatsApp (conversation initiee par le guest) | ~0.02 EUR/message |
| Verify OTP | ~0.05 EUR/verification |

> Les prix sont indicatifs et peuvent varier. Consultez https://www.twilio.com/pricing pour les tarifs a jour.

---

## Checklist de progression

- [ ] Etape 1 : Regulatory Bundle cree et approuve
- [ ] Etape 2.1 : Numero francais (+33) achete
- [ ] Etape 2.2 : Messaging Service cree → SID `MG...` transmis au dev
- [ ] Etape 3 : Webhooks configures (par le dev)
- [ ] Etape 4 : WhatsApp configure (optionnel) → numero transmis au dev
- [ ] Etape 5 : Verify Service cree (optionnel) → SID `VA...` transmis au dev
- [ ] Variables deployees en production (par le dev)
- [ ] Test d'envoi SMS valide

---

*Document cree le 13/03/2026 — Clenzy PMS v1.0*
