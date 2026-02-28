# Clenzy - Regles metier

Document de reference des regles metier de la plateforme Clenzy.
Chaque section est ajoutee au fil du developpement pour servir de source de verite.

---

## 1. Attribution des interventions aux equipes et utilisateurs

### 1.1 Modes d'assignation

Une intervention peut etre assignee de **deux manieres exclusives** :

| Mode | Champ concerne | Effet |
|------|----------------|-------|
| **Individuel** | `assignedUser` | L'intervention est attribuee a un utilisateur precis (TECHNICIAN, HOUSEKEEPER, SUPERVISOR, etc.). Le champ `teamId` est remis a `null`. |
| **Equipe** | `teamId` | L'intervention est attribuee a une equipe entiere. Le champ `assignedUser` est remis a `null`. Tous les membres de l'equipe recoivent une notification. |

> Seuls les utilisateurs **staff plateforme** (SUPER_ADMIN, SUPER_MANAGER) peuvent assigner une intervention.

### 1.2 Visibilite des interventions par role

#### Roles operationnels (TECHNICIAN, HOUSEKEEPER, SUPERVISOR, LAUNDRY, EXTERIOR_TECH)

Un utilisateur operationnel voit uniquement les interventions qui lui sont **directement rattachees** :

1. **Assignation individuelle** : `intervention.assignedUser.id == currentUser.id`
2. **Assignation par equipe** : l'utilisateur est membre d'une equipe (`TeamMember`) dont l'`id` correspond au `teamId` de l'intervention.

La requete centrale est `findByAssignedUserOrTeamWithFilters` :

```sql
WHERE (
  i.assignedUser.id = :userId
  OR EXISTS (
    SELECT 1 FROM TeamMember tm
    WHERE tm.team.id = i.teamId AND tm.user.id = :userId
  )
)
```

#### HOST (proprietaire)

Le HOST ne voit que les interventions liees a ses propres proprietes (`intervention.property.owner.id == currentUser.id`). Il ne peut pas voir les interventions des autres proprietaires.

#### Staff plateforme (SUPER_ADMIN, SUPER_MANAGER)

Acces complet a toutes les interventions de toutes les organisations. Le filtre Hibernate `organizationFilter` est **desactive** pour ces roles.

### 1.3 Structure des equipes

```
Team
 |- organizationId   (chaque equipe appartient a une organisation)
 |- interventionType (CLEANING, MAINTENANCE, LAUNDRY, etc.)
 |- members[]        (liste de TeamMember)
     |- user         (lien vers l'utilisateur)
     |- role         (role dans l'equipe : "leader", "member", etc.)
```

- Une equipe est **scopee a une organisation** (filtre Hibernate + champ `organizationId`).
- Un utilisateur peut appartenir a **plusieurs equipes**.
- Le champ `role` dans `TeamMember` est un libelle libre (pas un enum), utilise pour l'organisation interne de l'equipe.

### 1.4 Controle d'acces sur une intervention (`checkAccessRights`)

Lors de toute operation sur une intervention (lecture, modification, demarrage, completion, ajout de photos, etc.), le systeme verifie :

1. **Isolation tenant** : l'`organizationId` de l'intervention doit correspondre a celui de l'utilisateur (sauf pour les organisations SYSTEM, cf. section 2).
2. **Staff plateforme** : acces complet sans restriction supplementaire.
3. **HOST** : doit etre le proprietaire de la propriete liee a l'intervention.
4. **Roles operationnels** : doit etre soit l'utilisateur assigne individuellement, soit membre de l'equipe assignee.

Si aucune de ces conditions n'est remplie, l'acces est refuse (`UnauthorizedException`).

---

## 2. Organisations SYSTEM et acces cross-organisation

### 2.1 Concept

Une organisation de type `SYSTEM` represente un **prestataire de services mutualisee** qui fournit des services (menage, maintenance, etc.) a **toutes les organisations** de la plateforme, pas seulement a la sienne.

**Exemple concret** : l'organisation "Hostyn" de type SYSTEM emploie des equipes de menage qui interviennent chez les proprietaires de differentes organisations (HOST_SOLO, conciergeries, etc.).

### 2.2 Types d'organisation

| Type | Description | Acces interventions |
|------|-------------|---------------------|
| `INDIVIDUAL` | Proprietaire individuel | Uniquement sa propre organisation |
| `CONCIERGE` | Service de conciergerie | Uniquement sa propre organisation |
| `CLEANING_COMPANY` | Entreprise de menage | Uniquement sa propre organisation |
| `SYSTEM` | Prestataire plateforme | **Toutes les organisations** |

### 2.3 Mecanisme technique

Le `TenantFilter` detecte automatiquement le type d'organisation lors de la resolution du tenant :

