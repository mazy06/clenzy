# Plan de migration & rebranding — Clenzy → Baitly

> Plan d'implémentation détaillé. **Principe directeur : séparer le rebrand VISIBLE (sûr, automatisable) des migrations FONCTIONNELLES (coordonnées, à haut risque).** Jamais de `sed`/remplacement global : casserait package, realm Keycloak, volumes de données, webhooks OAuth, images, DNS.

## Ampleur réelle (mesurée)
- **3 469 fichiers** contiennent « clenzy ».
- **`com.clenzy` : 13 620 occurrences** (~3 010 fichiers Java) — identifiant fonctionnel dominant.
- **17 sous-domaines** `*.clenzy.fr` (app, api, auth, keycloak, monitoring, sdk, sign, photos, cdn, mail, help, status, staging, www, origin…).
- **Realm Keycloak** `clenzy` + `clenzy-guests` (65 réfs).
- **Conteneurs/réseaux/volumes** Docker `clenzy-*` (+ images GHCR `ghcr.io/mazy06/clenzy-*`, repos GitHub `clenzy`, `clenzy-infra`, `clenzy-sites`).
- **Texte/marque « Clenzy »** : 2 713 occurrences, dont **seulement 3 en i18n UI** (l'UI affiche peu « Clenzy » en dur — tant mieux).

## Découpage en phases (par risque croissant)

### Phase 1 — Rebrand VISIBLE (SÛR · automatisable · à faire en premier)
**Périmètre** : texte affiché (valeurs i18n, libellés, titres, emails), **commentaires**/Javadoc/JSDoc, **docs** `.md`/PDF/README, **messages de log** humains, descriptions de tools.
**Exclut formellement** : tout identifiant (package, classes, clés i18n, noms de conteneurs, domaines, realm, env var, schémas SQL).
**Risque** : quasi nul (ne change aucun comportement).
**Validation** : `mvn package` + suite de tests verte + `tsc` + build front OK (le texte ne casse rien).
**Exécution** : automatisable par agent/workflow (voir le PROMPT en fin de doc).

### Phase 2 — Package Java `com.clenzy` → `com.baitly` (MÉCANIQUE · HAUT RISQUE)
**Risque** : énorme blast radius (13 620 réfs). Points durs :
- **Sérialisation Kafka** : si les events portent le FQN de classe (`com.clenzy.…`), les messages **en vol** deviennent illisibles après rename → **drainer les topics** d'abord (Outbox vidée, consommateurs à jour) OU vérifier que la sérialisation est class-name-agnostique.
- **Component scanning Spring** : le rename déplace `ClenzyApplication` → re-scanner le nouveau base-package (OK si tout bouge ensemble).
- **Conflits de branches** : invalide quasi toutes les PR en cours → **freeze** du dépôt le temps du rename.
**Méthode** : refactor IDE « Rename Package » (IntelliJ — fiable) **plutôt** que `sed` ; puis `mvn package` + suite complète ; nouvelle image ; déploiement coordonné (pas de rolling avec ancienne image en parallèle si events incompatibles).
**Note** : ne touche PAS aux `@Table(name=…)` (chaînes explicites) → **DB inchangée**. ✓
**Rollback** : revert du commit + redeploy image précédente.

### Phase 3 — Infra Docker (conteneurs/réseaux/volumes `clenzy-*`)
**Risque** : moyen-élevé. **⚠ Volumes de données** : renommer un volume Docker = **repartir d'un volume vide** (perte DB/Redis/Kafka) si on ne migre pas les données. → **conserver les noms de volumes** OU migrer explicitement le contenu.
**Méthode** : MAJ `docker-compose.*.yml` + scripts `deploy.sh`/`start-dev.sh` + références CI ; recréation conteneurs (downtime planifié) ; **garder les volumes** (`*-data-prod`) tels quels au début.
**Rollback** : compose précédent + `up -d`.

### Phase 4 — Keycloak realm `clenzy` / `clenzy-guests` (TRÈS COORDONNÉ)
**Risque** : élevé. Renommer un realm **invalide tous les tokens** + change les **issuer URIs** (`/realms/clenzy` → `/realms/baitly`).
**Impacts** : `SPRING_SECURITY_…_ISSUER_URI`, clients (web, guests, admin-cli), redirect URIs, le SDK booking, **re-login forcé** de tous les utilisateurs.
**Méthode** : export realm → réimport sous le nouveau nom → MAJ backend (issuer/jwk) + front + SDK → fenêtre de maintenance → invalidation/relogin. Possibilité de **garder l'ancien realm en parallèle** un temps (double-issuer) pour lisser.
**Rollback** : remettre l'issuer sur l'ancien realm.

### Phase 5 — Domaines `*.clenzy.fr` → `*.baitly.fr` (TRÈS COORDONNÉ)
**Risque** : élevé, surface externe. **⚠ Webhooks OAuth/paiement** : Stripe, Airbnb/OTA, Minut, etc. pointent sur `*.clenzy.fr` → à reconfigurer côté fournisseurs, sinon **paiements/sync cassés**.
**Méthode** : acquérir `baitly.fr` → DNS + certs (Cloudflare/certbot) → nginx server_names → redirect URIs Keycloak + CORS + config front (`VITE_*`) → webhooks fournisseurs → **garder `*.clenzy.fr` en redirection 301** pendant une longue période (liens existants, SEO, webhooks legacy).
**Rollback** : DNS/nginx reviennent à clenzy.fr (gardé actif).

### Phase 6 — Repos GitHub + images GHCR
**Périmètre** : repos `clenzy`/`clenzy-infra`/`clenzy-sites` (GitHub redirige les anciens), namespace images `ghcr.io/mazy06/clenzy-*` → `baitly-*`.
**Méthode** : renommer les repos (GitHub garde la redirection) → MAJ remotes locaux, références CI (`repository_dispatch`, image names), compose `image:`. **Coordonner avec Phase 3** (les noms d'images sont dans le compose).

### Phase 7 — Base de données (nom de base/schéma)
Souvent **inutile** (interne, non visible). Si on y tient : dump/restore vers une base renommée, fenêtre de maintenance. **À ne pas faire sans raison.**

## Ordre & cadence recommandés
1. **Phase 1 maintenant** (sûr, gain de marque immédiat, automatisable).
2. **Phases 6 + 3 + 2** ensemble lors d'un **freeze planifié** (repos/images + conteneurs + package = un gros lot technique cohérent, une fenêtre de maintenance).
3. **Phase 4 (Keycloak)** puis **Phase 5 (domaines)** : les plus externes/risquées, chacune sa fenêtre + période de double-run (ancien realm/domaine en parallèle).
4. **Phase 7** : seulement si nécessaire.

> Chaque phase fonctionnelle (2→7) mérite **son propre runbook + sa fenêtre de maintenance + son rollback testé**. Ne pas enchaîner deux phases risquées le même jour.

## Garde-fous transverses
- Snapshot VPS + dump DB **avant** chaque phase fonctionnelle.
- Suite de tests verte + `mvn package` + build front après chaque lot.
- Ne jamais déployer une image mi-renommée en parallèle d'une ancienne si la sérialisation diffère (Kafka).
- Conserver les anciens domaines/realm en parallèle (redirections) le temps de la transition.

---

## PROMPT À LANCER — Phase 1 (rebrand visible, sûr)

> À donner à un agent/workflow. Il ne touche QU'au texte visible + commentaires + docs ; **aucun identifiant**.

```
Mission : rebrand VISIBLE Clenzy → Baitly (Phase 1, sûr) sur le repo clenzy. Objectif : remplacer la
MARQUE « Clenzy » par « Baitly » dans le TEXTE uniquement, SANS rien casser.

À REMPLACER (Clenzy → Baitly, en respectant la casse : Clenzy→Baitly, CLENZY→BAITLY, clenzy→baitly
UNIQUEMENT dans du texte libre) :
- valeurs de chaînes affichées à l'utilisateur (libellés, titres, messages, emails) ;
- VALEURS i18n dans client/src/i18n/locales/*.json (PAS les clés) ;
- commentaires de code (// , /* */, Javadoc, JSDoc, docstrings) ;
- fichiers de documentation : *.md, README, handoffs ;
- messages de log destinés à l'humain + descriptions de tools (ToolDescriptor).

À NE JAMAIS TOUCHER (laisser « clenzy » tel quel — sinon casse prod/CI) :
- package/imports com.clenzy.*, noms de classes (ClenzyApplication…) ;
- CLÉS i18n (la partie avant « : ») et toute clé/identifiant ;
- noms de conteneurs/réseaux/volumes Docker, services compose ;
- realms/clients Keycloak (clenzy, clenzy-guests) ;
- domaines *.clenzy.fr, URLs, issuer URIs, redirect URIs ;
- noms de fichiers/chemins, repos, images GHCR, env var (clés), schémas/tables SQL, colonnes.

MÉTHODE :
1. Procéder fichier par fichier, par type (d'abord *.md/docs, puis commentaires, puis chaînes UI/i18n).
2. Pour chaque remplacement, vérifier qu'il s'agit bien de TEXTE et non d'un identifiant (en cas de
   doute → NE PAS toucher).
3. NE PAS lancer de remplacement global automatique ; relire chaque changement.
4. NE PAS committer.

VÉRIFICATION (obligatoire avant de rendre) :
- `mvn -f server/pom.xml package` vert (compile + tests) ;
- `cd client && npx tsc --noEmit` à 0 + `npm run build` OK ;
- les tests qui asservissent des libellés FR précis passent toujours (sinon ajuster l'assertion = rebrandée).

RAPPORTER : nombre de fichiers touchés par catégorie (docs / commentaires / UI-i18n), les zones
volontairement laissées en « clenzy » (identifiants), et le résultat des vérifications.
```

> Note : même la Phase 1 doit éviter de rebrander aveuglément les **chaînes qui sont en réalité des identifiants** (ex. une valeur i18n qui contient un nom de domaine). Le « en cas de doute, ne pas toucher » prime.
