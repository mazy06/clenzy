# Guide de configuration IoT — Minut & Tuya OEM

## 1. Minut — Configuration

Minut utilise un **flux OAuth2 par utilisateur**. Il faut d'abord un compte developpeur Minut.

### Etape 1 : Creer un compte partenaire Minut

1. Aller sur **[api.minut.com](https://api.minut.com)** ou **[minut.com/partners](https://minut.com/partners)**
2. S'inscrire en tant que **developpeur/partenaire**
3. Creer une **application OAuth2** dans leur dashboard
4. Noter les identifiants :
   - **Client ID**
   - **Client Secret**
5. Configurer l'**URL de callback** :
   - Dev : `http://localhost:8084/api/minut/callback`
   - Prod : `https://ton-domaine.com/api/minut/callback`

### Etape 2 : Configurer le webhook (optionnel mais recommande)

1. Dans le dashboard Minut, configurer un **webhook endpoint** :
   - URL : `https://ton-domaine.com/api/webhooks/minut`
2. Minut fournira un **Webhook Secret** (pour la validation HMAC-SHA256)
3. Evenements a ecouter : `disturbance`, `device_offline`, `sound_level`

### Etape 3 : Variables d'environnement

Ajouter dans le fichier `.env` (ou `.env.dev`) cote infra :

```env
MINUT_CLIENT_ID=ton_client_id_ici
MINUT_CLIENT_SECRET=ton_client_secret_ici
MINUT_REDIRECT_URI=http://localhost:8084/api/minut/callback
MINUT_WEBHOOK_SECRET=ton_webhook_secret_ici
```

Lues par `application-dev.yml` :

```yaml
minut:
  api:
    base-url: https://api.minut.com/v8
  oauth:
    client-id: ${MINUT_CLIENT_ID:}
    client-secret: ${MINUT_CLIENT_SECRET:}
    redirect-uri: ${MINUT_REDIRECT_URI:http://localhost:8084/api/minut/callback}
    authorization-url: https://api.minut.com/v8/oauth/authorize
    token-url: https://api.minut.com/v8/oauth/token
    scopes: read,write
  webhook:
    secret: ${MINUT_WEBHOOK_SECRET:}
```

---

## 2. Tuya OEM — Configuration

Tuya utilise des **identifiants projet** (pas OAuth par utilisateur). Un seul couple access-id/secret pour tout le projet.

### Etape 1 : Creer un projet Tuya IoT Cloud

1. Aller sur **[iot.tuya.com](https://iot.tuya.com)**
2. Creer un compte et se connecter
3. Aller dans **Cloud > Development > Create Cloud Project**
4. Parametres du projet :
   - **Nom** : Clenzy (ou autre)
   - **Industry** : Smart Home
   - **Data Center** : **Central Europe** (region EU)
   - **Development Method** : Smart Home
5. Une fois cree, noter :
   - **Access ID** (= Client ID)
   - **Access Secret** (= Client Secret)

### Etape 2 : Activer les API necessaires

Dans le projet Tuya, aller dans **API Explorer** ou **Service API** et activer :

- **IoT Core** — controle des appareils
- **Smart Home Device Management** — gestion des devices
- **Device Status Notification** — data points en temps reel

### Etape 3 : Lier les appareils OEM

Pour les capteurs OEM Tuya (hardware "Clenzy") :

1. Enregistrer les appareils dans la **Tuya IoT Platform** sous le projet
2. Le **Data Point important** est le **DP 12** (`noise_value`) — valeur en dB avec scale 3 (diviser par 1000)
3. Chaque appareil a un **Device ID** unique dans Tuya

### Etape 4 : Variables d'environnement

```env
TUYA_ACCESS_ID=ton_access_id_ici
TUYA_ACCESS_SECRET=ton_access_secret_ici
TUYA_API_BASE_URL=https://openapi.tuyaeu.com
TUYA_REGION=eu
```

Lues par `application-dev.yml` :

```yaml
tuya:
  api:
    base-url: ${TUYA_API_BASE_URL:https://openapi.tuyaeu.com}
    region: ${TUYA_REGION:eu}
  auth:
    access-id: ${TUYA_ACCESS_ID:}
    access-secret: ${TUYA_ACCESS_SECRET:}
```

> **Note :** La base URL depend de la region. `openapi.tuyaeu.com` = Europe. Adapter l'URL si changement de data center.

| Region | Base URL |
|--------|----------|
| Europe | `https://openapi.tuyaeu.com` |
| Chine | `https://openapi.tuyacn.com` |
| USA Est | `https://openapi.tuyaus.com` |
| Inde | `https://openapi.tuyain.com` |

---

## 3. Securite — Jasypt (chiffrement des tokens)

Les tokens OAuth (Minut) et tokens API (Tuya) sont **chiffres en AES-256** dans la base de donnees via Jasypt.

```env
JASYPT_ENCRYPTOR_PASSWORD=une_cle_secrete_forte_ici
```

- En dev : valeur par defaut `dev-jasypt-secret-key`
- **En production : mettre une vraie cle forte**

---

## 4. Resume — Variables a configurer

| Variable | Source | Obligatoire |
|----------|--------|:-----------:|
| `MINUT_CLIENT_ID` | Dashboard partenaire Minut | Oui |
| `MINUT_CLIENT_SECRET` | Dashboard partenaire Minut | Oui |
| `MINUT_REDIRECT_URI` | URL de callback configuree | Oui |
| `MINUT_WEBHOOK_SECRET` | Dashboard Minut (webhooks) | Recommande |
| `TUYA_ACCESS_ID` | Projet Tuya IoT Cloud | Oui |
| `TUYA_ACCESS_SECRET` | Projet Tuya IoT Cloud | Oui |
| `TUYA_API_BASE_URL` | Auto (EU par defaut) | Non |
| `TUYA_REGION` | Auto (`eu` par defaut) | Non |
| `JASYPT_ENCRYPTOR_PASSWORD` | Cle de chiffrement tokens | Oui en prod |

---

## 5. Flux utilisateur une fois configure

### Minut
1. L'utilisateur clique "Connecter Minut" dans le dashboard
2. Redirection vers Minut pour autoriser l'acces
3. Callback vers Clenzy avec le code d'autorisation
4. Tokens stockes chiffres en base
5. Devices Minut synchronises automatiquement

### Tuya OEM (Clenzy Hardware)
1. Les capteurs sont deja lies au projet Tuya (enregistrement OEM)
2. L'utilisateur ajoute un device via le formulaire 4 etapes :
   - Selectionner la propriete
   - Selectionner la piece (optionnel)
   - Nommer l'appareil
   - Confirmer
3. Donnees recuperees via l'API Tuya (DP 12 = noise_value)
4. Affichage en temps reel dans le graphique du dashboard

---

## 6. Endpoints backend de reference

### Tuya
| Methode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/tuya/connect` | Connecter Tuya (test credentials + stockage token) |
| POST | `/api/tuya/disconnect` | Deconnecter Tuya |
| GET | `/api/tuya/status` | Statut de connexion |
| GET | `/api/tuya/devices/{deviceId}` | Info d'un device |
| GET | `/api/tuya/devices/{deviceId}/status` | Data points actuels |
| GET | `/api/tuya/devices/{deviceId}/logs` | Historique des data points |

### Noise Devices (unifie Minut + Tuya)
| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/noise-devices` | Lister tous les devices |
| POST | `/api/noise-devices` | Ajouter un device |
| DELETE | `/api/noise-devices/{id}` | Supprimer un device |
| GET | `/api/noise-devices/{id}/data` | Donnees bruit d'un device |
| GET | `/api/noise-devices/data` | Donnees bruit agrégées |
