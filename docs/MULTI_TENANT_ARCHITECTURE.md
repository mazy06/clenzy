# Architecture Multi-Tenant - Clenzy PMS

## Vue d'ensemble

Clenzy utilise une architecture **multi-tenant a isolation par ligne** (Row-Level Security) basee sur une colonne `organization_id` presente sur toutes les entites metier. Chaque utilisateur appartient a exactement **une** organisation.

L'approche est dite **"belt and suspenders"** (ceinture et bretelles) : deux mecanismes independants garantissent l'isolation des donnees :

1. **Hibernate @Filter** : filtre automatique sur toutes les requetes SELECT generees par Hibernate
2. **@Query explicites** : chaque requete JPQL inclut manuellement `AND organizationId = :orgId`

```
 Requete HTTP
      |
      v
 +--------------------------+
 | SecurityFilterChain      |
 |  - JWT Authentication    |
 |  - TenantFilter          |  <-- Resout org depuis JWT, active Hibernate Filter
 +--------------------------+
      |
      v
 +--------------------------+
 | Controller               |
 +--------------------------+
      |
      v
 +--------------------------+
 | Service                  |
 |  - TenantContext injecte |  <-- getRequiredOrganizationId()
 |  - Passe orgId aux repos |
 +--------------------------+
      |
      v
 +--------------------------+
 | Repository               |
 |  - @Query + orgId param  |  <-- 2eme couche de securite
 +--------------------------+
      |
      v
 +--------------------------+
 | Hibernate Session        |
 |  - @Filter actif         |  <-- 1ere couche automatique
 +--------------------------+
```

---

## Composants principaux

### 1. Organization (entite)

**Fichier** : `server/src/main/java/com/clenzy/model/Organization.java`
**Table** : `organizations`

| Champ | Type | Description |
|-------|------|-------------|
| id | BIGSERIAL PK | Identifiant unique |
| name | VARCHAR(200) | Nom de l'organisation |
| type | OrganizationType | INDIVIDUAL, CONCIERGE, CLEANING_COMPANY |
| slug | VARCHAR(100) UNIQUE | URL-friendly identifier |
| stripe_customer_id | VARCHAR(255) | ID client Stripe |
| stripe_subscription_id | VARCHAR(255) | ID abonnement Stripe |
| forfait | VARCHAR(255) | Plan tarifaire |
| billing_period | VARCHAR(20) | monthly / yearly |
| deferred_payment | BOOLEAN | Paiement differe active |

### 2. OrganizationMember (entite)

**Fichier** : `server/src/main/java/com/clenzy/model/OrganizationMember.java`
**Table** : `organization_members`

| Champ | Type | Description |
|-------|------|-------------|
| id | BIGSERIAL PK | Identifiant |
| organization_id | FK -> organizations | Organisation |
| user_id | FK -> users | Utilisateur |
| role_in_org | OrgMemberRole | OWNER, ADMIN, MEMBER |
| joined_at | TIMESTAMP | Date d'adhesion |

**Contrainte** : `UNIQUE (organization_id, user_id)` - un user ne peut etre dans une org qu'une fois.

### 3. TenantContext (bean request-scoped)

**Fichier** : `server/src/main/java/com/clenzy/tenant/TenantContext.java`

Bean Spring `@RequestScope` qui stocke le contexte d'organisation pour la requete courante.

```java
@Component
@RequestScope
public class TenantContext {
    private Long organizationId;
    private boolean superAdmin = false;

    // getRequiredOrganizationId() : throw si null
    // getOrganizationId()         : nullable (pour contexts optionnels)
    // isSuperAdmin()              : true si ADMIN global
}
```

**Utilisation dans les services** :
- `tenantContext.getRequiredOrganizationId()` : pour les operations d'ecriture et lectures critiques
- `tenantContext.getOrganizationId()` : pour les contextes ou l'org peut etre null (ex: schedulers)

### 4. TenantFilter (OncePerRequestFilter)

**Fichier** : `server/src/main/java/com/clenzy/tenant/TenantFilter.java`

Filtre HTTP qui s'execute apres l'authentification JWT dans la SecurityFilterChain.

**Flux de resolution** :

```
1. Extraire keycloakId depuis JWT (jwt.getSubject())
2. Verifier le cache Redis (cle: "tenant:{keycloakId}", TTL: 5 min)
3. Si cache miss : lookup DB via UserRepository.findByKeycloakId()
4. Stocker dans TenantContext (organizationId + superAdmin flag)
5. Si NON super-admin : activer le Hibernate Filter "organizationFilter"
```

