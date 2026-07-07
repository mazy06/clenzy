# Comparaison « Système de design » — Baitly vs open-design

> But : s'appuyer sur le système open-design (éprouvé) pour améliorer notre gestion de la **direction
> de design**. Sources : code réel des deux repos (open-design `nexu-io/open-design`, Apache-2.0).

## 1. Nature du « système de design »

| | **open-design** | **Baitly (actuel)** |
|---|---|---|
| Source de vérité | **Prose-first** : `DESIGN.md` (brief créatif) EST le système ; tokens optionnels/dérivés | **Tokens-only** : `DesignTokensDto` (21 champs) ; **aucune prose** |
| Réutilisable / nommé | Oui — bibliothèque de **150 systèmes** nommés, attachables à tout projet | Non — tokens **par config** (`booking_engine_configs.design_tokens`), pas d'objet nommé |
| Métadonnées | `manifest.json` (id, name, category, source, files, preview) | Aucune (juste un blob JSON de tokens) |
| Traçabilité | `source/` (evidence, tokens.source, rapport) | `sourceWebsiteUrl` + `aiAnalysisHash` seulement |

## 2. Le `DESIGN.md` open-design (ce qui nous manque le plus)

Minimum viable = **juste un `DESIGN.md`**. C'est un **brief créatif** (pas un schéma), 9 sections :
`Visual Theme & Atmosphere · Color Palette & Roles · Typography · Layout & Spacing · Components ·
Motion & Interaction · Iconography & Imagery · Voice & Tone · Edge Cases`.

C'est **cette prose** (atmosphère, voix, imagerie, motion) qui rend leurs générations **distinctives et
on-brand**. Baitly n'a **rien** de tel → nos générations sont génériques (le prompt ne porte que des
champs de brief, aucune direction d'atmosphère/voix).

## 3. Sources de création

| | **open-design** | **Baitly** |
|---|---|---|
| Site web | ✅ | ✅ **`AiDesignService.analyzeWebsite`** (fetch SSRF-safe + LLM + cache hash) |
| DESIGN.md collé | ✅ | ❌ |
| Description de marque | ✅ (« Start from a brand ») | ❌ |
| Fichiers (images/fonts/logo/PDF/HTML) | ✅ | ❌ |
| Repo GitHub / Figma / shadcn | ✅ | ❌ |
| Édition manuelle des tokens | ✅ | ⚠️ `regenerateCss` (édite tokens → CSS) mais pas d'objet réutilisable |

**Notre atout** : `AiDesignService` (site → tokens) est déjà solide et sécurisé (Jsoup, HTTPS-only,
blocage RFC 1918, cache SHA-256, timeout/taille bornés). C'est un vrai socle.

## 4. Modèle de tokens

| | **open-design** | **Baitly** |
|---|---|---|
| Structure | **En couches** : `A1-identity` (requis, c'est la marque), `A1-structure` (type scale/grid), `A2` (defaults inlinés), `B-slot` (alias), `C-extension` (allowlist) | **Plat** : 21 champs nullable, sans contrat de fallback |
| Robustesse | Composants résolvent toujours (fallbacks/alias) ; promotion C→B→A explicite | Un token absent → `var()` cassé possible |
| ⚠️ Cohérence namespace | Un seul contrat | **FRAGMENTÉ** : `--bw-*` (DTO + AiDesignService) **vs** `--bt-*` (SiteGenerationPrompts + widgetSkin) **vs** `--cb-*` (widgets). Dette à unifier. |

## 5. Association & réutilisation

| | **open-design** | **Baitly** |
|---|---|---|
| Bibliothèque | 150 systèmes nommés | `DESIGN_PRESETS` = **5 presets frontend en dur** (safari-lodge, stripe-minimal…) |
| Attacher à un projet/template | ✅ (choisir un système) | ❌ **aucune** association template ↔ système |

## 6. Preview / composants / evidence

| | **open-design** | **Baitly** |
|---|---|---|
| Preview | pages colors/typography/spacing | swatches de couleurs dans `AiDesignMatcher` |
| Composants | `components.html` + manifest | ❌ |
| Evidence d'extraction | `source/evidence.md` + rapport | hash seulement |

---

## Recommandations (ce qu'on adopte d'open-design)

1. **[MAJEUR] Introduire un `DesignSystem` de 1ʳᵉ classe, nommé & réutilisable** (comme `SiteTemplate` :
   org-scopé ou global). C'est ce que tu demandes : une bibliothèque + association aux templates.
2. **[MAJEUR] Adopter un `DESIGN.md` prose comme source de vérité** (les 9 sections, surtout **Voice &
   Tone / Imagery / Motion**). Injecté dans les prompts de génération/retouche → générations
   distinctives et on-brand. **C'est notre plus gros gap qualitatif.**
3. **Multi-sources de création** (tu les as toutes choisies) :
   - **URL** → réutilise `AiDesignService` (+ ajouter la génération de la prose DESIGN.md, pas que les tokens).
   - **Coller un DESIGN.md** → stocké tel quel + parse tokens.
   - **Décrire la marque** → LLM génère tokens **+** DESIGN.md.
   - **Édition manuelle** des tokens.
4. **Unifier le namespace de tokens** : tuer `--bw-*`, une seule vérité **`--bt-*`** (déjà listée dans
   `DESIGN-BAITLY.md`). Adopter une **légère mise en couches** (identity vs structure vs defaults) pour
   la robustesse des fallbacks.
5. **Association `DesignSystem` ↔ `SiteTemplate`** (`designSystemId`) + injection tokens+prose dans
   `SiteGenerationService` / `SiteRefinementService`.
6. **Preview** (colors/typo/spacing) ; composants = plus tard.

---

## Forme proposée pour Baitly

**Entité `DesignSystem`** (table `design_systems`) :
- `id`, `organizationId` (NULL = global), `name`, `category`, `description`, `status`.
- `tokensJson` — map `--bt-*` (contrat unifié).
- `designMarkdown` — le `DESIGN.md` (prose, 9 sections).
- `source` — `{type: url|paste|brand|manual, reference, importedAt}`.
- `previewJson` — swatches/typo (optionnel), `createdBy`, `createdAt`.

**`SiteTemplate`** gagne `designSystemId` (FK) → le template hérite de la direction.

**Backend** : `DesignSystemService` (create-from-url = AiDesignService + prose ; create-from-markdown ;
create-from-brand = LLM tokens+prose ; manual) + endpoints + repo. Feature IA = `DESIGN`.

**Frontend** : menu « Systèmes de design » (liste + assistant de création 4 sources) + sélecteur dans
la création de template + preview.

**Génération/retouche** : injecter `designSystem.designMarkdown` + `tokensJson` dans les prompts.

## Plan phasé

| Phase | Contenu | Effort |
|---|---|---|
| DS-1 | Entité `DesignSystem` + migration + repo/service/DTO + endpoints (list/get/CRUD) | ~2-3 j |
| DS-2 | Création multi-sources : URL (AiDesignService + prose), paste DESIGN.md, brand (LLM), manuel | ~3-4 j |
| DS-3 | Association `SiteTemplate.designSystemId` + injection tokens+prose dans génération/retouche | ~2 j |
| DS-4 | Frontend : menu « Systèmes de design » + assistant + sélecteur template + preview | ~4-5 j |
| DS-5 | Unification namespace `--bw-*`→`--bt-*` + légère mise en couches | ~2-3 j (dette) |
