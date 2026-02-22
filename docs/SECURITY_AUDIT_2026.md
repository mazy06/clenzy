# Audit de Securite Complet — Clenzy PMS

**Date :** 20 fevrier 2026
**Auditeur :** Claude Opus 4.6 — Expert Securite Applicative SaaS Multi-Tenant
**Perimetre :** Backend Spring Boot (Java 21, Keycloak, PostgreSQL, Redis, Kafka)
**Version auditee :** commit `107380c9` sur `main`

---

## Score Global : 5.5 / 10

| Categorie | Score | Poids |
|-----------|-------|-------|
| Authentification & Sessions | 6/10 | 15% |
| Autorisation & Multi-Tenant | 5/10 | 20% |
| Validation d'entrees & Injections | 8/10 | 15% |
| Securite API | 6/10 | 10% |
| Protection des donnees | 5/10 | 15% |
| Vulnerabilites Web (XSS, CSRF, CORS) | 7/10 | 5% |
| Dependances & Infrastructure | 5/10 | 10% |
| Logique Metier PMS | 4/10 | 10% |

---

## Top 10 Risques

| # | Risque | Severite | Fichier | Impact |
|---|--------|----------|---------|--------|
| 1 | SSRF via iCal Import — URL non validee | CRITIQUE | `ICalImportService.java:299` | Exfiltration credentials cloud |
| 2 | Cross-Tenant InterventionService — ADMIN bypass org | CRITIQUE | `InterventionService.java:834` | Lecture/modif donnees concurrents |
| 3 | PricingConfigService sans autorisation | CRITIQUE | `PricingConfigService.java:87` | Manipulation financiere |
| 4 | Cle Jasypt hardcodee (fallback faible) | CRITIQUE | `TokenEncryptionService.java:23` | Tous tokens OAuth dechiffrables |
| 5 | Credentials par defaut dans config | CRITIQUE | `application-dev.yml:6,92,175` | Acces DB/Keycloak si env vars absentes |
| 6 | Webhook Airbnb signature optionnelle | HAUTE | `AirbnbWebhookService.java:57` | Injection fausses reservations |
| 7 | Token blacklist en memoire non distribuee | HAUTE | `JwtTokenService.java:30` | Tokens revoques restent valides |
| 8 | Rate limit bypassable X-Forwarded-For | HAUTE | `RateLimitInterceptor.java:95` | Brute force 1800 tentatives/h |
| 9 | Aucun @PreAuthorize sur controleurs | HAUTE | `UserController.java:30` | Endpoints critiques sans controle role |
| 10 | Email header injection | MOYENNE | `EmailService.java:120` | Spam relaying via injection BCC |

---

## Partie 1 — Rapport d'Audit Detaille

### 1. Authentification & Sessions

#### VULN-001 : Credentials par defaut dans application-dev.yml [CRITIQUE]

**Description :** Plusieurs secrets ont des valeurs par defaut en fallback dans la configuration YAML. Si les variables d'environnement ne sont pas definies, ces valeurs faibles sont utilisees.

**Localisation :**
- `server/src/main/resources/application-dev.yml:6` — `password: ${SPRING_DATASOURCE_PASSWORD:clenzy123}`
- `server/src/main/resources/application-dev.yml:92` — `password: ${KEYCLOAK_ADMIN_PASSWORD:admin}`
- `server/src/main/resources/application-dev.yml:175` — `password: ${JASYPT_ENCRYPTOR_PASSWORD:dev-jasypt-secret-key}`
- `server/src/main/resources/application-dev.yml:178-180` — Cles Stripe test en fallback

**Scenario d'attaque :**
1. Attaquant obtient acces au code source (repo public, fuite, ex-employe)
2. Tente les credentials par defaut sur l'environnement cible
3. Si env vars non definies → acces total a la DB, Keycloak admin, dechiffrement tokens

**Severite :** CRITIQUE
**Impact :** Compromission totale du systeme
**CVSS :** 9.8

**Preuve :**
```yaml
# application-dev.yml ligne 6
password: ${SPRING_DATASOURCE_PASSWORD:clenzy123}
# application-dev.yml ligne 92
password: ${KEYCLOAK_ADMIN_PASSWORD:admin}
```

---

#### VULN-002 : Token blacklist en memoire non distribuee [HAUTE]

**Description :** La blacklist des tokens JWT revoques est stockee dans un `ConcurrentHashMap` en memoire. En architecture multi-instances, un token revoque sur une instance reste valide sur les autres. La blacklist est perdue au redemarrage.

**Localisation :** `server/src/main/java/com/clenzy/service/JwtTokenService.java:30`

**Scenario d'attaque :**
1. Utilisateur se deconnecte (token ajoute a la blacklist instance A)
2. Attaquant utilise le token vole sur l'instance B
3. Token accepte car non present dans la blacklist de B

**Severite :** HAUTE
**Impact :** Sessions non revocables en cluster
**CVSS :** 7.5

---

#### VULN-003 : Rate limit auth trop permissif et spoofable [HAUTE]

**Description :** Le rate limiting sur `/api/auth/**` est de 30 req/min par IP. L'IP est extraite du header `X-Forwarded-For` qui peut etre forge par l'attaquant.

**Localisation :**
- `server/src/main/java/com/clenzy/config/RateLimitInterceptor.java:37` — `AUTH_RATE_LIMIT = 30`
- `server/src/main/java/com/clenzy/config/RateLimitInterceptor.java:95-98` — extraction IP via X-Forwarded-For

