# Documentation — templates de site Baitly (booking engine)

> Objectif : produire des **templates de site** (maquettes/designs) pour le booking engine Clenzy avec
> **Claude Design**, 100 % compatibles avec le moteur (Studio + page publique SSR).
>
> 📦 **Deux emplacements** :
> - **Ici (`clenzy/docs/template-booking-engine/`)** = la **documentation d'auteur** (cette spec + le prompt).
> - **Repo `clenzy-site-templates`** = la **bibliothèque runtime** : `schema/template.schema.json`,
>   `templates/<slug>/template.json`, `templates/index.json` (le moteur consomme ce repo).

## Index

1. **[01-BLOCKS.md](01-BLOCKS.md)** — Anatomie des 15 blocs : `type`, `props` exactes, formats
   (multi-lignes, paires), champs granulaires (align/bg), visibilité & overrides responsive, bloc `columns`.
2. **[02-DESIGN-TOKENS.md](02-DESIGN-TOKENS.md)** — Thème : clés `designTokens` exactes (⚠️ pas de clé
   inventée), ce que le SSR consomme, identité Clenzy (register **product**), lois/interdits Impeccable, a11y.
3. **[03-TEMPLATE-FORMAT.md](03-TEMPLATE-FORMAT.md)** — Format `template.json`, types de page, nav & réservation
   auto, validation, **import dans le Studio + vérification dans l'aperçu**.
4. **[PROMPT-conciergerie-marocaine.md](PROMPT-conciergerie-marocaine.md)** — Brief + **prompt prêt à coller**
   pour générer le 1er template (conciergerie marocaine).

## Source de vérité (code)
- Registre des blocs : `clenzy/client/src/modules/booking-engine/studio/builder/blockRegistry.tsx`
- Tokens : `.../booking-engine/constants.ts` (`DEFAULT_DESIGN_TOKENS`, `DESIGN_PRESETS`) +
  `.../services/api/bookingEngineApi.ts` (`DesignTokens`)
- Rendu SSR : `clenzy-sites/src/lib/blocks.tsx` · `clenzy-sites/src/lib/theme.ts` · `globals.css`
- Schéma JSON : repo **`clenzy-site-templates`** → `schema/template.schema.json`

## Boucle de production d'un template
1. Donner à Claude Design accès **à ces docs** + **au repo `clenzy-site-templates`** (schéma + sortie),
   puis coller le prompt (doc 4) → obtenir `template.json`.
2. Dans `clenzy-site-templates` : `templates/<slug>/template.json` + entrée dans `templates/index.json`.
3. Valider (depuis `clenzy-site-templates`) :
   `npx ajv-cli validate -s schema/template.schema.json -d templates/<slug>/template.json --spec=draft2020`.
4. Importer dans le Studio → vérifier dans l'aperçu (Page / Réservation) + page publique SSR.
