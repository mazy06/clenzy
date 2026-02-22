# Integration Nuisance Sonore — Minut API + Tuya Cloud

## Architecture des credentials

L'integration nuisance sonore fonctionne sur **deux niveaux de credentials** :

```
+---------------------------------------------------------------+
|           NIVEAU 1 : Credentials Plateforme Clenzy            |
|  (Variables d'environnement serveur — 1 seul jeu)             |
|                                                               |
|  MINUT_CLIENT_ID        = App OAuth Clenzy chez Minut         |
|  MINUT_CLIENT_SECRET    = Secret de l'app Clenzy              |
|  MINUT_WEBHOOK_SECRET   = Validation webhooks                 |
|  TUYA_ACCESS_ID         = Projet Tuya Cloud de Clenzy         |
|  TUYA_ACCESS_SECRET     = Secret du projet Tuya               |
+---------------------------------------------------------------+
                            |
                            | Utilise ces credentials pour
                            | authentifier l'app Clenzy
                            v
+---------------------------------------------------------------+
|        NIVEAU 2 : Connexion par utilisateur (en BDD)          |
|  (Chaque proprio/conciergerie connecte SON compte)            |
|                                                               |
|  Minut : OAuth2 -> token perso dans minut_connections         |
|  Tuya  : Devices OEM lies au projet -> tuya_connections       |
+---------------------------------------------------------------+
```

### Niveau 1 — Credentials Plateforme (variables d'environnement)

Ce sont les credentials de **l'application Clenzy** elle-meme. Elles sont uniques pour toute la plateforme, independantes des utilisateurs.

| Variable | Description | Ou l'obtenir |
|----------|-------------|--------------|
| `MINUT_CLIENT_ID` | Client ID de l'app OAuth Clenzy enregistree chez Minut | Compte dev Minut |
| `MINUT_CLIENT_SECRET` | Secret de l'app OAuth Clenzy | Compte dev Minut |
| `MINUT_REDIRECT_URI` | URL de callback OAuth | Configure dans l'app Minut |
| `MINUT_WEBHOOK_SECRET` | Secret HMAC pour valider les webhooks entrants | Compte dev Minut |
| `TUYA_ACCESS_ID` | Access ID du projet Tuya Cloud | Tuya IoT Platform |
| `TUYA_ACCESS_SECRET` | Access Secret du projet Tuya Cloud | Tuya IoT Platform |

### Niveau 2 — Connexion par utilisateur (en base de donnees)

Quand un proprietaire ou une conciergerie veut connecter ses capteurs, le flux est different selon le fournisseur :

**Minut (OAuth2) :**
1. L'utilisateur clique "Connecter Minut" dans le Dashboard
2. Clenzy le redirige vers Minut avec les credentials plateforme (client_id)
3. L'utilisateur se connecte avec **son propre compte Minut**
4. Minut renvoie un code d'autorisation
5. Clenzy echange ce code contre un token **specifique a cet utilisateur**
6. Le token est chiffre (AES-256) et stocke dans la table `minut_connections`

**Tuya (HMAC projet) :**
1. Les capteurs Clenzy Hardware sont des appareils Tuya OEM lies au projet Tuya de Clenzy
2. L'authentification utilise les credentials plateforme (access_id + secret)
3. L'utilisateur associe ses devices a ses proprietes dans l'interface Clenzy
4. La connexion est enregistree dans la table `tuya_connections`

---

## Configuration des comptes developpeur

### Minut — Creer un compte developpeur

1. Aller sur https://www.minut.com et creer un compte (ou utiliser un compte existant)
2. Contacter Minut pour obtenir un acces API (programme partenaire) : https://www.minut.com/partners
3. Une fois valide, acceder au portail developpeur Minut
4. Creer une nouvelle application OAuth2 :
   - **Nom** : Clenzy PMS
   - **Redirect URI** : `https://votre-domaine.com/api/minut/callback` (prod) ou `http://localhost:8084/api/minut/callback` (dev)
   - **Scopes** : `read,write`
5. Recuperer le `client_id` et `client_secret`
6. Configurer un webhook :
   - **URL** : `https://votre-domaine.com/api/webhooks/minut`
   - **Events** : `disturbance`, `device_offline`, `sound_level`
   - Recuperer le `webhook_secret`

### Tuya — Creer un projet IoT Platform

1. Aller sur https://iot.tuya.com et creer un compte developpeur
2. Creer un nouveau projet Cloud :
   - **Nom** : Clenzy Noise Monitoring
   - **Region** : Europe (EU) — `openapi.tuyaeu.com`
   - **Type** : Smart Home
3. Dans le projet, activer les API suivantes :
   - **IoT Core** (obligatoire)
   - **Device Status Notification** (pour les webhooks)
4. Recuperer l'`Access ID` et l'`Access Secret` dans les parametres du projet
5. Lier les produits OEM (capteurs de bruit) au projet :
   - Aller dans "Devices" > "Link Tuya App Account"
   - Ou utiliser l'API de pairing pour lier les devices

**Data Point cle :** Le capteur de bruit Tuya utilise le **DP 12** (`noise_value`) — valeur en dB avec scale 3 (diviser par 1000 pour obtenir les dB reels).