**Scenario d'attaque :**
1. Attaquant envoie des requetes avec headers `X-Forwarded-For` differents
2. Chaque "IP" a son propre compteur → bypass complet du rate limit
3. 1800+ tentatives de login par heure possibles

**Severite :** HAUTE
**Impact :** Brute force credentials possible
**CVSS :** 7.3

**Preuve :**
```java
// RateLimitInterceptor.java:95-98
String xForwardedFor = request.getHeader("X-Forwarded-For");
if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
    return xForwardedFor.split(",")[0].trim();
}
```

---

#### VULN-004 : Auto-provisioning utilisateur sans approbation [MOYENNE]

**Description :** Tout utilisateur authentifie via Keycloak est automatiquement cree dans le systeme avec le role HOST par defaut, sans approbation d'un administrateur.

**Localisation :** `server/src/main/java/com/clenzy/controller/AuthController.java:160-199`

**Scenario d'attaque :**
1. Si Keycloak est compromis ou mal configure (self-registration active)
2. Attaquant cree un compte Keycloak
3. Se connecte → auto-provisionne en HOST dans Clenzy
4. Acces immediat aux fonctionnalites

**Severite :** MOYENNE
**Impact :** Acces non autorise si Keycloak mal configure
**CVSS :** 5.3

---

### 2. Autorisation & Isolation Multi-Tenant

#### VULN-005 : Cross-tenant dans InterventionService [CRITIQUE]

**Description :** La methode `checkAccessRights()` autorise les utilisateurs ADMIN et MANAGER sans verifier que l'intervention appartient a leur organisation. Un MANAGER de l'Org A peut lire/modifier les interventions de l'Org B.

**Localisation :** `server/src/main/java/com/clenzy/service/InterventionService.java:834-837`

**Scenario d'attaque :**
1. MANAGER de l'Org A decouvre un ID d'intervention de l'Org B (enumeration sequentielle)
2. `GET /api/interventions/999` (intervention Org B)
3. `checkAccessRights()` → role = MANAGER → `return;` sans verifier orgId
4. Intervention d'une autre organisation exposee

**Severite :** CRITIQUE
**Impact :** Fuite de donnees entre organisations concurrentes
**CVSS :** 9.1

**Preuve :**
```java
// InterventionService.java:834-837
if (userRole == UserRole.ADMIN || userRole == UserRole.MANAGER) {
    return; // AUCUNE verification organizationId !
}
```

---

#### VULN-006 : PricingConfigService sans autorisation [CRITIQUE]

**Description :** Tout utilisateur authentifie (y compris HOUSEKEEPER, TECHNICIAN) peut modifier la configuration tarifaire via `PUT /api/pricing-config`. Aucune verification de role, aucune validation de bornes sur les valeurs.

**Localisation :** `server/src/main/java/com/clenzy/service/PricingConfigService.java:87-95`

**Scenario d'attaque :**
1. Utilisateur HOUSEKEEPER appelle `PUT /api/pricing-config`
2. Envoie `{"basePriceEssentiel": -50}` (prix negatif)
3. Service accepte → toutes les interventions facturees negativement
4. Pertes financieres pour l'organisation

**Severite :** CRITIQUE
**Impact :** Manipulation financiere, pertes monetaires
**CVSS :** 8.6

---

#### VULN-007 : Aucun @PreAuthorize sur controleurs critiques [HAUTE]

**Description :** Plusieurs controleurs n'ont pas d'annotations `@PreAuthorize` sur leurs methodes. La securite repose uniquement sur la configuration HTTP dans SecurityConfig. En cas d'ajout accidentel a `permitAll()`, l'endpoint est expose.

**Localisation :**
- `server/src/main/java/com/clenzy/controller/UserController.java:30-59` — 5 endpoints CRUD
- `server/src/main/java/com/clenzy/controller/TeamController.java:47-79` — 3 endpoints
- `server/src/main/java/com/clenzy/controller/ServiceRequestController.java:40-67` — 3 endpoints
- `server/src/main/java/com/clenzy/controller/ManagerController.java:82-100` — retourne donnees sans auth

**Severite :** HAUTE
**Impact :** Defense en profondeur absente
**CVSS :** 7.2

---

#### VULN-008 : Tenant bypass pour super-admin global [HAUTE]

**Description :** Les utilisateurs avec le role ADMIN voient les donnees de TOUTES les organisations car le Hibernate filter n'est pas active pour eux.

**Localisation :** `server/src/main/java/com/clenzy/tenant/TenantFilter.java:107-111`

**Scenario d'attaque :**
1. Compromission d'un compte ADMIN
2. Acces a toutes les donnees de toutes les organisations
3. Aucun cloisonnement meme en lecture

**Severite :** HAUTE
**Impact :** Fuite massive de donnees si compte admin compromis
**CVSS :** 8.1

---

### 3. Validation d'Entrees & Injections

#### VULN-009 : SSRF via import iCal [CRITIQUE]

**Description :** Le service d'import iCal accepte des URLs arbitraires sans validation. Un attaquant peut fournir des URLs pointant vers des ressources internes (localhost, metadata cloud AWS/GCP, reseau prive).

**Localisation :** `server/src/main/java/com/clenzy/service/ICalImportService.java:296-336`

**Scenario d'attaque :**
1. HOST ajoute un feed iCal avec URL `http://169.254.169.254/latest/meta-data/`
2. Le serveur fetch l'URL → recupere les credentials IAM AWS
3. Attaquant obtient acces a l'infrastructure cloud
4. Alternative : `http://localhost:8080/api/admin/users` → scan API interne

**Severite :** CRITIQUE
**Impact :** Exfiltration credentials cloud, scan reseau interne
**CVSS :** 9.3

