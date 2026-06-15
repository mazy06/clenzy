# 02 — Thème & design tokens

> **Référence code** : `DesignTokens` dans `clenzy/client/src/services/api/bookingEngineApi.ts` ·
> défauts `DEFAULT_DESIGN_TOKENS` / `DESIGN_PRESETS` dans `.../booking-engine/constants.ts` ·
> consommation SSR `clenzy-sites/src/lib/theme.ts` (`buildThemeVars`).

## `theme` dans le template
```json
"theme": {
  "primaryColor": "#B25E4B",
  "fontFamily": "Poppins",
  "designTokens": { "...": "..." }
}
```
- `primaryColor` / `fontFamily` : raccourcis (mirroir de `designTokens.primaryColor` / `bodyFontFamily`).
- `designTokens` : objet aux **clés EXACTES ci-dessous**. ⚠️ Toute autre clé (ex. `radiusLg`) est **ignorée**.

## Clés `designTokens` valides (toutes optionnelles)
| clé | exemple | rôle | lu par le SSR ? |
|---|---|---|---|
| `primaryColor` | `#B25E4B` | couleur d'accent principale (`--accent`) | ✅ |
| `secondaryColor` | `#49554C` | couleur secondaire | — (widget) |
| `accentColor` | `#D4A574` | accent additionnel | — (widget) |
| `backgroundColor` | `#F7F3EE` | fond de page (`--bg`) | ✅ |
| `surfaceColor` | `#FFFFFF` | fond des cartes (`--card`) | ✅ |
| `textColor` | `#2A2520` | texte principal (`--ink`) | ✅ |
| `textSecondaryColor` | `#7A6E62` | texte secondaire (`--muted`) | ✅ |
| `borderColor` | `#E7DFD5` | bordures (`--line`) | ✅ |
| `dividerColor` | `#E7DFD5` | séparateurs | — (widget) |
| `headingFontFamily` | `Poppins, sans-serif` | police des titres (`--font-display`) | ✅ |
| `bodyFontFamily` | `Inter, sans-serif` | police du corps | ✅ |
| `baseFontSize` | `15px` | taille de base | ✅ |
| `headingFontWeight` | `600` | graisse des titres | — (widget) |
| `borderRadius` | `8px` | rayon général (`--radius-md`) | ✅ |
| `cardBorderRadius` | `14px` | rayon des cartes (`--radius-lg`) | ✅ |
| `buttonBorderRadius` | `999px` | rayon des boutons | — (widget) |
| `spacing` | `8px` | unité d'espacement | — (widget) |
| `boxShadow` | `0 10px 30px rgba(0,0,0,.08)` | ombre générique | — (widget) |
| `cardShadow` | `0 10px 30px rgba(20,24,28,.08)` | ombre des cartes | — (widget) |
| `buttonStyle` | `filled` | style de bouton (`filled` / `outline`) | — (widget) |
| `buttonTextTransform` | `none` | casse des boutons (`none` / `uppercase`) | — (widget) |

> **Pour un rendu SSR fidèle**, renseigne au minimum : `primaryColor`, `bodyFontFamily`, `headingFontFamily`,
> `backgroundColor`, `surfaceColor`, `textColor`, `textSecondaryColor`, `borderColor`,
> `borderRadius` (et/ou `cardBorderRadius`), `baseFontSize`.

## Police
`fontFamily` / `*FontFamily` doivent référencer une police **chargée** côté site. Valeurs sûres :
`Inter`, `Poppins`, `Montserrat`, `Lato`, `Nunito`, `Open Sans`, `Roboto` (cf. `FONT_OPTIONS`).
Pour une touche éditoriale, un serif comme `Playfair Display` est possible **s'il est ajouté** au
chargement des polices — sinon rester sur la liste ci-dessus.

## Identité Clenzy / Baitly (register **product**, pas brand)
- Le booking engine est un **product register** : propre, dense, professionnel — **pas** de marketing tape-à-l'œil.
- Palette de référence Clenzy : primaire `#6B8A9A` (bleu-gris) ; accents validés `#4A9B8E`, `#D4A574`,
  `#C97A7A`, `#7BA3C2`. Un template **peut** s'en écarter pour coller au contexte (cf. brief), tant que
  le résultat reste cohérent et accessible.

## Lois & interdits (skill Impeccable) — à respecter
**Interdits absolus** : side-stripe coloré > 1px · texte en dégradé · glassmorphism par défaut ·
template « hero-metric » · grille de 3 cartes identiques génériques · `#000`/`#fff` purs (teinter vers le hue).
**Red flags** : cyan-on-dark, dégradés purple→blue, glow néon, tout centré, `border-radius` uniforme partout,
em dashes décoratifs, copy « Elevate / Seamless / Unleash ».

## Checklist accessibilité (pré-livraison)
- [ ] Contraste texte ≥ 4.5:1 (clair).
- [ ] Pas de `#000`/`#fff` purs (tinter vers le hue du thème).
- [ ] `tabular-nums` déjà géré par le CSS pour les valeurs numériques.
- [ ] Responsive pensé 375 / 768 / 1024 / 1440 (utiliser overrides `@mobile`/`@tablet` + `hide*` si besoin).
- [ ] Hiérarchie typographique claire (titres vs corps), pas tout en gras.