**Endpoints exclus** (pas de filtrage) :
- `/actuator/**` (monitoring)
- `/api/webhooks/**` (Stripe, Airbnb)
- `/api/auth/**` (authentification)
- `/api/public/**` (endpoints publics)
- `/api/health` (health check)
- `/v3/api-docs/**`, `/swagger-ui/**` (documentation API)

**Cache Redis** :
```
Cle    : tenant:{keycloakId}
Valeur : TenantInfo { organizationId: Long, superAdmin: boolean }
TTL    : 5 minutes
```

### 5. SecurityConfig Integration

**Fichiers** :
- `server/src/main/java/com/clenzy/config/SecurityConfig.java` (profil dev)
- `server/src/main/java/com/clenzy/config/SecurityConfigProd.java` (profil prod)

Le TenantFilter est enregistre dans la chaine de filtres Spring Security :

```java
.addFilterAfter(tenantFilter, UsernamePasswordAuthenticationFilter.class)
```

Cela garantit que le JWT est deja authentifie avant que le TenantFilter ne resolve l'organisation.

---

## Entites protegees (31 entites)

Chaque entite metier possede :
1. `@FilterDef(name = "organizationFilter", parameters = @ParamDef(name = "orgId", type = Long.class))`
2. `@Filter(name = "organizationFilter", condition = "organization_id = :orgId")`
3. `@Column(name = "organization_id") private Long organizationId` + getter/setter

### Liste complete

| # | Entite | Table | NOT NULL | FK |
|---|--------|-------|----------|-----|
| 1 | User | users | OUI | OUI |
| 2 | Property | properties | OUI | OUI |
| 3 | ServiceRequest | service_requests | OUI | OUI |
| 4 | Intervention | interventions | OUI | OUI |
| 5 | Team | teams | NON | OUI |
| 6 | TeamMember | team_members | NON | NON |
| 7 | Reservation | reservations | OUI | OUI |
| 8 | Portfolio | portfolios | NON | OUI |
| 9 | PortfolioClient | portfolio_clients | NON | NON |
| 10 | PortfolioTeam | portfolio_teams | NON | NON |
| 11 | ManagerProperty | manager_properties | NON | NON |
| 12 | ManagerUser | manager_users | NON | NON |
| 13 | ManagerTeam | manager_teams | NON | NON |
| 14 | PropertyTeam | property_teams | NON | NON |
| 15 | PricingConfig | pricing_configs | NON | NON |
| 16 | GdprConsent | gdpr_consents | NON | NON |
| 17 | TeamCoverageZone | team_coverage_zones | NON | NON |
| 18 | NoiseDevice | noise_devices | NON | OUI |
| 19 | ICalFeed | ical_feeds | NON | NON |
| 20 | Notification | notifications | NON | OUI |
| 21 | NotificationPreference | notification_preferences | NON | NON |
| 22 | ContactMessage | contact_messages | NON | NON |
| 23 | DocumentTemplate | document_templates | NON | NON |
| 24 | DocumentGeneration | document_generations | NON | NON |
| 25 | DocumentNumberSequence | document_number_sequences | NON | NON |
| 26 | AuditLog | audit_log | NON | NON |
| 27 | ReceivedForm | received_forms | NON | NON |
| 28 | AirbnbConnection | airbnb_connections | NON | OUI |
| 29 | TuyaConnection | tuya_connections | NON | OUI |
| 30 | AirbnbListingMapping | airbnb_listing_mappings | NON | OUI |
| 31 | MinutConnection | minut_connections | NON | OUI |

### Entites NON protegees (global / enfants cascade)

| Entite | Raison |
|--------|--------|
| Organization | Entite racine du multi-tenant |
| OrganizationMember | Cross-org par design |
| InterventionPhoto | Enfant cascade (filtre via `intervention.organizationId` dans @Query) |
| PropertyPhoto | Enfant cascade de Property |
| RequestPhoto | Enfant cascade de ServiceRequest |
| RequestComment | Enfant cascade de ServiceRequest |
| Permission, Role, RolePermission | Configuration RBAC globale |
| PendingInscription | Pre-inscription, avant creation d'org |

---

## Repositories : double protection

### @Query explicites (~153 methodes)