**Preuve :**
```java
// ICalImportService.java:299
HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(url))  // Aucune validation d'URL !
        .GET()
        .build();
```

**Risques supplementaires :**
- Pas de limite de taille sur la reponse → DoS memoire
- Pas de limite sur le nombre d'evenements importes → flood DB
- Timeout de 30s insuffisant contre slow-read attacks

---

#### VULN-010 : Template injection dans DocumentGeneratorService [HAUTE]

**Description :** Les tags de template ne sont pas sanitises avant injection dans le moteur de rendu. Si un utilisateur peut uploader un template .odt avec des expressions malicieuses, il peut potentiellement executer du code arbitraire.

**Localisation :** `server/src/main/java/com/clenzy/service/DocumentGeneratorService.java:307-316`

**Severite :** HAUTE
**Impact :** Execution de code a distance (RCE)
**CVSS :** 8.1

---

#### VULN-011 : Email header injection [MOYENNE]

**Description :** Les champs `fullName` et `city` d'un formulaire de contact sont injectes directement dans le sujet d'email sans sanitisation. Un retour a la ligne permet d'injecter des headers BCC/CC.

**Localisation :** `server/src/main/java/com/clenzy/service/EmailService.java:120-142`

**Scenario d'attaque :**
```
fullName = "Test\nBcc: attacker@evil.com"
→ Header injection → spam relaying via le serveur SMTP
```

**Severite :** MOYENNE
**Impact :** Utilisation du serveur mail comme relai de spam
**CVSS :** 5.3

---

#### Points positifs :

- **Aucune injection SQL detectee** — 100% des requetes sont parametrees via JPQL `@Param`
- **Protection path traversal** — `AbstractFileStorageService.java:111-117` valide `.normalize()` + `.startsWith(baseDir)`
- **Validation DTOs** — Utilisation consistante de `@NotBlank`, `@Size`, `@Min`, `@Email`

---

### 4. Securite API

#### VULN-012 : Webhook Airbnb signature optionnelle [HAUTE]

**Description :** Si `config.getWebhookSecret()` est null ou vide, la validation de signature HMAC est entierement ignoree. Un attaquant peut injecter de fausses reservations.

**Localisation :** `server/src/main/java/com/clenzy/integration/airbnb/service/AirbnbWebhookService.java:57-65`

**Scenario d'attaque :**
1. Secret webhook non configure (env var manquante)
2. Attaquant envoie `POST /api/webhooks/airbnb` avec payload forge
3. Fausse reservation creee → intervention de menage auto-generee
4. Couts operationnels injustifies

**Severite :** HAUTE
**Impact :** Injection de donnees metier
**CVSS :** 7.5

---

#### VULN-013 : Webhooks sans rate limiting [HAUTE]

**Description :** Les endpoints webhook sont exclus du rate limiting.

**Localisation :** `server/src/main/java/com/clenzy/config/RateLimitConfig.java:32`
```java
.excludePathPatterns("/api/health", "/api/webhooks/**");
```

**Impact :** Vulnerable au DoS par flood de requetes webhook
**Severite :** HAUTE
**CVSS :** 6.5

---

#### VULN-014 : Actuator/Prometheus expose sans authentification [MOYENNE]

**Description :** Les endpoints `/actuator/prometheus` et `/actuator/metrics` sont publics en production. Ils exposent des informations systeme (version Java, pools connexions, OS).

**Localisation :** `server/src/main/java/com/clenzy/config/SecurityConfigProd.java:83-84`

**Severite :** MOYENNE
**Impact :** Fuite d'informations systeme
**CVSS :** 4.3

---

#### VULN-015 : Endpoints manager trop permissifs (dev) [MOYENNE]

**Description :** En configuration dev, de nombreux endpoints `/api/managers/**` sont dans `permitAll()` avec des patterns wildcard larges.

**Localisation :** `server/src/main/java/com/clenzy/config/SecurityConfig.java:59-93`

**Severite :** MOYENNE (dev seulement, prod differente)
**Impact :** Fonctions administratives accessibles sans auth en dev

---

### 5. Protection des Donnees & Cryptographie

#### VULN-016 : Cle Jasypt hardcodee avec fallback faible [CRITIQUE]

**Description :** Le service de chiffrement des tokens OAuth utilise Jasypt avec une cle derivee d'un mot de passe. Le mot de passe a un fallback hardcode dans le code source.

**Localisation :**
- `server/src/main/java/com/clenzy/service/TokenEncryptionService.java:23` — `default-dev-key`
- `server/src/main/java/com/clenzy/config/EncryptedFieldConverter.java:39` — meme probleme
- `server/src/main/java/com/clenzy/integration/airbnb/service/AirbnbTokenEncryptionService.java:24` — meme probleme

**Impact :** Si la variable d'env n'est pas definie, TOUS les tokens OAuth sont chiffres avec une cle connue publiquement.

**Severite :** CRITIQUE
**CVSS :** 9.1

---

#### VULN-017 : AES-CBC au lieu d'AES-GCM (pas d'authenticated encryption) [MOYENNE]

**Description :** Jasypt `AES256TextEncryptor` utilise AES en mode CBC. Ce mode ne fournit pas d'authentification — un attaquant peut modifier le ciphertext sans detection.

**Localisation :** `server/src/main/java/com/clenzy/service/TokenEncryptionService.java`

**Severite :** MOYENNE
**Impact :** Manipulation de tokens chiffres sans detection
**CVSS :** 5.9

---

#### VULN-018 : PII non chiffre en base (email, noms) [MOYENNE]

