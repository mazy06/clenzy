# Embedded Signup Flow — Doc technique Clenzy

> Référence dev interne. Architecture du flow Embedded Signup côté Clenzy.

---

## Architecture

```
┌─────────────────┐
│   Browser (host) │
│   app.clenzy.fr  │
└────────┬────────┘
         │
         │ 1. Charge SDK FB JS (connect.facebook.net/en_US/sdk.js)
         │
         │ 2. FB.init({appId, version})
         │
         │ 3. User clique "Connecter avec Facebook"
         │
         ▼
    FB.login(callback, {
      config_id: META_EMBEDDED_SIGNUP_CONFIG_ID,
      response_type: 'code',
      override_default_response_type: true,
      extras: { feature: 'whatsapp_embedded_signup' }
    })
         │
         │ Popup Meta ouvre
         │ - Login FB
         │ - Sélection/création Business Manager
         │ - Sélection/ajout phone number WhatsApp
         │ - Vérif SMS
         │ - Allow permissions
         │
         ▼
    callback(response) reçoit { authResponse: { code: 'AQB...xxx' } }
         │
         │ 4. POST /api/whatsapp/meta/oauth-callback { code }
         │
         ▼
┌────────────────────────┐
│  Spring Boot Backend    │
│  MetaSignupController   │
└────────┬───────────────┘
         │
         │ 5. POST graph.facebook.com/v18.0/oauth/access_token
         │    { client_id, client_secret, code, redirect_uri }
         │    -> { access_token, token_type, expires_in }
         │
         │ 6. GET /me/businesses?access_token={token}
         │    -> [{ id, name, ... }]
         │
         │ 7. GET /{business_id}/owned_whatsapp_business_accounts
         │    -> [{ id (=waba_id), name, ... }]
         │
         │ 8. GET /{waba_id}/phone_numbers
         │    -> [{ id (=phone_number_id), display_phone_number, ... }]
         │
         │ 9. UPSERT whatsapp_configs SET
         │      provider='META',
         │      api_token=encrypted(access_token),
         │      business_account_id=waba_id,
         │      phone_number_id=phone_id,
         │      enabled=true
         │
         │ 10. (async) POST /{waba_id}/message_templates
         │     for each Clenzy standard template
         │
         ▼
    Return { success: true, phoneNumber: '+33...', wabaId: '...' }
         │
         │
         ▼
┌─────────────────┐
│   Browser (host) │
│   Affiche succès │
└─────────────────┘
```

---

## Endpoints backend

### `GET /api/whatsapp/meta/app-config`

Retourne au frontend la config publique nécessaire pour init le SDK FB.

**Auth** : `isAuthenticated()`
**Body req** : aucun
**Body resp** :
```json
{
  "appId": "123456789012345",
  "configId": "xxxxxxxxxxxxxxx",
  "graphApiVersion": "v18.0"
}
```

Pourquoi exposer ces 3 valeurs : c'est public et obligatoire dans le SDK FB. Le secret (`META_APP_SECRET`) reste backend.

### `POST /api/whatsapp/meta/oauth-callback`

Reçoit le code court-vie du SDK FB, exchange contre token long-vie, provisionne whatsapp_configs.

**Auth** : `isAuthenticated()`
**Body req** :
```json
{
  "code": "AQB...xxxxx"
}
```
**Body resp** :
```json
{
  "success": true,
  "phoneNumber": "+33612345678",
  "wabaId": "987654321098765",
  "phoneNumberId": "111222333444555",
  "templatesSubmitted": 5
}
```

Transactionnel : si une étape échoue (Meta API down, WABA introuvable), rollback complet — la config reste dans l'état précédent.

---

## Properties Spring

```yaml
clenzy:
  whatsapp:
    meta:
      # App ID public (visible côté frontend)
      app-id: ${META_APP_ID:}
      # App Secret (server-only, ne JAMAIS exposer au frontend)
      app-secret: ${META_APP_SECRET:}
      # Embedded Signup Configuration ID (public)
      embedded-signup-config-id: ${META_EMBEDDED_SIGNUP_CONFIG_ID:}
      # Version Graph API utilisée (à bumper périodiquement)
      graph-api-version: v18.0
      # URL OAuth (constante Meta, paramétrable si besoin pour tests)
      oauth-token-url: https://graph.facebook.com/v18.0/oauth/access_token
      # URL Graph API base
      graph-api-base: https://graph.facebook.com/v18.0
```

---

## Sécurité

1. **App Secret server-only** : jamais inclus dans une réponse API, jamais loggué.
2. **Token chiffré au stockage** : `EncryptedFieldConverter` (Jasypt AES-256-GCM) sur `whatsapp_configs.api_token`.
3. **CSRF state** : pour l'OAuth callback, on génère un `state` UUID stocké en Redis 10 min, validé au callback. Empêche les attaques CSRF sur le flow OAuth.
4. **Validation WABA ownership** : vérifie via `/me/businesses` que le WABA appartient bien à l'utilisateur connecté avant de l'associer à l'org Clenzy.
5. **Rate limiting** : 10 tentatives de signup par heure par user (anti-bruteforce).

---

## Tests à prévoir

- `MetaSignupControllerTest` : mock Meta API responses, vérifier le flow complet code→config persistée
- `MetaSignupControllerSecurityTest` : 401 si non authentifié, 403 si state CSRF invalide, 400 si code expiré
- `MetaSignupServiceTest` : mock chaque étape (token exchange, list businesses, list phones), vérifier rollback en cas d'erreur
- `WhatsAppConfigOAuthFlowIT` : intégration end-to-end avec un mock server Meta (WireMock)

---

## Plan de rollback

Si l'Embedded Signup échoue ou si Meta révoque les permissions :

1. **Côté frontend** : afficher fallback "Configuration manuelle" qui ouvre le form Meta classique (apiToken/phoneNumberId/businessAccountId)
2. **Côté backend** : `MetaSignupController` reste actif mais retourne 503 si Meta API indispo
3. **Côté DB** : aucune migration destructive — les colonnes existantes (api_token, etc.) restent compatibles avec le flow manuel
4. **Côté provider strategy** : OpenWA reste un fallback complet (cf. ADR 0001)

---

## Maintenance long-terme

- **Bump Graph API version** : Meta sunset les anciennes versions après ~2 ans. Surveiller le [changelog Graph API](https://developers.facebook.com/docs/graph-api/changelog/) et bumper `clenzy.whatsapp.meta.graph-api-version` quand nécessaire.
- **Rotation App Secret** : possible depuis App Dashboard. À faire si suspicion de leak. Le secret n'est utilisé que pour les calls server-server donc une rotation est transparente pour les hosts.
- **Re-permission** : Meta peut demander un re-review tous les ans. Surveiller les notifications dans App Dashboard.