Toutes les methodes @Query dans les 22 repositories tenant-scoped incluent :
```java
@Query("SELECT e FROM Entity e WHERE ... AND e.organizationId = :orgId")
List<Entity> findBySomething(@Param("something") X val, @Param("orgId") Long orgId);
```

### Requetes derivees Spring Data

Les requetes derivees (ex: `findByEmail()`, `findByUserId()`) sont protegees par le Hibernate @Filter pour les SELECT.

**Exception importante** : les methodes `deleteByXxx()` derivees **ne sont PAS protegees** par le Hibernate Filter (les bulk DELETE ne passent pas par le filtre Hibernate). Voir la section "Points d'attention" ci-dessous.

---

## Services : injection TenantContext

Tous les services metier injectent `TenantContext` et :
1. Passent `tenantContext.getRequiredOrganizationId()` a chaque appel repository @Query
2. Appellent `entity.setOrganizationId(tenantContext.getRequiredOrganizationId())` sur chaque creation d'entite

### Services avec TenantContext (17 services)

| Service | Injection |
|---------|-----------|
| UserService | Constructor |
| PropertyService | Constructor |
| InterventionService | Constructor |
| ServiceRequestService | Constructor |
| TeamService | Constructor |
| PortfolioService | @Autowired |
| ReservationService | Constructor |
| NotificationService | Constructor |
| AuditLogService | Constructor |
| ContactMessageService | Constructor |
| GdprService | Constructor |
| NoiseDeviceService | Constructor |
| PricingConfigService | Constructor |
| PropertyTeamService | Constructor |
| ManagerService | Constructor |
| DocumentGeneratorService | Constructor |
| ICalImportService | Constructor |

### Services sans TenantContext (globaux)