**Description :** Seul le `phone_number` est chiffre via `@Convert(EncryptedFieldConverter)`. Les emails, prenoms et noms sont stockes en clair dans PostgreSQL.

**Localisation :** `server/src/main/java/com/clenzy/model/User.java:41,46,51`

**Severite :** MOYENNE
**Impact :** Non-conformite GDPR Art. 32 (pseudonymisation/chiffrement recommandes)
**CVSS :** 4.7

---

#### VULN-019 : Pas de rotation des cles de chiffrement [MOYENNE]

**Description :** Aucun mecanisme de rotation des cles. Tous les tokens historiques sont chiffres avec la meme cle indefiniment.

**Localisation :** `server/src/main/java/com/clenzy/service/TokenEncryptionService.java`

**Severite :** MOYENNE
**Impact :** Compromission d'une cle expose tout l'historique
**CVSS :** 5.3

---

### 6. Vulnerabilites Web

#### VULN-020 : CSRF desactive globalement [BASSE]

**Description :** La protection CSRF est desactivee dans les deux profils (dev et prod).

**Localisation :**
- `SecurityConfig.java:43` — `.csrf(csrf -> csrf.disable())`
- `SecurityConfigProd.java:58` — `.csrf(csrf -> csrf.disable())`

**Justification :** Architecture JWT stateless sans cookies → risque CSRF mitige.

**Severite :** BASSE (mitige par design)
**Recommandation :** Documenter la justification dans le code.

---

#### VULN-021 : Absence de Content-Security-Policy [MOYENNE]

**Description :** Aucun header CSP configure. Les headers HSTS, X-Frame-Options, X-Content-Type-Options sont bien presents.

**Localisation :** `SecurityConfigProd.java:60-73`

**Severite :** MOYENNE
**Impact :** Protection XSS incomplete

---

#### Points positifs :
- **X-Frame-Options: DENY** en production
- **HSTS** avec preload active (1 an)
- **Referrer-Policy** strict
- **Permissions-Policy** restreint camera/micro/geo
- **CORS** configure par variable d'environnement en prod
- **Swagger desactive en production**

---

### 7. Dependances & Infrastructure

#### VULN-022 : Pas de plugin OWASP Dependency-Check [HAUTE]

**Description :** Le `pom.xml` ne contient aucun scanner de vulnerabilites automatise pour les dependances transitives.

**Localisation :** `server/pom.xml` — section plugins (lignes 289-327)

**Severite :** HAUTE
**Impact :** CVEs inconnues dans les dependances
**CVSS :** 6.5

---

#### VULN-023 : Redis sans authentification [HAUTE]

**Description :** La configuration Redis ne montre aucun mot de passe ni TLS.

**Localisation :** `server/src/main/resources/application-dev.yml:37-39`

**Severite :** HAUTE
**Impact :** Acces non authentifie au cache Redis → cache poisoning tenant
**CVSS :** 7.5

---

#### VULN-024 : Kafka sans authentification [MOYENNE]

**Description :** La configuration Kafka ne montre aucun SASL ni TLS.

**Localisation :** `server/src/main/resources/application-prod.yml:52-59`

**Severite :** MOYENNE
**Impact :** Interception/injection de messages Kafka
**CVSS :** 5.9

---

#### VULN-025 : Dockerfile sans hardening [MOYENNE]

**Description :** Le container tourne en root, pas de `HEALTHCHECK`, pas d'options JVM de securite.

**Localisation :** `server/Dockerfile`

**Severite :** MOYENNE
**Impact :** Surface d'attaque elargie si container compromis
**CVSS :** 5.3

---

### 8. Logique Metier PMS

#### VULN-026 : ReservationService.save() sans ownership check [HAUTE]

**Description :** La methode `save()` accepte un objet Reservation sans verifier que l'appelant est proprietaire de la reservation ou de la propriete associee.

**Localisation :** `server/src/main/java/com/clenzy/service/ReservationService.java:69-75`

**Severite :** HAUTE
**Impact :** IDOR — modification de reservations d'autres utilisateurs
**CVSS :** 7.5

---

#### VULN-027 : Pas de validation de machine a etats (Intervention, ServiceRequest) [MOYENNE]

**Description :** Les transitions de statut ne sont pas validees. Un utilisateur peut sauter de PENDING directement a COMPLETED sans passer par les etapes intermediaires.

**Localisation :**
- `InterventionService.java:288-325` — `updateStatus()` accepte tout statut
- `ServiceRequestService.java:242-390` — transitions non controlees

**Severite :** MOYENNE
**Impact :** Contournement du workflow de validation
**CVSS :** 5.3

---

#### VULN-028 : Debug System.out.println en production [BASSE]

**Description :** Des statements `System.out.println` avec des emojis debug sont presents dans le code de production.

**Localisation :** `ServiceRequestService.java:244-287`

**Severite :** BASSE
**Impact :** Fuite d'informations dans les logs, surcharge I/O

---

#### VULN-029 : Pas de limite d'evenements iCal importes [MOYENNE]

**Description :** Un feed iCal malicieux avec des millions d'evenements provoque autant d'insertions en base.

**Localisation :** `ICalImportService.java:223-237`

**Severite :** MOYENNE
**Impact :** DoS base de donnees
**CVSS :** 5.3

---

#### VULN-030 : UserDto expose le champ password [HAUTE]

**Description :** Le DTO `UserDto` inclut un champ `password` qui pourrait etre retourne dans les reponses API.

**Localisation :** `server/src/main/java/com/clenzy/dto/UserDto.java:30`

