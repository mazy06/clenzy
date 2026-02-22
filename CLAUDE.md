<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (90-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk vitest run          # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%)
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->

## Security Rules

> Ces regles sont issues du pentest Shannon (fevrier 2026) et DOIVENT etre respectees pour tout nouveau code.

### 1. Authorization obligatoire sur les controllers

- **Tout nouveau controller DOIT avoir `@PreAuthorize` au niveau classe** :
  - `@PreAuthorize("hasRole('ADMIN')")` pour les controllers d'administration (users, sync, permissions)
  - `@PreAuthorize("isAuthenticated()")` minimum pour les controllers metier
- **Ne JAMAIS creer un controller sans annotation de securite.**
- **Ne JAMAIS utiliser `@PreAuthorize("permitAll()")` sur un endpoint** sauf s'il est deja dans les `permitAll()` de `SecurityConfigProd.java`. Ce fichier est la source de verite pour les endpoints publics.

### 2. Ownership validation obligatoire

- **Tout endpoint qui prend un ID utilisateur/ressource en path/param DOIT valider l'ownership** :
  - L'utilisateur authentifie est proprietaire de la ressource OU a le role ADMIN
  - Pattern : extraire le `keycloakId` du JWT via `@AuthenticationPrincipal Jwt jwt`, comparer avec le proprietaire de la ressource
  - Refuser avec `throw new AccessDeniedException(...)` si non autorise
- **Les endpoints de modification (POST/PUT/DELETE) sur des ressources d'un manager DOIVENT etre restreints a `hasRole('ADMIN')`** ou valider que le requester est le manager concerne.

### 3. OAuth state = token CSRF aleatoire

- Le parametre `state` OAuth DOIT etre un `UUID.randomUUID()` stocke en Redis avec TTL 10 min
- Au callback : valider que le state existe dans Redis, recuperer le userId, supprimer l'entree
- **Ne JAMAIS utiliser un identifiant predictible (userId, email) comme state**
- Reference : `AirbnbOAuthService.validateAndConsumeState()`, `MinutOAuthService.validateAndConsumeState()`

### 4. Echappement HTML obligatoire

- **Tout user input injecte dans du HTML (emails, PDF, templates) DOIT passer par `StringUtils.escapeHtml()`**
- Pas d'exception, meme pour les champs qui semblent "surs" (email, telephone)
- Reference : `com.clenzy.util.StringUtils.escapeHtml()`
- Les methodes `addRow()` et `getLabel()` dans `EmailService` echappent automatiquement — ne pas contourner

### 5. Securite des URL externes

- Les URL fournies par l'utilisateur DOIVENT etre validees : HTTPS only, blocage RFC 1918, resolution DNS unique
- Reference : `ICalImportService` pour le pattern de validation

### 6. Headers de securite

- Les reponses API incluent `Cache-Control: no-cache, no-store, must-revalidate` (active via Spring Security `cacheControl()` dans `SecurityConfigProd`)
- Ne JAMAIS retirer les headers de securite configures dans `SecurityConfigProd.java`

### 7. Stockage de tokens

- Ne JAMAIS stocker de tokens/secrets dans `localStorage` — utiliser des cookies HttpOnly/Secure ou le mecanisme natif du provider auth (Keycloak)

### 8. Fichiers de securite critiques (ne pas modifier sans review)

- `server/src/main/java/com/clenzy/config/SecurityConfigProd.java` — regles d'autorisation globales
- `server/src/main/java/com/clenzy/config/SecurityConfig.java` — config dev (PLUS PERMISSIVE, ne jamais deployer en prod)
- `clenzy-infra/nginx/nginx.conf.template` — headers HTTP de securite en production

---

<!-- solid-skills v1 — adapted from github.com/ramziddin/solid-skills -->
## Code Quality Rules

> Principes SOLID, Clean Code, TDD et design patterns adaptes a la stack Clenzy (Java 21 / Spring Boot 3.2 + React 18 / TypeScript / MUI).
> Inspires de [solid-skills](https://github.com/ramziddin/solid-skills), adaptes au contexte Java/Spring + React.

### Philosophie

Le but du code : permettre aux developpeurs de **decouvrir, comprendre, ajouter, modifier, supprimer, tester, deboguer, deployer et monitorer** les features efficacement.

> "Un peu de duplication vaut 10x mieux que la mauvaise abstraction."

### 1. Principes SOLID (non negociables)

| Principe | Question a se poser | Red Flag |
|----------|---------------------|----------|
| **S**RP — Single Responsibility | "Cette classe a-t-elle UNE seule raison de changer ?" | "Cette classe gere X **et** Y **et** Z" |
| **O**CP — Open/Closed | "Puis-je etendre sans modifier ?" | Chaines `if/else` ou `switch` sur des types |
| **L**SP — Liskov Substitution | "Les sous-types sont-ils substituables ?" | Type-checking (`instanceof`) dans le code appelant |
| **I**SP — Interface Segregation | "Les clients sont-ils forces de dependre de methodes inutilisees ?" | Methodes vides ou `throw new UnsupportedOperationException()` |
| **D**IP — Dependency Inversion | "Les modules haut-niveau dependent-ils d'abstractions ?" | `new ConcreteClass()` dans la logique metier |

**Application Java/Spring :**
- Injecter via constructeur (`@RequiredArgsConstructor` ou constructeur explicite), jamais `@Autowired` sur champ
- Les services metier dependent d'interfaces (repositories Spring Data = interfaces par defaut ✓)
- Si un service depasse 3 dependances, se demander s'il ne fait pas trop de choses

### 2. Clean Code

#### Naming (par priorite)

1. **Consistance** — meme concept = meme nom partout (`findById`, pas `getById` ici et `fetchById` la)
2. **Comprehension** — langage du domaine, pas jargon technique (`computeReadinessScore`, pas `calcData`)
3. **Specificite** — precis, pas vague (eviter `data`, `info`, `manager`, `handler`, `processor`, `utils`)
4. **Brievete** — court mais pas cryptique (`syncLog` OK, `sl` NON)
5. **Cherchabilite** — noms uniques, grepables

#### Structure

- **Early returns** : guard clauses plutot que `else` imbrique
- **Un seul niveau d'indentation par methode** quand c'est possible — extraire des methodes privees
- **Methodes courtes** : viser < 20 lignes (Java impose plus de ceremony que TS, tolerance 20 au lieu de 10)
- **Classes focalisees** : un service ne devrait pas depasser ~200 lignes (hors imports/annotations)
- **Pas de code mort** : supprimer le code commente, les methodes inutilisees, les imports inutiles
- **Commentaires : WHY, jamais WHAT** — le code doit etre auto-documentant. Commenter uniquement les decisions non-evidentes, les workarounds, les contraintes business

#### Java specifique

- Records pour les DTOs (`record KpiItemDto(...)` plutot que classes avec getters/setters)
- `final` sur les variables locales quand la valeur ne change pas
- Optional pour les retours potentiellement null, jamais en parametre
- Streams > boucles imperatives pour les transformations de collections (sauf si la lisibilite en souffre)
- Enums pour les ensembles fermes de valeurs (statuts, types, categories)

#### React/TypeScript specifique

- Types et interfaces pour tous les props et retours d'API (jamais `any`)
- Hooks custom pour la logique reutilisable (`useKpiData`, `useSyncStatus`)
- Un composant = une responsabilite. Si un composant depasse 150 lignes, extraire des sous-composants
- Barrel exports (`index.ts`) pour les API publiques des modules
- `const` par defaut, `let` uniquement quand la mutation est necessaire, jamais `var`

### 3. Code Smells — Detection et correction

| Smell | Symptome | Correction |
|-------|----------|------------|
| **Long Method** | > 20 lignes | Extract Method |
| **Large Class** | > 200 lignes, responsabilites multiples | Extract Class (SRP) |
| **Long Parameter List** | > 4 parametres | Introduire un Parameter Object / record |
| **Primitive Obsession** | `String email`, `long userId` partout | Value Objects ou au minimum types dedies |
| **Feature Envy** | Une methode utilise plus les donnees d'une autre classe que les siennes | Deplacer la methode |
| **Shotgun Surgery** | Un changement touche > 3 fichiers non lies | Regrouper le code associe |
| **Switch Statements** | `switch` sur un type repete dans le codebase | Polymorphisme |
| **Speculative Generality** | Abstractions "au cas ou" jamais utilisees | YAGNI — supprimer |
| **Inappropriate Intimacy** | Classes qui connaissent les details internes l'une de l'autre | Tell Don't Ask, encapsulation |
| **Message Chains** | `a.getB().getC().getD()` | Loi de Demeter — demander a l'ami direct |

### 4. Design Patterns — Utiliser avec discernement

> Ne JAMAIS forcer un pattern. Laisser les patterns emerger du refactoring.

**Patterns couramment utilises dans Clenzy :**
- **Strategy** : politiques de pricing, regles de sync par channel
- **Observer** : NotificationService (evenements Outbox → Kafka)
- **Builder** : construction de DTOs complexes, test data
- **Adapter** : integration API externes (Airbnb, Minut, iCal)
- **Template Method** : AbstractOAuthService → AirbnbOAuthService, MinutOAuthService
- **Factory** : creation de channel-specific handlers
- **Repository** : Spring Data JPA (deja en place)

**Anti-patterns a eviter :**
- **God Object** — classe qui fait tout (> 300 lignes = alert)
- **Spaghetti Code** — pas de structure claire entre couches
- **Golden Hammer** — utiliser le meme pattern partout
- **Copy-Paste Programming** — Rule of Three : extraire uniquement a la 3e duplication

### 5. Architecture

#### Dependency Rule

```
Infrastructure → Application → Domain
    (outer)        (middle)      (inner)
```

- Le domaine (entities, value objects) n'a AUCUNE dependance vers l'infrastructure
- Les services applicatifs orchestrent, le domaine contient la logique metier
- L'infrastructure (repositories, clients HTTP, Kafka) implemente les interfaces du domaine

#### Structure du projet Clenzy

```
server/src/main/java/com/clenzy/
  config/          # Configuration Spring (cross-cutting)
  controller/      # Presentation — REST endpoints
  dto/             # Data Transfer Objects (records)
  exception/       # Exceptions metier + GlobalExceptionHandler
  model/           # Entities JPA (domaine persistant)
  repository/      # Interfaces Spring Data (infrastructure)
  service/         # Logique metier + orchestration
  integration/     # Clients externes (Airbnb API, Kafka, etc.)
  tenant/          # Multi-tenancy filter
  util/            # Utilitaires purs (StringUtils, etc.)

client/src/
  components/      # Composants partages (UI generique)
  config/          # Configuration (API, Keycloak)
  hooks/           # Custom hooks partages
  i18n/            # Traductions
  modules/         # Pages et features (admin/, dashboard/, etc.)
  services/api/    # Couche API (fetch + types)
  theme/           # Theme MUI
```

#### Conventions de couches

- **Controller** : validation des inputs, delegation au service, mapping DTO. AUCUNE logique metier.
- **Service** : orchestration, logique metier, transactions. Peut appeler d'autres services.
- **Repository** : acces donnees uniquement. Queries JPQL/natives si besoin, sinon derived queries.
- **DTO** : records immutables. Un DTO par use-case si les shapes different.
- **Entity** : logique de domaine minimale (validations d'invariants). Pas de logique applicative.

### 6. Tests

#### Structure AAA (Arrange-Act-Assert)

```java
@Test
void whenAddingItemToEmptyCart_thenTotalEqualsItemPrice() {
    // Arrange
    var cart = new Cart();
    var item = new CartItem("SKU-1", BigDecimal.valueOf(29.99));

    // Act
    cart.addItem(item);

    // Assert
    assertThat(cart.getTotal()).isEqualByComparingTo("29.99");
}
```

#### Regles de test

- **Noms concrets** : `whenSyncFails_thenStatusIsERROR` (pas `testSync` ou `shouldWork`)
- **Un concept par test** — un seul Act, pas de logique conditionnelle dans les tests
- **Pas de mocks excessifs** — utiliser les vrais objets quand c'est possible (Testcontainers pour DB/Redis)
- **Test Pyramid** : beaucoup de tests unitaires, quelques tests d'integration, peu de E2E
- **Tests d'integration** : Testcontainers (PostgreSQL + Redis) pour les repositories et services

#### Quand ecrire des tests

- **Toujours** pour la logique metier (services, calculs, validations)
- **Toujours** pour les bug fixes (test qui reproduit le bug AVANT le fix)
- **Fortement recommande** pour les controllers (validation des inputs, codes HTTP)
- **Optionnel** pour le code trivial (getters, constructeurs simples, delegation pure)

### 7. Gestion de la complexite

#### YAGNI — You Aren't Gonna Need It

- Ne construire QUE ce qui est demande maintenant
- Pas d'abstractions "au cas ou", pas de features "pour plus tard"
- Les mauvais signaux : "on pourrait avoir besoin de...", "ca serait bien d'avoir...", "pour l'extensibilite future..."

#### KISS — Keep It Simple

- La solution la plus simple qui fonctionne est generalement la meilleure
- Preferer les approches ennuyeuses et bien comprises
- Questionner chaque abstraction : apporte-t-elle vraiment de la valeur ?

#### DRY — Rule of Three

- **Duplication #1** : laisser
- **Duplication #2** : noter, laisser
- **Duplication #3** : MAINTENANT extraire
- La mauvaise abstraction est pire que la duplication

#### Boy Scout Rule

> "Laisser le code plus propre qu'on ne l'a trouve."

A chaque passage dans un fichier : ameliorer un nom, extraire une methode, supprimer du code mort, ajouter un test manquant.

### 8. Pre-Code Checklist

Avant d'ecrire du code :
- [ ] Je comprends le besoin (criteres d'acceptance clairs)
- [ ] Quelle est la solution la plus simple ?
- [ ] Quel test ecrire en premier ?
- [ ] Est-ce que je resous un probleme reel ou hypothetique ?

### 9. Post-Code Checklist

Apres que le code fonctionne :
- [ ] Tous les tests passent ?
- [ ] Y a-t-il du code mort a supprimer ?
- [ ] Les noms sont-ils toujours precis apres les changements ?
- [ ] Un junior comprendrait-il ce code dans 6 mois ?
- [ ] Les regles de securite (section precedente) sont-elles respectees ?

### 10. Red Flags — S'arreter et reflechir

- Ecrire du code sans test pour la logique metier
- Methode de plus de 30 lignes
- Plus d'un niveau d'indentation imbrique
- Utiliser `else` quand un early return fonctionne
- Hardcoder des valeurs qui devraient etre configurables
- Creer des abstractions avant la 3e duplication
- Ajouter des features "au cas ou"
- Dependre d'implementations concretes dans la logique metier
- God class qui sait tout et fait tout
- `@Autowired` sur un champ au lieu du constructeur
<!-- /solid-skills -->