---

## Variables d'environnement

### Developpement (`application-dev.yml`)

Les variables sont deja configurees avec des placeholders. Ajouter dans votre `.env` ou vos variables systeme :

```bash
# Minut
export MINUT_CLIENT_ID="votre_client_id_minut"
export MINUT_CLIENT_SECRET="votre_client_secret_minut"
export MINUT_REDIRECT_URI="http://localhost:8084/api/minut/callback"
export MINUT_WEBHOOK_SECRET="votre_webhook_secret"

# Tuya
export TUYA_ACCESS_ID="votre_access_id_tuya"
export TUYA_ACCESS_SECRET="votre_access_secret_tuya"
```

### Production

Configurer les memes variables dans votre systeme de deploiement (Docker env, Kubernetes secrets, etc.).

**Important :** Le `MINUT_REDIRECT_URI` doit correspondre exactement a celui configure dans l'app Minut (HTTPS en production).

---

## Endpoints API

### Minut (`/api/minut/`)

| Methode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| GET | `/api/minut/connect` | JWT | Retourne l'URL OAuth Minut |
| GET | `/api/minut/callback` | Public | Callback OAuth (echange code/token) |
| POST | `/api/minut/disconnect` | JWT | Revoque la connexion Minut |
| GET | `/api/minut/status` | JWT | Statut de connexion |
| GET | `/api/minut/devices/{id}` | JWT | Details d'un device |
| GET | `/api/minut/homes/{id}` | JWT | Details d'un home |
| GET | `/api/minut/homes/{id}/events` | JWT | Evenements |
| GET | `/api/minut/homes/{id}/disturbance` | JWT | Config monitoring bruit |
| PUT | `/api/minut/homes/{id}/disturbance` | JWT | Maj config monitoring |

### Tuya (`/api/tuya/`)

| Methode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| POST | `/api/tuya/connect` | JWT | Configure la connexion Tuya |
| POST | `/api/tuya/disconnect` | JWT | Revoque la connexion |
| GET | `/api/tuya/status` | JWT | Statut de connexion |
| GET | `/api/tuya/devices/{id}` | JWT | Infos device |
| GET | `/api/tuya/devices/{id}/status` | JWT | Data points actuels (DP12 = bruit) |
| GET | `/api/tuya/devices/{id}/logs` | JWT | Historique data points |

### Capteurs unifies (`/api/noise-devices/`)

| Methode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| GET | `/api/noise-devices` | JWT | Liste des capteurs de l'utilisateur |
| POST | `/api/noise-devices` | JWT | Ajouter un capteur |
| DELETE | `/api/noise-devices/{id}` | JWT | Supprimer un capteur |
| GET | `/api/noise-devices/{id}/data` | JWT | Donnees bruit d'un capteur |
| GET | `/api/noise-devices/data` | JWT | Donnees agregees tous capteurs |

### Webhooks (`/api/webhooks/`)

| Methode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| POST | `/api/webhooks/minut` | HMAC-SHA256 | Reception evenements Minut |

---

## Tables en base de donnees

Migration : `V40__create_noise_monitoring_tables.sql`

### `minut_connections`
Stocke les tokens OAuth2 par utilisateur. Chaque utilisateur qui connecte son compte Minut a une entree ici.

### `tuya_connections`
Stocke les tokens d'acces Tuya par utilisateur.

### `noise_devices`
Table partagee pour tous les capteurs configures (Minut ou Tuya). Lie un device externe a une propriete Clenzy et optionnellement une piece.

---

## Schema du flux utilisateur

```
Utilisateur (Dashboard)
    |
    |-- Clique "Souscrire Minut"
    |       |
    |       +-- Voit les infos produit Minut
    |       +-- Clique "Configurer mon capteur"
    |       +-- Redirige vers Minut OAuth (se connecte avec SON compte)
    |       +-- Callback -> token stocke en BDD
    |       +-- Formulaire 4 etapes :
    |           1. Choix propriete
    |           2. Choix piece (optionnel)
    |           3. Nom du capteur
    |           4. Confirmation
    |       +-- Capteur cree en BDD
    |
    |-- Clique "Souscrire Clenzy Hardware"
    |       |
    |       +-- Voit les infos produit Tuya OEM
    |       +-- Lien d'achat externe
    |       +-- Clique "Configurer mon capteur"
    |       +-- Formulaire 4 etapes (meme flow)
    |       +-- Capteur cree en BDD
    |
    |-- Graphique temps reel
            +-- Affiche les courbes de bruit par capteur/piece
            +-- Donnees depuis Minut API ou Tuya API selon le type
```

---

## Securite

- **Tokens chiffres** : Tous les tokens OAuth sont chiffres en AES-256 (Jasypt) avant stockage en BDD
- **HMAC webhooks** : Les webhooks Minut sont valides via signature HMAC-SHA256
- **HMAC Tuya** : Chaque appel API Tuya est signe avec HMAC-SHA256 (client_id + token + timestamp + nonce)
- **Endpoints publics** : Seuls `/api/webhooks/minut` et `/api/minut/callback` sont accessibles sans JWT
- **Traitement async** : Les webhooks sont publies dans Kafka pour traitement asynchrone (reponse < 5s)