**Severite :** HAUTE
**Impact :** Exposition potentielle de credentials
**CVSS :** 7.1

---

## Points Positifs

1. **Zero injection SQL** — Requetes 100% parametrees JPQL
2. **Multi-tenant Hibernate @Filter** — Isolation automatique sur 31 entites
3. **Tokens OAuth chiffres** — AES-256 en base (Airbnb, Minut, Tuya)
4. **Security headers production** — HSTS preload, X-Frame-Options DENY, Permissions-Policy
5. **Protection path traversal** — Validation normalize + startsWith
6. **CORS restrictif en prod** — Origins par variable d'environnement
7. **Swagger desactive en prod** — API docs non exposees
8. **Default deny** — `anyRequest().denyAll()` en production
9. **Audit trail** — Login success/failure logges
10. **GDPR** — Export donnees + anonymisation implementes

---

## Cartographie de la Surface d'Attaque

```
                          INTERNET
                             |
                +------------+------------+
                |                         |
         Frontend SPA              Webhooks (public)
         (React/Vite)              /api/webhooks/*
                |                         |
            JWT Bearer            HMAC Signature
                |                         |
    +-----------+-----------+-------------+----------+
    |           Spring Security Filter Chain           |
    |  +--------+  +----------+  +-----------------+  |
    |  | CORS   |  | RateLimit|  | JWT Validation  |  |
    |  | Filter |  | Intercept|  | (Keycloak JWKS) |  |
    |  +--------+  +----------+  +-----------------+  |
    |  +---------------------------------------------+ |
    |  |     TenantFilter (orgId → Hibernate @Filter) | |
    |  +---------------------------------------------+ |
    +--------------------------------------------------+
                             |
    +--------------------------------------------------+
    |          Controllers (27 endpoints)                |
    |  [!] Manque @PreAuthorize sur 11+ endpoints       |
    +--------------------------------------------------+
                             |
    +--------------------------------------------------+
    |           Services (Business Logic)                |
    |  [!] checkAccessRights() bypass org pour ADMIN    |
    |  [!] PricingConfigService sans auth               |
    |  [!] ReservationService sans ownership check      |
    +-----+-------------------+------------------+-----+
          |                   |                  |
    +-----+------+   +-------+------+   +-------+------+
    | PostgreSQL  |   |    Redis     |   |    Kafka     |
    | (org_id RLS)|   | (no auth!)   |   | (no auth!)   |
    +-------------+   +--------------+   +--------------+
```

---

---

## Partie 2 — Plan d'Action de Remediation

Chaque vulnerabilite est listee avec les actions concretes, les fichiers a modifier, et le statut de verification.

### Legende des statuts

- [ ] A faire
- [~] En cours
- [x] Fait
- [T] Test automatise ajoute au CI/CD

---

### Phase P0 — Critique (Deployer sous 48h)

#### ACTION-001 : Corriger SSRF dans ICalImportService [VULN-009]

- [ ] **A.** Creer une methode `validateICalUrl(String url)` dans `ICalImportService.java`
  - Bloquer les schemas `file://`, `ftp://`, `gopher://`
  - Bloquer les hotes : `localhost`, `127.0.0.1`, `0.0.0.0`, `::1`, `169.254.169.254`
  - Bloquer les ranges prives : `10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`
  - Forcer HTTPS uniquement
- [ ] **B.** Ajouter une limite de taille sur la reponse HTTP (10 MB max)
- [ ] **C.** Limiter le nombre d'evenements importes a 5000 par feed
- [ ] **D.** Appeler `validateICalUrl()` dans `fetchAndParseICalFeed()` avant le fetch
- [ ] **E.** Appeler `validateICalUrl()` dans `previewICalFeed()` egalement

**Fichiers a modifier :**
- `server/src/main/java/com/clenzy/service/ICalImportService.java`

**Test CI/CD :**
- [ ] [T] Test unitaire : URL `http://169.254.169.254/...` → `SecurityException`
- [ ] [T] Test unitaire : URL `http://localhost:8080/api/...` → `SecurityException`
- [ ] [T] Test unitaire : URL `file:///etc/passwd` → `SecurityException`
- [ ] [T] Test unitaire : URL `http://10.0.0.1/...` → `SecurityException`
- [ ] [T] Test unitaire : URL `https://calendars.google.com/...` → OK

---

#### ACTION-002 : Corriger cross-tenant InterventionService [VULN-005]

- [ ] **A.** Dans `checkAccessRights()`, ajouter verification orgId AVANT le check de role :
  ```java
  if (!intervention.getOrganizationId().equals(tenantContext.getRequiredOrganizationId())) {
      throw new UnauthorizedException("Cross-tenant access denied");
  }
  ```
- [ ] **B.** Verifier que cette validation est presente dans toutes les methodes publiques du service

**Fichiers a modifier :**
- `server/src/main/java/com/clenzy/service/InterventionService.java`

**Test CI/CD :**
- [ ] [T] Test integration : MANAGER Org A tente `GET /api/interventions/{id_org_b}` → 403
- [ ] [T] Test integration : ADMIN Org A tente `PUT /api/interventions/{id_org_b}` → 403

---

#### ACTION-003 : Securiser PricingConfigService [VULN-006]

- [ ] **A.** Ajouter `@PreAuthorize("hasRole('ADMIN')")` sur le controller endpoint `PUT /api/pricing-config`
- [ ] **B.** Ajouter validation de bornes dans `applyFromDto()` :
  - Prix : [0.01, 9999.99]
  - Coefficients : [0.1, 10.0]
  - Rejeter les valeurs negatives ou zero
