# Prompt Claude Design — Template « Conciergerie marocaine »

> **Mode d'emploi** : ouvrir une session **Claude Design** avec accès à **ces docs**
> (`clenzy/docs/template-booking-engine/`) **et au repo `clenzy-site-templates`** (schéma + dépôt de la sortie),
> puis coller le prompt ci-dessous. Claude Design doit produire **un seul fichier** `template.json` valide.
> Vérifier ensuite (depuis `clenzy-site-templates`) :
> `npx ajv-cli validate -s schema/template.schema.json -d <fichier> --spec=draft2020`.

---

## Prompt à copier-coller

```
RÔLE
Tu es designer-intégrateur de templates pour le booking engine « Baitly Studio » (Clenzy).
Tu produis un template de SITE multi-pages, 100 % compatible avec le moteur, livré en JSON.

CONTEXTE PRODUIT (à lire AVANT de coder)
Lis ces fichiers, ils sont la SOURCE DE VÉRITÉ technique :
Docs d'auteur (dossier clenzy/docs/template-booking-engine/) :
- 01-BLOCKS.md        → les 15 blocs autorisés, leurs props exactes, les formats (multi-lignes, paires…)
- 02-DESIGN-TOKENS.md → les clés de thème EXACTES (n'invente aucune clé), palette, lois Impeccable, a11y
- 03-TEMPLATE-FORMAT.md → la structure template.json, les types de page, la nav auto, la réservation auto
Repo clenzy-site-templates :
- schema/template.schema.json → le schéma JSON que ta sortie DOIT valider (et où déposer le template.json)

BRIEF MÉTIER
Client : une CONCIERGERIE MAROCAINE haut de gamme qui gère riads, villas et appartements
(Marrakech, Essaouira, Fès, Agadir…) et veut un site vitrine orienté RÉSERVATION DIRECTE
(pas d'OTA, pas de frais cachés). Ses atouts : art de vivre marocain authentique + confort moderne,
services sur-mesure (transfert aéroport, chef à domicile, hammam, excursions), conciergerie 24/7.
Audience : voyageurs FR/EN (un peu AR). Ton : chaleureux, raffiné, hospitalier, DIGNE DE CONFIANCE.
Le moteur gère l'i18n (fr/en/ar + RTL) séparément → rédige la copy en FRANÇAIS (locale par défaut).

LIBERTÉ DE DESIGN
Tu adaptes librement la PALETTE et la TYPO au contexte marocain (ex. terre cuite / argile, vert profond,
sable, crème, touche safran ou menthe) — élégant, JAMAIS kitsch ni cliché. Reste en register PRODUCT
(propre, dense, pro), respecte les interdits Impeccable et l'accessibilité (contraste ≥ 4.5:1, pas de
#000/#fff purs). Police : uniquement la liste sûre de docs/02 (Inter, Poppins, Montserrat, Lato, Nunito,
Open Sans, Roboto). Renseigne les designTokens SSR-critiques (cf. docs/02).

STRUCTURE ATTENDUE (multi-pages, « hyper complet »)
- "/"            HOME           : hero(showSearch:true) → stats (confiance) → propertyGrid → amenities/services
                                  → (experiences en teaser via columns/richText) → testimonial → faq (3-4) → cta → footer
- "/logements"   PROPERTY_LIST  : heading + propertyGrid (4 colonnes ou 3) + amenities (atouts transverses)
- "/experiences" CUSTOM         : services conciergerie (columns + amenities + pricing indicatif) + cta
- "/a-propos"    CUSTOM         : histoire (richText/columns) + stats + testimonial + footer
- "/contact"     CUSTOM         : richText (coordonnées) + map (adresse marocaine) + footer
- "/faq"         CUSTOM         : faq (8-10 Q/R réservation, check-in, annulation, services) + cta
Chaque page : title soigné (= label de menu) + seoTitle + seoDescription. footer en bas de chaque page.

CONTRAINTES TECHNIQUES (NON négociables)
1. UNIQUEMENT les `type` de docs/01 et UNIQUEMENT leurs `props` documentées. Aucune autre clé.
2. `props` = primitifs (string/number/boolean). Multi-lignes = "\n". Paires = "Libellé | Valeur".
3. `theme.designTokens` = clés EXACTES de docs/02 (sinon ignorées). Pas de `radiusLg` & co.
4. `columns` : enfants dans `children` (un tableau par colonne = `columnCount`), jamais dans `props`.
5. Images : URLs Unsplash plausibles (architecture/riad/Maroc) OU "" si incertain. Pas d'URL inventée cassée.
6. NE PAS créer de page BLOG ni PROPERTY_DETAIL (routes SSR dédiées). NE PAS créer de faux formulaire de
   réservation (le widget est injecté via #reserver ; utilise hero(showSearch) et cta).
7. Copy RÉELLE et honnête (pas de lorem ; les stats sont illustratives et génériques, pas de faux chiffres
   présentés comme mesurés).

SORTIE
- UN SEUL bloc ``` ```json contenant le `template.json` complet, valide contre schema/template.schema.json.
- `id` en slug (ex. "conciergerie-marrakech"), `register: "product"`.
- Avant de répondre, RELIS ta sortie et coche : (a) tous les `type`/`props` existent, (b) tokens = clés valides,
  (c) chaque page a title+seo, (d) HOME a un hero showSearch, (e) au moins un propertyGrid, (f) footer partout,
  (g) `columns.children` cohérent avec `columnCount`, (h) contrastes/police OK.
- Termine par une courte liste « hypothèses & points à ajuster » (images à remplacer, adresse contact, etc.).
```

---

## Après génération (côté Clenzy)
1. Enregistrer la sortie dans `templates/conciergerie-marrakech/template.json` + entrée dans `templates/index.json`.
2. Valider avec `ajv-cli` (commande en tête de ce fichier).
3. Importer dans le Studio + vérifier dans l'aperçu (Page / Réservation) — cf. [03-TEMPLATE-FORMAT.md](03-TEMPLATE-FORMAT.md).
   Si l'import multi-page n'est pas encore câblé, demander le branchement (lecture `template.json` →
   `useSitePages` + `config.tokens`) — petit, sans risque.
