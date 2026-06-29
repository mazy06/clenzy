/**
 * Secteurs EXHAUSTIFS du Style Manager du Studio : toute la grammaire de design CSS, éditable par élément
 * sélectionné sur le canvas. Les propriétés de MARQUE (couleurs, police, échelle typo, interlignes,
 * tracking, espacements, rayons, ombres, transitions) utilisent le type custom `bt-value` (menu de tokens
 * `--bt-*` + saisie libre) → mapping explicite avec le design généré par l'IA. Le reste = widgets standards
 * GrapesJS (saisie/sélecteur/curseur natifs) pour un contrôle total.
 *
 * Le champ `tokens` (groupe de `designTokenCatalog`) est une clé custom lue par `registerBtValueType`.
 */

interface StyleProp {
  property: string;
  name: string;
  type?: string;
  tokens?: string;
  units?: string[];
  default?: string;
  options?: { id: string; label: string }[];
  properties?: StyleProp[];
}
interface StyleSector {
  name: string;
  open: boolean;
  properties: StyleProp[];
}

/** Champ combiné token + valeur libre (type custom `bt-value`). */
const bt = (property: string, name: string, tokens: string): StyleProp => ({ property, name, type: 'bt-value', tokens });

/** Sélecteur d'énumération CSS (option vide « — » en tête = hérité/non défini). */
const sel = (property: string, name: string, values: string[], def = ''): StyleProp => ({
  property, name, type: 'select', default: def,
  options: [{ id: '', label: '—' }, ...values.map((v) => ({ id: v, label: v }))],
});

/** Champ numérique avec unités (saisie libre + unité). */
const num = (property: string, name: string, units: string[] = ['px', '%', 'rem', 'em', 'vw', 'vh']): StyleProp => ({
  property, name, type: 'number', units, default: '',
});

/** Champ texte libre (valeur CSS quelconque). */
const txt = (property: string, name: string): StyleProp => ({ property, name, type: 'text', default: '' });

export const STYLE_SECTORS: StyleSector[] = [
  {
    name: 'Typographie',
    open: true,
    properties: [
      bt('font-family', 'Police', 'font'),
      bt('font-size', 'Taille', 'text'),
      bt('font-weight', 'Graisse', 'weight'),
      bt('line-height', 'Interligne', 'leading'),
      bt('letter-spacing', 'Tracking', 'tracking'),
      bt('color', 'Couleur', 'color'),
      sel('text-align', 'Alignement', ['left', 'center', 'right', 'justify']),
      sel('text-transform', 'Casse', ['none', 'uppercase', 'lowercase', 'capitalize']),
      sel('font-style', 'Style', ['normal', 'italic']),
      sel('text-decoration', 'Décoration', ['none', 'underline', 'line-through']),
      sel('white-space', 'Retour ligne', ['normal', 'nowrap', 'pre', 'pre-wrap']),
    ],
  },
  {
    name: 'Dimensions',
    open: false,
    properties: [
      num('width', 'Largeur'),
      num('height', 'Hauteur'),
      num('min-width', 'Largeur min'),
      num('max-width', 'Largeur max'),
      num('min-height', 'Hauteur min'),
      num('max-height', 'Hauteur max'),
      sel('box-sizing', 'Box sizing', ['content-box', 'border-box']),
    ],
  },
  {
    name: 'Espacement',
    open: false,
    properties: [
      {
        property: 'padding', name: 'Padding', type: 'composite',
        properties: [
          bt('padding-top', 'Haut', 'space'), bt('padding-right', 'Droite', 'space'),
          bt('padding-bottom', 'Bas', 'space'), bt('padding-left', 'Gauche', 'space'),
        ],
      },
      {
        property: 'margin', name: 'Marge', type: 'composite',
        properties: [
          num('margin-top', 'Haut', ['px', '%', 'rem', 'em', 'auto']), num('margin-right', 'Droite', ['px', '%', 'rem', 'em', 'auto']),
          num('margin-bottom', 'Bas', ['px', '%', 'rem', 'em', 'auto']), num('margin-left', 'Gauche', ['px', '%', 'rem', 'em', 'auto']),
        ],
      },
      bt('gap', 'Gap', 'space'),
      bt('row-gap', 'Gap (lignes)', 'space'),
      bt('column-gap', 'Gap (colonnes)', 'space'),
    ],
  },
  {
    name: 'Disposition',
    open: false,
    properties: [
      sel('display', 'Display', ['block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'none']),
      sel('flex-direction', 'Direction', ['row', 'row-reverse', 'column', 'column-reverse']),
      sel('flex-wrap', 'Wrap', ['nowrap', 'wrap', 'wrap-reverse']),
      sel('justify-content', 'Justify', ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly']),
      sel('align-items', 'Align items', ['stretch', 'flex-start', 'center', 'flex-end', 'baseline']),
      sel('align-content', 'Align content', ['stretch', 'flex-start', 'center', 'flex-end', 'space-between', 'space-around']),
      num('flex-grow', 'Flex grow', ['']),
      num('flex-shrink', 'Flex shrink', ['']),
      txt('flex-basis', 'Flex basis'),
      num('order', 'Ordre', ['']),
      txt('grid-template-columns', 'Grid colonnes'),
      txt('grid-template-rows', 'Grid lignes'),
    ],
  },
  {
    name: 'Position',
    open: false,
    properties: [
      sel('position', 'Position', ['static', 'relative', 'absolute', 'fixed', 'sticky']),
      num('top', 'Haut'),
      num('right', 'Droite'),
      num('bottom', 'Bas'),
      num('left', 'Gauche'),
      num('z-index', 'Z-index', ['']),
      sel('float', 'Float', ['none', 'left', 'right']),
      sel('overflow', 'Overflow', ['visible', 'hidden', 'scroll', 'auto']),
    ],
  },
  {
    name: 'Fond',
    open: false,
    properties: [
      bt('background-color', 'Couleur de fond', 'color'),
      txt('background-image', 'Image (url/gradient)'),
      sel('background-size', 'Taille', ['auto', 'cover', 'contain']),
      sel('background-position', 'Position', ['center', 'top', 'bottom', 'left', 'right']),
      sel('background-repeat', 'Répétition', ['no-repeat', 'repeat', 'repeat-x', 'repeat-y']),
      sel('background-attachment', 'Attachement', ['scroll', 'fixed', 'local']),
    ],
  },
  {
    name: 'Bordure',
    open: false,
    properties: [
      num('border-width', 'Épaisseur'),
      sel('border-style', 'Style', ['none', 'solid', 'dashed', 'dotted', 'double']),
      bt('border-color', 'Couleur', 'color'),
      {
        property: 'border-radius', name: 'Rayon', type: 'composite',
        properties: [
          bt('border-top-left-radius', 'Haut-gauche', 'radius'), bt('border-top-right-radius', 'Haut-droite', 'radius'),
          bt('border-bottom-right-radius', 'Bas-droite', 'radius'), bt('border-bottom-left-radius', 'Bas-gauche', 'radius'),
        ],
      },
      txt('outline', 'Outline'),
    ],
  },
  {
    name: 'Effets',
    open: false,
    properties: [
      bt('box-shadow', 'Ombre', 'shadow'),
      num('opacity', 'Opacité', ['']),
      txt('filter', 'Filtre'),
      txt('backdrop-filter', 'Filtre fond'),
      txt('transform', 'Transform'),
      txt('transition', 'Transition'),
      bt('transition-duration', 'Durée transition', 'duration'),
      sel('cursor', 'Curseur', ['auto', 'pointer', 'default', 'not-allowed', 'text', 'move', 'grab']),
    ],
  },
];