- [ ] **C.** Ajouter audit logging sur chaque modification de prix

**Fichiers a modifier :**
- `server/src/main/java/com/clenzy/controller/PricingConfigController.java` (ou equivalent)
- `server/src/main/java/com/clenzy/service/PricingConfigService.java`

**Test CI/CD :**
- [ ] [T] Test : HOUSEKEEPER tente `PUT /api/pricing-config` → 403
- [ ] [T] Test : ADMIN envoie prix negatif → 400 Bad Request
- [ ] [T] Test : ADMIN envoie coefficient = 0 → 400 Bad Request

---

#### ACTION-004 : Supprimer credentials par defaut [VULN-001]

- [ ] **A.** Retirer tous les fallbacks dans `application-dev.yml` :
  - Ligne 6 : `${SPRING_DATASOURCE_PASSWORD}` (sans fallback)
  - Ligne 92 : `${KEYCLOAK_ADMIN_PASSWORD}` (sans fallback)
  - Ligne 175 : `${JASYPT_ENCRYPTOR_PASSWORD}` (sans fallback)
- [ ] **B.** Creer un fichier `server/.env.example` avec la liste des variables requises
- [ ] **C.** Ajouter une validation au demarrage (`@PostConstruct`) dans un `EnvironmentValidator` qui verifie que les variables critiques sont definies
- [ ] **D.** Verifier que `.env` et `.env.local` sont dans `.gitignore`

**Fichiers a modifier :**
- `server/src/main/resources/application-dev.yml`
- `server/.env.example` (nouveau)
- `server/src/main/java/com/clenzy/config/EnvironmentValidator.java` (nouveau)

**Test CI/CD :**
- [ ] [T] Grep CI : verifier qu'aucun fichier YAML ne contient de passwords en fallback
- [ ] [T] Test demarrage : app refuse de demarrer si JASYPT_ENCRYPTOR_PASSWORD manquant

---

#### ACTION-005 : Supprimer fallback cle Jasypt [VULN-016]

- [ ] **A.** Retirer le fallback `default-dev-key` dans `TokenEncryptionService.java:23`
- [ ] **B.** Retirer le fallback dans `EncryptedFieldConverter.java:39`
- [ ] **C.** Retirer le fallback dans `AirbnbTokenEncryptionService.java:24`
- [ ] **D.** Faire echouer le demarrage si la cle n'est pas definie

**Fichiers a modifier :**
- `server/src/main/java/com/clenzy/service/TokenEncryptionService.java`
- `server/src/main/java/com/clenzy/config/EncryptedFieldConverter.java`
- `server/src/main/java/com/clenzy/integration/airbnb/service/AirbnbTokenEncryptionService.java`

**Test CI/CD :**
- [ ] [T] Grep CI : verifier qu'aucun `@Value` n'a de fallback pour les mots de passe/cles

---

#### ACTION-006 : Rendre signature webhook obligatoire [VULN-012]

- [ ] **A.** Dans `AirbnbWebhookService.processWebhook()`, rejeter si secret non configure :
  ```java
  if (config.getWebhookSecret() == null || config.getWebhookSecret().isEmpty()) {
      log.error("WEBHOOK SECRET NOT CONFIGURED — REJECTING ALL WEBHOOKS");
      return false;
  }
  ```
- [ ] **B.** Verifier que la comparaison de signature utilise un timing-safe compare (`MessageDigest.isEqual()`)

**Fichiers a modifier :**
- `server/src/main/java/com/clenzy/integration/airbnb/service/AirbnbWebhookService.java`

**Test CI/CD :**
- [ ] [T] Test : webhook sans signature + secret non configure → rejet 400
- [ ] [T] Test : webhook avec signature invalide → rejet 400
- [ ] [T] Test : webhook avec signature valide → accepte 200

---

### Phase P1 — Haute (Deployer sous 1 semaine)

#### ACTION-007 : Migrer token blacklist vers Redis [VULN-002]

- [ ] **A.** Remplacer `ConcurrentHashMap` par un Redis SET avec TTL
- [ ] **B.** TTL = duree de vie restante du token JWT
- [ ] **C.** Utiliser `RedisTemplate<String, String>` pour le stockage

**Fichiers a modifier :**
- `server/src/main/java/com/clenzy/service/JwtTokenService.java`

**Test CI/CD :**
- [ ] [T] Test integration avec Redis embarque : revocation effective entre requetes

---

#### ACTION-008 : Securiser rate limiting [VULN-003]

- [ ] **A.** Ne faire confiance a `X-Forwarded-For` que si le proxy est configure (ajouter une propriete `clenzy.security.trusted-proxies`)
- [ ] **B.** Reduire le rate limit auth a 10 req/min par IP
- [ ] **C.** Ajouter un verrouillage par compte apres 5 echecs consecutifs (lockout 15 min)
- [ ] **D.** Logger les tentatives de brute force detectees

**Fichiers a modifier :**
- `server/src/main/java/com/clenzy/config/RateLimitInterceptor.java`
- `server/src/main/resources/application.yml` (ajouter proprietes)

**Test CI/CD :**
- [ ] [T] Test : 11 requetes en 1 min → derniere rejetee 429
- [ ] [T] Test : X-Forwarded-For forge sans trusted-proxy → ignore, utilise remoteAddr

---

#### ACTION-009 : Ajouter @PreAuthorize sur tous les controleurs [VULN-007]