1. **A la connexion** : le filtre resout l'utilisateur via son `keycloakId`, recupere son `organizationId`, puis verifie le type de l'organisation.
2. **Si l'organisation est SYSTEM** :
   - Le flag `tenantContext.systemOrg` est mis a `true`.
   - Le filtre Hibernate `organizationFilter` est **desactive** (comme pour les super-admins).
   - L'information est **cachee dans Redis** pendant 5 minutes pour eviter des requetes repetees.
3. **Dans les requetes d'interventions** :
   - Le parametre `orgId` est passe a `null` pour les utilisateurs SYSTEM → la clause `(:orgId IS NULL OR i.organizationId = :orgId)` ne filtre plus par organisation.
   - L'utilisateur voit les interventions de toutes les organisations qui lui sont assignees (individuellement ou via equipe).
4. **Dans le controle d'acces** (`checkAccessRights`) :
   - Le controle de correspondance `intervention.organizationId == caller.organizationId` est **bypasse** pour les utilisateurs SYSTEM.
   - Les autres controles (assignation individuelle ou equipe) restent actifs.

### 2.4 Regle metier cle

> **Les utilisateurs d'une organisation non-SYSTEM** voient en priorite les demandes de service et interventions **de leur propre organisation uniquement**.
>
> **Les utilisateurs d'une organisation SYSTEM** voient les interventions **de toutes les organisations** qui leur sont assignees ou assignees a leur equipe.

Cela signifie :
- Un HOUSEKEEPER dans une org `CLEANING_COMPANY` ne voit que les interventions de son organisation.
- Un HOUSEKEEPER dans une org `SYSTEM` voit les interventions de **toutes les organisations** qui ont ete assignees a lui ou a son equipe.

### 2.5 Ce qui reste scope a l'organisation SYSTEM

Meme avec l'acces cross-org, certaines donnees restent scopees a l'organisation SYSTEM de l'utilisateur :

- **Equipes** : l'utilisateur ne voit que les equipes de son organisation SYSTEM (les requetes `findByUserId` gardent le filtre `organizationId` explicite avec l'ID de l'org SYSTEM).
- **Proprietes** : les proprietes restent scopees a leurs organisations respectives.
- **Utilisateurs** : la liste des utilisateurs reste scopee.

Seules les **interventions** beneficient de l'acces cross-organisation.

---

## 3. Cycle de vie d'une intervention (machine a etats)

### 3.1 Etats possibles

| Statut | Description |
|--------|-------------|
| `PENDING` | Cree par un admin/manager, en attente de traitement |
| `AWAITING_VALIDATION` | Cree par un HOST, en attente de validation par un manager |
| `AWAITING_PAYMENT` | Validee par le manager, en attente de paiement par le HOST |
| `IN_PROGRESS` | En cours de realisation par le technicien/housekeeper |
| `COMPLETED` | Terminee (progression a 100%) |
| `CANCELLED` | Annulee (etat terminal, aucune transition possible) |

### 3.2 Transitions autorisees

```
PENDING ──────────────> AWAITING_VALIDATION
       ──────────────> IN_PROGRESS
       ──────────────> CANCELLED

AWAITING_VALIDATION ──> AWAITING_PAYMENT
                    ──> IN_PROGRESS
                    ──> CANCELLED

AWAITING_PAYMENT ────> IN_PROGRESS
                 ────> CANCELLED

IN_PROGRESS ─────────> COMPLETED
            ─────────> CANCELLED

COMPLETED ───────────> IN_PROGRESS  (reouverture)

CANCELLED ───────────> (aucune transition)
```

### 3.3 Qui peut creer une intervention ?

| Role | Statut initial | Cout estime |
|------|---------------|-------------|
| HOST | `AWAITING_VALIDATION` | `null` (le manager le definira) |
| SUPER_ADMIN / SUPER_MANAGER | `PENDING` (ou explicite) | Peut etre defini directement |
| Autres roles | Interdit | - |

---

## 4. Isolation multi-tenant (filtre Hibernate)

### 4.1 Principe

Chaque entite scopee a une organisation porte un champ `organizationId` et une annotation Hibernate `@Filter` :

```java
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
```

Le `TenantFilter` (filtre HTTP) active ce filtre Hibernate au debut de chaque requete, ce qui ajoute automatiquement `AND organization_id = :orgId` a toutes les requetes JPA sur ces entites.

### 4.2 Qui bypass le filtre ?

| Cas | Filtre Hibernate | Raison |
|-----|-----------------|--------|
| SUPER_ADMIN / SUPER_MANAGER | Desactive | Acces a toutes les organisations |
| Organisation SYSTEM | Desactive | Acces cross-org pour les prestataires |
| Autres utilisateurs | Active | Isolation stricte par organisation |

### 4.3 Double filtre

Certaines requetes JPQL ont **en plus** un filtre explicite `i.organizationId = :orgId`. Ce double filtre assure que meme si le filtre Hibernate est desactive (cas SYSTEM), les requetes non-concernees restent correctement scopees. Seules les requetes specifiquement modifiees (avec `(:orgId IS NULL OR ...)`) permettent l'acces cross-org.