| Service | Raison |
|---------|--------|
| OrganizationService | Gere les orgs elles-memes |
| InscriptionService | Pre-inscription (pas encore d'org) |
| KeycloakService | Auth externe |
| PermissionService | RBAC global (a son propre TenantContext pour findByRoleIn) |

---

## Comportement ADMIN (super-admin)

Les utilisateurs avec le role `ADMIN` sont traites comme **super-admins** :

1. Le TenantFilter **ne desactive PAS** le Hibernate Filter pour eux, mais `tenantContext.setSuperAdmin(true)` est positionne
2. **CORRECTION** : dans l'implementation actuelle, le filtre Hibernate n'est PAS active pour les ADMIN (`if (!isSuperAdmin)`)
3. Les ADMIN voient donc toutes les donnees de toutes les organisations
4. Les requetes @Query explicites passent toujours `orgId` — l'ADMIN verra ses propres donnees dans ces cas

---

## Migration V41

**Fichier** : `server/src/main/resources/db/migration/V41__create_organization_tables.sql`

La migration effectue les etapes suivantes :

1. **Creation** des tables `organizations` et `organization_members`
2. **Auto-creation** d'une `Organization` INDIVIDUAL par utilisateur existant (slug: `org-{userId}`)
3. **Creation** des `OrganizationMember` OWNER pour chaque user
4. **Ajout** de `organization_id` sur 30 tables metier
5. **Peuplement** de `organization_id` via JOINs (owner_id, user_id, parent FK)
6. **Contraintes** NOT NULL sur les 5 tables critiques (users, properties, service_requests, interventions, reservations)
7. **Foreign Keys** vers organizations(id) sur 9 tables principales
8. **Index** sur `organization_id` pour 15 tables
9. **Verification** finale : aucun NULL sur les tables critiques (avec RAISE EXCEPTION)

---

## Flux d'inscription et creation d'organisation

**Fichier** : `server/src/main/java/com/clenzy/service/InscriptionService.java`

```
1. Utilisateur remplit le formulaire d'inscription
2. InscriptionService.initInscription() :
   - Verifie unicite email
   - Cree session Stripe Checkout
   - Sauvegarde PendingInscription (status: PENDING_PAYMENT)
3. Stripe webhook → completeInscription() :
   a. Cree l'utilisateur dans Keycloak
   b. Cree l'utilisateur dans la base (User entity)
   c. Cree l'Organisation via OrganizationService.createForUserWithBilling()
      - Organisation INDIVIDUAL par defaut
      - Membership OWNER
      - Copie billing (stripe_customer_id, subscription_id, forfait, billing_period)
      - Set user.organizationId = org.id
   d. Marque PendingInscription comme COMPLETED
```

---

## Audit de conformite

### Resultat global

| Composant | Statut | Couverture |
|-----------|--------|------------|
| Entites @FilterDef/@Filter | OK | 31/31 (100%) |
| @Query avec orgId | OK | ~153 methodes (100%) |
| Services avec TenantContext | OK | 17/17 services metier |
| SecurityConfig integration | OK | Dev + Prod |
| V41 Migration | OK | 30 tables, verifications incluses |
| Inscription → Org creation | OK | Stripe webhook flow |

### Points d'attention connus

#### 1. Requetes DELETE derivees — CORRIGE (V42)

Les methodes Spring Data derivees `deleteByXxx()` ont ete converties en `@Modifying @Query` avec clause `AND organizationId = :orgId` :

| Methode | Repository | Statut |
|---------|------------|--------|
| `deleteByPropertyIdAndOrganizationId(Long, Long)` | PropertyTeamRepository | CORRIGE |
| `deleteByTeamIdAndOrganizationId(Long, Long)` | TeamCoverageZoneRepository | CORRIGE |
| `deleteByUserIdAndOrganizationId(Long, Long)` | GdprConsentRepository | CORRIGE |
| `deleteByInterventionId(Long)` | InterventionPhotoRepository | N/A (pas d'organizationId, cascade child — parent valide avant delete) |

#### 2. Entites d'integration — CORRIGE (V42)

Les 4 entites d'integration possedent maintenant `organizationId` (Long) + `@FilterDef/@Filter` :

| Entite | Table | Statut |
|--------|-------|--------|
| AirbnbConnection | airbnb_connections | CORRIGE (organizationId + @FilterDef/@Filter) |
| TuyaConnection | tuya_connections | CORRIGE (organizationId + @FilterDef/@Filter) |
| AirbnbListingMapping | airbnb_listing_mappings | CORRIGE (organizationId + @FilterDef/@Filter) |
| MinutConnection | minut_connections | CORRIGE (type corrige String -> Long, ancien champ renomme minutOrganizationId) |

Migration V42 : `V42__add_orgid_to_airbnb_listing_mappings.sql` ajoute la colonne a `airbnb_listing_mappings` et les FK/indexes manquants sur les 4 tables.

Les services d'integration definissent maintenant `organizationId` a la creation :

| Service | Methode | Source orgId |
|---------|---------|-------------|
| AirbnbListingService | linkPropertyToListing() | property.getOrganizationId() |
| MinutOAuthService | exchangeCodeForToken() | tenantContext (HTTP context) |
| TuyaApiService | createConnection() | tenantContext (HTTP context) |
| AirbnbReservationService | createCleaningIntervention() | property.getOrganizationId() |

#### 3. Contexte Kafka — CORRIGE

AirbnbReservationService n'injecte plus `TenantContext` (qui crashait en contexte @KafkaListener). L'organizationId est maintenant resolu via les relations d'entites (mapping.getOrganizationId() ou property.getOrganizationId()).

#### 4. @Scheduled tasks (risque faible, accepte)

Les taches planifiees (ICalSyncScheduler, AirbnbSyncScheduler) s'executent hors contexte HTTP sans Hibernate @Filter actif. Elles traitent les donnees de toutes les organisations mais chaque entite est traitee independamment (par property/user). Pas de risque de fuite de donnees entre tenants.

#### 5. Requetes derivees SELECT (risque faible)

Certains repositories utilisent des requetes derivees SELECT sans orgId explicite (ex: `findByEmail()`, `findByUserId()`). Celles-ci sont **protegees par le Hibernate @Filter** qui ajoute automatiquement `WHERE organization_id = :orgId` a toutes les requetes SELECT generees.

Le seul cas non protege est pour les **ADMIN** (super-admin) qui n'ont pas le filtre Hibernate actif — ce comportement est voulu pour leur permettre de voir toutes les donnees cross-org.

---

## Glossaire

| Terme | Definition |
|-------|------------|
| **Tenant** | Une organisation (entite `Organization`) |
| **organizationId** | Cle etrangere vers `organizations.id` sur chaque entite metier |
| **Hibernate @Filter** | Mecanisme automatique d'ajout de condition WHERE par Hibernate |
| **@FilterDef** | Declaration du filtre au niveau de l'entite JPA |
| **TenantContext** | Bean Spring request-scoped contenant l'org courante |
| **TenantFilter** | Filtre HTTP qui resout l'org depuis le JWT |
| **Super-admin** | Utilisateur ADMIN qui bypass le filtre Hibernate |
| **Belt and suspenders** | Double protection : Hibernate @Filter + @Query explicites |