- [ ] **A.** `UserController` — CRUD : `@PreAuthorize("hasAnyRole('ADMIN','MANAGER')")`
- [ ] **B.** `TeamController` — CRUD : `@PreAuthorize("hasAnyRole('ADMIN','MANAGER')")`
- [ ] **C.** `ServiceRequestController` — lecture : `authenticated()`, ecriture : `hasAnyRole('ADMIN','MANAGER','HOST')`
- [ ] **D.** `ManagerController` — tous : `@PreAuthorize("hasAnyRole('ADMIN','MANAGER')")`
- [ ] **E.** Auditer TOUS les autres controleurs et ajouter les annotations manquantes

**Fichiers a modifier :**
- Tous les fichiers `*Controller.java`

**Test CI/CD :**
- [ ] [T] Test par controleur : appel sans role → 403
- [ ] [T] Test par controleur : appel avec mauvais role → 403
- [ ] [T] Test par controleur : appel avec bon role → 200

---

#### ACTION-010 : Corriger ReservationService ownership [VULN-026]

- [ ] **A.** Dans `save()`, verifier que l'utilisateur est proprietaire de la propriete liee ou ADMIN/MANAGER
- [ ] **B.** Dans `getByProperty()`, verifier ownership en plus de l'orgId

**Fichiers a modifier :**
- `server/src/main/java/com/clenzy/service/ReservationService.java`

**Test CI/CD :**
- [ ] [T] Test : HOST A tente de modifier reservation de HOST B → 403

---

#### ACTION-011 : Ajouter rate limiting sur webhooks [VULN-013]

- [ ] **A.** Ajouter un rate limit specifique pour `/api/webhooks/**` : 500 req/min
- [ ] **B.** Retirer l'exclusion dans `RateLimitConfig.java:32`

**Fichiers a modifier :**
- `server/src/main/java/com/clenzy/config/RateLimitConfig.java`
- `server/src/main/java/com/clenzy/config/RateLimitInterceptor.java`

---

#### ACTION-012 : Securiser Redis [VULN-023]

- [ ] **A.** Ajouter `spring.redis.password` dans `application-prod.yml`
- [ ] **B.** Configurer TLS Redis si disponible
- [ ] **C.** Ajouter Redis ACLs pour limiter les commandes

**Fichiers a modifier :**
- `server/src/main/resources/application-prod.yml`
- Configuration Redis (hors code Java)

---

#### ACTION-013 : Supprimer debug System.out.println [VULN-028]

- [ ] **A.** Rechercher et supprimer tous les `System.out.println` dans le code
- [ ] **B.** Les remplacer par des `log.debug()` si le message est utile

**Fichiers a modifier :**
- `server/src/main/java/com/clenzy/service/ServiceRequestService.java:244-287`
- Tout autre fichier contenant `System.out.println`

**Test CI/CD :**
- [ ] [T] Grep CI : `System.out.println` → 0 occurrences dans `src/main/java`

---

#### ACTION-014 : Proteger UserDto contre l'exposition de password [VULN-030]

- [ ] **A.** Ajouter `@JsonIgnore` sur le champ `password` dans `UserDto.java`
- [ ] **B.** Ou mieux : creer un `CreateUserDto` separe avec le password, et retirer le champ de `UserDto` (reponse)

**Fichiers a modifier :**
- `server/src/main/java/com/clenzy/dto/UserDto.java`

**Test CI/CD :**
- [ ] [T] Test : `GET /api/users/{id}` → reponse ne contient PAS de champ `password`

---

#### ACTION-015 : Ajouter OWASP Dependency-Check [VULN-022]

- [ ] **A.** Ajouter le plugin `owasp-dependency-check-maven` dans `pom.xml`
- [ ] **B.** Configurer le seuil CVSS : echec build si score >= 7.0
- [ ] **C.** Integrer dans le pipeline CI/CD

**Fichiers a modifier :**
- `server/pom.xml`
- `.github/workflows/ci-backend.yml` (ou equivalent)

**Test CI/CD :**
- [ ] [T] Le build CI execute dependency-check a chaque push

---

### Phase P2 — Moyenne (Deployer sous 1 mois)

#### ACTION-016 : Migrer AES-CBC vers AES-GCM [VULN-017]

