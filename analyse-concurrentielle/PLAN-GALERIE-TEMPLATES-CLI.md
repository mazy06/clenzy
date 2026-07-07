# Plan — Galerie de templates Baitly (authoring CLI → catalogue → instanciation user)

> Handoff. Objectif : remplacer, pour les **users org**, l'ouverture directe du Booking Engine Studio
> (GrapesJS, fastidieux) par une **galerie de templates prêts à l'emploi**. Les templates sont
> **produits par la plateforme** via Claude Code (CLI, abonnement) puis offerts au catalogue. Le
> Studio GrapesJS est **conservé mais réservé à la plateforme**.
>
> Inspiration : open-design.ai (`nexu-io/open-design`, Apache-2.0). On emprunte **le concept**
> `DESIGN.md`/`SKILL.md` et l'esprit UX — **aucune dépendance à leur code** (archi desktop Electron
> incompatible avec un SaaS multi-tenant navigateur).

## 1. Décisions verrouillées

| Sujet | Décision |
|---|---|
| Studio GrapesJS | **Conservé**, mais restreint aux rôles plateforme (`SUPER_ADMIN` / `SUPER_MANAGER`) |
| Entrée des users org | **Galerie de templates** (plus d'ouverture directe du Studio) |
| Production des templates | **Toi/plateforme**, via **Claude Code (CLI + abonnement)**, hors ligne |
| Personnalisation user | **Template brut par défaut**, + bouton **« Personnaliser »** (manuel) + bouton **« Retoucher avec l'IA »** (opt-in) |
| Stockage catalogue | **Base de données** via l'entité `SiteTemplate` (ajout en ligne, sans redeploy) |
| Moteur IA runtime | **API Anthropic** (clé en DB, `Paramètres > IA`) — **jamais** l'abonnement CLI |
| Coût runtime user | Négligeable (génération occasionnelle, one-shot ~centimes) → **clé plateforme absorbe**, BYOK possible |

## 2. Pourquoi ce modèle (rappel des arbitrages)

- **Juridique.** Un abonnement Claude (Consumer Terms) est pour un usage individuel. L'utiliser pour
  servir des tiers (les clients) depuis un backend SaaS sort du cadre → la voie sanctionnée = l'API.
  En **produisant les templates toi-même via le CLI**, tu es dans ton rôle de créateur (comme un
  designer sur Figma) : les users ne consomment que des **artefacts finis**. Aucun tiers servi par
  ton abonnement → **zéro risque**.
- **Coût.** Génération occasionnelle (un host crée son site une fois) → coût API négligeable
  (~0,05–0,30 € one-shot). Pas de quota complexe nécessaire.
- **Qualité.** Tu **cures** la qualité des templates au lieu de laisser un LLM improviser chez chaque
  host. Variété = richesse de la bibliothèque (l'« effet open-design » vient du **catalogue**, pas
  d'une IA live par user).
- **Réutilisation.** ~70 % de la tuyauterie existe déjà (voir §4).

## 3. Modèle cible

```
TOI (CLI Claude Code + DESIGN-BAITLY.md)     PLATEFORME (admin)            USER (org)
────────────────────────────────────────     ──────────────────           ─────────────────
Génère des templates conformes          ─▶   Ingestion → SiteTemplate ─▶   Galerie
(HTML multi-pages, markers/tokens/classes)   (valide/sanitize/miniature)   Choix → instancié BRUT
                                                                           [Personnaliser] (manuel)
                                                                           [Retoucher IA] (API, opt-in)
                                                                           Publish → SSR clenzy-sites
```

## 4. Ce qui existe déjà (à réutiliser)

- **Catalogue backend** : entité `SiteTemplate` + `SiteTemplateController` (déjà présents).
- **Format template** : `GalleryTemplate` (pages[] + `GrapesEnvelope`) — `galleryTemplates.ts`,
  `templateFactory.ts` (8 thèmes × 4 archétypes).
- **Instanciation** : import multi-pages `template → Site/SitePage` (`useSitePages.ts`).
- **Personnalisation** : tokens `--bt-*`, `AiDesignService.regenerateCss`, widgets **headless** qui
  tirent déjà les **vraies données du logement** → un template brut instancié est **déjà fonctionnel**.
- **Génération/retouche IA** : `SiteGenerationService`, `SiteGenerationPrompts`, `SiteContentAiService`.
- **Rendu public** : SSR via `clenzy-sites` (lit `publishedBlocks`, hydrate les markers).
- **Auth IA runtime** : `AiTargetResolver` → `AiProviderRouter` → `AnthropicProvider` (voir §6).

## 5. Plan par phases

### P0 — Gating du Studio → plateforme (~1 j, risque faible)
- **Front** : garde de route sur `StudioPage.tsx` / `StudioHome.tsx` via `useIsPlatformStaff`
  (rôles `SUPER_ADMIN` / `SUPER_MANAGER`) ; masquer l'entrée menu ; user org → redirection galerie.
- **Back** : `@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")` sur les endpoints
  **Studio-only** (édition brute d'enveloppe GrapesJS, `funnelPresets`, `compositeWidgets`).
  ⚠️ **Ne pas** verrouiller les endpoints **partagés** avec la galerie (liste catalogue,
  instanciation, publish, pages génériques `SiteAdminController`). Trier endpoint par endpoint.

### P1 — Contrat d'authoring (~2-3 j, **clé de voûte**)
Livrable : **`DESIGN-BAITLY.md`** (esprit `SKILL.md`) placé à la racine du repo, donné en contexte à
Claude Code pour que **chaque template sorte conforme du premier coup**. Contenu :
- Structure de pages requises : `HOME`, `PROPERTY_LIST`, `PROPERTY_DETAIL`, checkout, confirmation.
- Markers exhaustifs : `data-clenzy-widget="search|results|property|guest-form|checkout|confirmation|upsells"`
  + navigation `data-clenzy-next` / `data-clenzy-return`. *(Identifiants fonctionnels — conserver le
  préfixe `clenzy`, NE PAS rebrander.)*
- Tokens `--bt-*` attendus + classes `bkt-*` du design system.
- **Contraintes dures**, dont une déjà connue :
  ⚠️ **GrapesJS strippe les `style` INLINE à l'import → fonds image en CLASSES CSS, jamais inline.**
- Format de sortie = convertible en `GalleryTemplate` (pages[] + `GrapesEnvelope` + métadonnées :
  nom, catégorie, archétype, thème, miniature).
- **Validateur** (script Node ou endpoint) refusant tout template non conforme **avant** ingestion.
- ⚠️ Le contrat P1 s'applique aux **deux voies de production** ci-dessous, indépendamment.

### P1bis — Deux voies de production des templates
Le lieu/mode de génération est un **choix**, pas une contrainte. Peu importe la voie, tout converge
vers le contrat P1 puis l'ingestion P2 → catalogue → distribution à tous les users.

| | **Voie A — CLI + abonnement** | **Voie B — API (bouton admin)** |
|---|---|---|
| Où | Ta machine (session Claude Code loggée) | N'importe où, **écran admin plateforme dans Baitly** |
| Coût | Inclus dans ton forfait (0 €) | ~centimes/template (clé `platform_ai_model`) |
| Contrôle | Artisanal, curé à la main | Automatisable, délégable sans partager ton compte |
| Auth | Session abonnement (ne se branche jamais dans Baitly) | `AiTargetResolver` → clé API plateforme |
| Statut | **Voie de démarrage recommandée** | **Réserve** — même moteur `SiteGenerationService` |

- **Voie A (démarrage)** : `claude` dans le repo + `DESIGN-BAITLY.md` en contexte → template conforme,
  gratuit, contrôle maximal. Colle à l'usage occasionnel/curé. Cohabite sans friction avec Baitly en
  Docker local (processus indépendants : CLI sur le host, app en conteneurs).
- **Voie B (option, à ajouter au besoin)** : écran admin plateforme **« Générer un template »**
  (`@PreAuthorize` `SUPER_ADMIN`) → produit le template via l'**API** (`SiteGenerationService`) →
  passe par le validateur P1 puis l'ingestion P2. Utile pour générer/régénérer en masse ou déléguer
  la production sans partager l'abonnement CLI. Réutilise l'existant ; effort marginal ~1-2 j
  (surtout l'écran admin + branchement au validateur).
- ⚠️ Rappel : la **Voie B reste sur l'API** (pas l'abonnement) — c'est l'usage sanctionné pour du
  serveur. L'abonnement CLI (Voie A) demeure strictement ton outil de création **local**.

### P2 — Ingestion → catalogue DB (~3-4 j, risque moyen)
- Étendre `SiteTemplate` : `pagesJson`, `designTokens`, `thumbnailUrl`, `category`, `archetype`,
  `status`, `source='cli-authored'`. **Migration Liquibase** `NNNN__…` (vérifier le nom EXACT de la
  table via `@Table` + changesets existants, ne pas déduire du nom de classe).
- **Endpoint admin plateforme** `POST /api/site-templates/ingest` (multipart/JSON) → validateur P1 →
  `EmailHtmlSanitizer` → miniature → persist. `@PreAuthorize` plateforme. Controller mince
  (délégation service, pas de repository dans le controller).
- Écran admin plateforme : liste / preview / publier / retirer un template.
- Miniature : **reco = image fournie avec le template au départ**, screenshot headless (Puppeteer)
  automatisé en itération ultérieure.
- Exposer `SiteTemplateController.list` (templates **publiés**) aux users org pour la galerie.

### P3 — Expérience user (~3-5 j, risque faible)
- **Galerie** : grille de previews (miniatures P2) + filtres catégorie/archétype (réutilise
  `TemplateGalleryPage`).
- **Instanciation brute** (défaut) : `POST /api/sites/from-template/{id}` → crée `Site` + copie les
  `SitePage`, statut `DRAFT`. Immédiatement fonctionnel (vraies données logement).
- **Bouton « Personnaliser »** (manuel) : panneau contrôles couleur/logo/photos/textes →
  `AiDesignService.regenerateCss` sur les tokens. **Aucun appel LLM.**
- **Bouton « Retoucher avec l'IA »** (opt-in) : refine par section via l'API (voir §6). Régénère la
  section ciblée (marker `data-bkt-section`), re-`EmailHtmlSanitizer`, persist, refresh preview.
  Appel LLM **hors transaction** (règle CLAUDE.md #2), budget tokens borné.
- **Publish** : workflow `draft → published` existant → SSR `clenzy-sites`.

### P4 — Mémoire de design + boucle de feedback (« self-evolving », ~3-4 j, risque faible)
Inspiré du « self-evolving » d'open-design (chaque choix se sédimente en design system / préférences
/ mémoire). ⚠️ **Distinction clé** : une boucle d'apprentissage vaut par le **volume de signaux**.

| Boucle | Effet | Carburant |
|---|---|---|
| **Runtime par org** (le host affine) | Choix → design system de son org → widgets re-skinnés + retouche IA adaptée | **Faible** (usage occasionnel, 1 site/host) |
| **Authoring + plateforme-global** (toi + agrégat orgs) | Choix CLI + tendances cross-org → `DESIGN-BAITLY.md` enrichi → meilleurs presets | **Fort** (le vrai moteur d'apprentissage) |

**Ce qui existe déjà (≈80 % du substrat)** : `designTokens`/`designCssVariables` (`--bt-*`) = design
system par org ; widgets headless **var-driven** = re-skin **automatique** quand les tokens évoluent
(l'« adaptation dynamique des widgets » est **quasi gratuite**) ; `user_ui_preferences` (JSONB) +
RAG `kb_chunk` (pgvector) = substrat mémoire.

**P4a — Mémoire per-org (cheap, à faire) :**
- **Profil de design par org** : enrichir `designTokens` en un profil qui stocke aussi des préférences
  **non visuelles** (ton du copy, longueur, archétype favori, typo). Migration si colonne dédiée.
- **Write** : chaque « Personnaliser » / « Retoucher IA » **diffe** le changement dans le profil.
- **Read** : (a) tokens → widgets live (déjà là), (b) résumé du profil **injecté dans le prompt** de
  retouche IA suivante, (c) la galerie **recommande** les templates matchant le profil.
- ⚠️ **Framing** : présenter comme « **mémoire de design de votre marque** » (cohérence persistante),
  **pas** comme une IA qui « apprend de vous » — le signal per-org est trop mince pour tenir la promesse.

**P4b — Apprentissage plateforme-global (le vrai moteur, chantier séparé à scoper) :**
- Agréger les choix **anonymisés** de tous les orgs → nourrir `DESIGN-BAITLY.md` + affiner tes presets
  de templates. C'est **ici** que « la prochaine génération est meilleure » est réellement vrai (le
  volume accumule). À traiter après P4a, effort à estimer séparément.

**Note de style** : on garde le **concept** self-evolving, **pas l'esthétique** de leur écran (texte
graffiti + glow néon = absolute bans du design system Baitly, cf. règles frontend CLAUDE.md).

### Récap effort

| Phase | Effort | Risque |
|---|---|---|
| P0 Gating | ~1 j | Faible |
| P1 Contrat d'authoring | ~2-3 j | **Clé de voûte** |
| P1bis Voie B (bouton admin « Générer un template » via API) | ~1-2 j | Faible — **optionnel** |
| P2 Ingestion → catalogue | ~3-4 j | Moyen |
| P3 Galerie + instanciation + perso | ~3-5 j | Faible |
| P4a Mémoire de design per-org | ~3-4 j | Faible |
| P4b Apprentissage plateforme-global | à scoper | — |
| **Total (P0-P4a)** | **~12-17 j** | Zéro risque juridique, coût/user ≈ nul |

## 6. Authentification — CLI authoring vs clé API runtime (IMPORTANT)

**Deux authentifications totalement séparées, qui ne se touchent jamais.**

| | **Authoring (toi)** | **Runtime Baitly (users)** |
|---|---|---|
| Où | Ton terminal, ta machine | Le serveur Baitly |
| Quoi | CLI Claude Code + **abonnement** | **Clé API** Anthropic |
| Pour | Produire les templates (P1) | Bouton « Retoucher avec l'IA » (P3) |
| Auth | Session abonnement du CLI | Header `x-api-key` → `api.anthropic.com` |

⚠️ **L'abonnement du CLI ne peut PAS servir d'auth runtime.** Baitly s'authentifie à Anthropic avec
une **clé API**, pas une session d'abonnement Claude Code.

**Où « passe » l'auth dans Baitly :**
1. **UI admin** : `Paramètres > IA` (`/settings?tab=ai`, `SUPER_ADMIN`) → section « Modèles
   configurés » → Ajouter un modèle (provider `anthropic` + clé API + modèle + Tester + Enregistrer),
   puis assigner ce modèle à la feature **DESIGN**. Composant `PlatformAiConfigSection.tsx` →
   `POST /api/admin/ai/platform-config/models`.
2. **Stockage** : clé **chiffrée AES-256 (Jasypt)** dans `platform_ai_model.api_key`
   (via `EncryptedFieldConverter`). Jamais en clair, jamais loguée. BYOK par org : table
   `org_ai_api_keys` (même chiffrement).
3. **Résolution runtime** (clic « Retoucher IA ») :
   ```
   refine → AiTargetResolver.resolve(orgId, "anthropic", DESIGN)   ← point d'auth
       1. clé BYOK de l'org (si présente)     → priorité
       2. sinon modèle plateforme assigné DESIGN → ta clé
       3. sinon fallback / AiNotConfiguredException
   → AiProviderRouter → AnthropicProvider → x-api-key → api.anthropic.com
   ```
   Fichier central : `server/src/main/java/com/clenzy/service/AiTargetResolver.java`.

⚠️ **Action prérequis P3** : un modèle Anthropic doit être **actif dans `Paramètres > IA` et assigné
à la feature DESIGN**, sinon la retouche IA lève `AiNotConfiguredException`. (Déjà identifié comme
action post-deploy dans les lots récents.)

## 7. Risques & points de vigilance

- **Contrat d'authoring (P1)** = clé de voûte : mal spécifié → templates cassés à l'ingestion.
  Investir dans le **validateur** ; prévoir un template de référence « golden » qui passe le validateur.
- **Rebranding** : texte visible/commentaires/docs en **Baitly** ; identifiants fonctionnels
  (`data-clenzy-widget`, `com.clenzy.*`, `clenzy-sites`, tables SQL) **inchangés**.
- **Sanitize obligatoire** à l'ingestion (`EmailHtmlSanitizer`) même si le HTML vient de toi.
- **Miniatures** : décider tôt (image fournie vs screenshot auto) pour ne pas bloquer la galerie.
- **Splice de section (P3)** : ancrage `data-bkt-section` + validation + fallback « régénérer la page
  entière » si le splice échoue.

## 7bis. État d'implémentation (1ʳᵉ passe, 2026-07-06, NON commité)

> Vérifié : backend `mvn package -DskipTests` **exit 0** (jar produit) ; frontend `tsc -b --force` **exit 0**.

**FAIT + vérifié :**
- **P1** — Contrat `DESIGN-BAITLY.md` (racine) + validateur `scripts/validate-baitly-template.mjs` (testé conforme/invalide).
- **P2** — Migration `0325__extend_site_templates_catalog.sql` (+ entrée master) : colonnes `category`/`archetype`/`status` sur `site_templates`. Entité + `SiteTemplateDto` étendus. `SiteTemplateContractValidator` (miroir serveur du contrat). Endpoint `POST /api/booking-engine/site-templates/ingest` (staff-only) : valide → assainit → convertit en enveloppes GrapesJS → catalogue GLOBAL. `list()` filtre `PUBLISHED` pour les users org, tout pour le staff.
- **P3 backend** — `SiteTemplateInstantiationService` + `POST /api/sites/from-template/{id}` (template → Site DRAFT). `SiteRefinementService` (retouche IA par page, calque LLM de `SiteGenerationService`) + `POST /api/sites/{id}/pages/{pageId}/refine`. DTOs `SiteFromTemplateRequest` / `SiteRefineRequest`.
- **P3 frontend (API)** — `sitesApi.createFromTemplate` + `sitesApi.refinePage`.
- **P0** — `PlatformStaffGuard` câblé sur `/booking-engine/studio/:id` (éditeur GrapesJS → staff plateforme ; user org redirigé galerie).
- **P4 (read)** — les design tokens du site sont injectés dans le prompt de retouche (cohérence de marque).

## 7ter. Repasse (2026-07-06, NON commité) — surface utilisateur + review

> Vérifié : backend `mvn package -DskipTests` **exit 0** ; frontend `tsc -b --force` **exit 0**.
> Review adversarial backend (agent code-reviewer) : **aucun bug critique** — ownership, frontières
> transactionnelles, round-trip enveloppe GrapesJS, migration : tout vérifié correct.

**FAIT en repasse :**
- **Bugfix** : `SiteTemplateInstantiationService` lisait `designVars` sous `meta` au lieu de la racine du
  `contentJson` → corrigé (couleur primaire). + durcissement : instanciation ignore une page à `path` vide.
- **Surface utilisateur P3 (câblée au catalogue DB)** :
  - `siteTemplatesApi.ts` (list + ingest) ; `sitesApi.getSite` ajouté.
  - `TemplateCatalogPage` (`/booking-engine/catalog`) : galerie du **catalogue DB** → `createFromTemplate` → SiteManager.
  - `SiteManagerPage` (`/booking-engine/sites/:siteId`) : liste des pages + **aperçu iframe** (html+css de l'enveloppe) + **Retoucher avec l'IA** (`refinePage`, fonctionnel) + **Publier** (`publishPage`).
  - Guard P0 redirige désormais vers `/booking-engine/catalog`.
- **P2 admin** : `TemplateIngestPage` (`/booking-engine/catalog/admin`, staff-only) — colle le JSON du CLI → `/ingest`. **Boucle bout-en-bout complète** (plateforme ingère → user instancie).

**RESTE (repasse ultérieure) :**
- **Bouton « Personnaliser » (contrôles manuels)** : non livré — le faire proprement demande le chemin de
  régénération CSS (`AiDesignService.regenerateCss`) car le CSS des pages est **baké** par template ;
  volontairement omis plutôt que livré à moitié. Retoucher-IA + Publier couvrent l'essentiel.
- **Hydratation des widgets dans l'aperçu** : l'iframe rend html+css (les marqueurs `data-clenzy-widget`
  restent des `<div>` vides). Aperçu fidèle au layout, pas aux widgets live → brancher le SDK plus tard.
- **P4 (write)** : accumulation des préférences par org (migration mémoire + diff à chaque perso).
- **Ciblage par section** du refine (`data-bkt-section`) : actuel = page entière (garde-fou `.site-root`).
- **Rework `StudioHome`** : ses points d'entrée GrapesJS restent accessibles aux users org (le guard ne
  bloque que `/studio/:id`) → à réserver plateforme pour une séparation UX complète.
- **Vérif navigateur** : non faite (aucune preview lancée — règle projet).

## 8. Emprunts à open-design (récap)

- **Concept `DESIGN.md`/`SKILL.md`** → notre `DESIGN-BAITLY.md` (P1). **Seul vrai emprunt structurant.**
- **Inspiration design-systems / prompts** pour nourrir les sessions Claude Code d'authoring.
- **Rien d'autre** : pas de fork, pas de dépendance runtime (leur archi desktop local-first ne
  s'applique pas à un SaaS multi-tenant).