- [ ] **A.** Evaluer le remplacement de Jasypt par une implementation AES-GCM native
- [ ] **B.** Implementer un `AesGcmTokenEncryptionService`
- [ ] **C.** Migrer les tokens existants (dechiffrer avec l'ancien, re-chiffrer avec le nouveau)
- [ ] **D.** Supporter les deux modes pendant la migration

**Fichiers a modifier :**
- `server/src/main/java/com/clenzy/service/TokenEncryptionService.java`
- Migration de donnees

---

#### ACTION-017 : Chiffrer PII supplementaire [VULN-018]

- [ ] **A.** Ajouter `@Convert(converter = EncryptedFieldConverter.class)` sur `email`, `firstName`, `lastName` dans `User.java`
- [ ] **B.** Migration Flyway pour re-chiffrer les donnees existantes
- [ ] **C.** Adapter les requetes qui filtrent par email (recherche, login)

**Fichiers a modifier :**
- `server/src/main/java/com/clenzy/model/User.java`
- Nouvelle migration Flyway

---

#### ACTION-018 : Ajouter Content-Security-Policy [VULN-021]

- [ ] **A.** Ajouter un header CSP dans `SecurityConfigProd.java`
- [ ] **B.** Commencer en mode report-only pour identifier les violations

**Fichiers a modifier :**
- `server/src/main/java/com/clenzy/config/SecurityConfigProd.java`

---

#### ACTION-019 : Securiser Kafka [VULN-024]

- [ ] **A.** Activer SASL/SCRAM ou mTLS pour l'authentification Kafka
- [ ] **B.** Configurer TLS pour le transport
- [ ] **C.** Configurer les ACLs Kafka par topic

**Fichiers a modifier :**
- `server/src/main/resources/application-prod.yml`
- Configuration Kafka (hors code Java)

---

#### ACTION-020 : Hardening Dockerfile [VULN-025]

- [ ] **A.** Ajouter un user non-root : `RUN addgroup -S clenzy && adduser -S clenzy -G clenzy`
- [ ] **B.** Ajouter `USER clenzy`
- [ ] **C.** Ajouter `HEALTHCHECK` instruction
- [ ] **D.** Ajouter options JVM de securite

**Fichiers a modifier :**
- `server/Dockerfile`

---

#### ACTION-021 : Valider machine a etats (Intervention, ServiceRequest) [VULN-027]

- [ ] **A.** Creer un enum `AllowedTransitions` ou une map de transitions valides
- [ ] **B.** Valider dans `updateStatus()` que la transition old → new est autorisee
- [ ] **C.** Rejeter les transitions invalides avec message explicite

**Fichiers a modifier :**
- `server/src/main/java/com/clenzy/service/InterventionService.java`
- `server/src/main/java/com/clenzy/service/ServiceRequestService.java`

**Test CI/CD :**
- [ ] [T] Test : PENDING → COMPLETED directement → 400
- [ ] [T] Test : PENDING → IN_PROGRESS → COMPLETED → OK

---

#### ACTION-022 : Sanitiser inputs email [VULN-011]

- [ ] **A.** Utiliser `MimeUtility.encodeWord()` pour les champs injectes dans les headers
- [ ] **B.** Valider l'absence de `\n`, `\r` dans fullName, city, subject

**Fichiers a modifier :**
- `server/src/main/java/com/clenzy/service/EmailService.java`

**Test CI/CD :**
- [ ] [T] Test : fullName contenant `\n` → rejete ou sanitise

---

#### ACTION-023 : Prevenir template injection [VULN-010]

- [ ] **A.** Configurer le moteur de template avec un safe resolver (si Freemarker)
- [ ] **B.** Sanitiser les valeurs de contexte avant injection
- [ ] **C.** Limiter les types de templates uploadables

**Fichiers a modifier :**
- `server/src/main/java/com/clenzy/service/DocumentGeneratorService.java`

---

#### ACTION-024 : Restreindre Actuator [VULN-014]

- [ ] **A.** Deplacer `/actuator/prometheus` et `/actuator/metrics` derriere une authentification ou un IP filter

**Fichiers a modifier :**
- `server/src/main/java/com/clenzy/config/SecurityConfigProd.java`

---

#### ACTION-025 : Limiter nombre d'evenements iCal importes [VULN-029]

- [ ] **A.** Ajouter un check `if (events.size() > 5000) throw new ValidationException(...)`
- [ ] **B.** Ajouter un timeout global sur l'import (5 min max)

**Fichiers a modifier :**
- `server/src/main/java/com/clenzy/service/ICalImportService.java`

---

### Phase P3 — Moyen terme (3 mois)

#### ACTION-026 : Rotation automatique des cles [VULN-019]

- [ ] **A.** Implementer un systeme de versionning des cles (key_version sur chaque token chiffre)
- [ ] **B.** Supporter le dechiffrement multi-cles (ancienne + nouvelle)
- [ ] **C.** Processus de rotation : generer nouvelle cle, re-chiffrer les tokens actifs, retirer l'ancienne

---

#### ACTION-027 : Rate limiting distribue (Redis-backed)

- [ ] **A.** Remplacer le rate limiting in-memory par un compteur Redis avec TTL
- [ ] **B.** Utiliser l'algorithme sliding window

---

#### ACTION-028 : Audit logging complet

- [ ] **A.** Logger tous les appels API (GET/POST/PUT/DELETE) avec code reponse
- [ ] **B.** Logger toutes les modifications de permissions et roles
- [ ] **C.** Logger l'acces admin separement
- [ ] **D.** Retention des logs d'audit : 2 ans minimum

---

#### ACTION-029 : Tests de securite automatises dans CI/CD

- [ ] **A.** Ajouter un job CI qui execute les tests de securite (cross-tenant, SSRF, injection)
- [ ] **B.** Ajouter un job OWASP ZAP (DAST) sur l'environnement staging
- [ ] **C.** Ajouter un check `System.out.println` = 0
- [ ] **D.** Ajouter un check credentials hardcodees = 0
- [ ] **E.** Bloquer les PR si un test de securite echoue

---

## Resume du Plan d'Action

| Phase | # Actions | Delai | Priorite |
|-------|-----------|-------|----------|
| P0 | 6 actions (ACTION-001 a 006) | 48h | CRITIQUE |
| P1 | 9 actions (ACTION-007 a 015) | 1 semaine | HAUTE |
| P2 | 10 actions (ACTION-016 a 025) | 1 mois | MOYENNE |
| P3 | 4 actions (ACTION-026 a 029) | 3 mois | AMELIORATION |

**Total : 29 actions de remediation**
**Tests CI/CD a ajouter : 25+ tests**

---

## Prochaines Etapes

1. **Validation conjointe** : Reprendre chaque VULN/ACTION ensemble pour confirmer la pertinence et l'approche
2. **Implementation P0** : Corriger les 6 vulnerabilites critiques en priorite
3. **Tests de verification** : Ecrire et executer les tests de securite pour chaque correction
4. **Integration CI/CD** : Ajouter les tests au pipeline pour bloquer les regressions
5. **Revue post-remediation** : Re-audit apres implementation pour valider le score
