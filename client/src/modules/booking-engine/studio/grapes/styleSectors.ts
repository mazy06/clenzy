import i18n from '../../../../i18n/config';
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
    name: i18n.t('studioStyle.sectors.typography'),
    open: true,
    properties: [
      bt('font-family', i18n.t('studioStyle.props.fontFamily'), 'font'),
      bt('font-size', i18n.t('studioStyle.props.fontSize'), 'text'),
      bt('font-weight', i18n.t('studioStyle.props.fontWeight'), 'weight'),
      bt('line-height', i18n.t('studioStyle.props.lineHeight'), 'leading'),
      bt('letter-spacing', i18n.t('studioStyle.props.letterSpacing'), 'tracking'),
      bt('color', i18n.t('studioStyle.props.color'), 'color'),
      sel('text-align', i18n.t('studioStyle.props.textAlign'), ['left', 'center', 'right', 'justify']),
      sel('text-transform', i18n.t('studioStyle.props.textTransform'), ['none', 'uppercase', 'lowercase', 'capitalize']),
      sel('font-style', i18n.t('studioStyle.props.fontStyle'), ['normal', 'italic']),
      sel('text-decoration', i18n.t('studioStyle.props.textDecoration'), ['none', 'underline', 'line-through']),
      sel('white-space', i18n.t('studioStyle.props.whiteSpace'), ['normal', 'nowrap', 'pre', 'pre-wrap']),
    ],
  },
  {
    name: i18n.t('studioStyle.sectors.dimensions'),
    open: false,
    properties: [
      num('width', i18n.t('studioStyle.props.width')),
      num('height', i18n.t('studioStyle.props.height')),
      num('min-width', i18n.t('studioStyle.props.minWidth')),
      num('max-width', i18n.t('studioStyle.props.maxWidth')),
      num('min-height', i18n.t('studioStyle.props.minHeight')),
      num('max-height', i18n.t('studioStyle.props.maxHeight')),
      sel('box-sizing', i18n.t('studioStyle.props.boxSizing'), ['content-box', 'border-box']),
    ],
  },
  {
    name: i18n.t('studioStyle.sectors.spacing'),
    open: false,
    properties: [
      {
        property: 'padding', name: i18n.t('studioStyle.props.padding'), type: 'composite',
        properties: [
          bt('padding-top', i18n.t('studioStyle.props.paddingTop'), 'space'), bt('padding-right', i18n.t('studioStyle.props.paddingRight'), 'space'),
          bt('padding-bottom', i18n.t('studioStyle.props.paddingBottom'), 'space'), bt('padding-left', i18n.t('studioStyle.props.paddingLeft'), 'space'),
        ],
      },
      {
        property: 'margin', name: i18n.t('studioStyle.props.margin'), type: 'composite',
        properties: [
          num('margin-top', i18n.t('studioStyle.props.marginTop'), ['px', '%', 'rem', 'em', 'auto']), num('margin-right', i18n.t('studioStyle.props.marginRight'), ['px', '%', 'rem', 'em', 'auto']),
          num('margin-bottom', i18n.t('studioStyle.props.marginBottom'), ['px', '%', 'rem', 'em', 'auto']), num('margin-left', i18n.t('studioStyle.props.marginLeft'), ['px', '%', 'rem', 'em', 'auto']),
        ],
      },
      bt('gap', i18n.t('studioStyle.props.gap'), 'space'),
      bt('row-gap', i18n.t('studioStyle.props.rowGap'), 'space'),
      bt('column-gap', i18n.t('studioStyle.props.columnGap'), 'space'),
    ],
  },
  {
    name: i18n.t('studioStyle.sectors.layout'),
    open: false,
    properties: [
      sel('display', i18n.t('studioStyle.props.display'), ['block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'none']),
      sel('flex-direction', i18n.t('studioStyle.props.flexDirection'), ['row', 'row-reverse', 'column', 'column-reverse']),
      sel('flex-wrap', i18n.t('studioStyle.props.flexWrap'), ['nowrap', 'wrap', 'wrap-reverse']),
      sel('justify-content', i18n.t('studioStyle.props.justifyContent'), ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly']),
      sel('align-items', i18n.t('studioStyle.props.alignItems'), ['stretch', 'flex-start', 'center', 'flex-end', 'baseline']),
      sel('align-content', i18n.t('studioStyle.props.alignContent'), ['stretch', 'flex-start', 'center', 'flex-end', 'space-between', 'space-around']),
      num('flex-grow', i18n.t('studioStyle.props.flexGrow'), ['']),
      num('flex-shrink', i18n.t('studioStyle.props.flexShrink'), ['']),
      txt('flex-basis', i18n.t('studioStyle.props.flexBasis')),
      num('order', i18n.t('studioStyle.props.order'), ['']),
      txt('grid-template-columns', i18n.t('studioStyle.props.gridTemplateColumns')),
      txt('grid-template-rows', i18n.t('studioStyle.props.gridTemplateRows')),
    ],
  },
  {
    name: i18n.t('studioStyle.sectors.position'),
    open: false,
    properties: [
      sel('position', i18n.t('studioStyle.props.position'), ['static', 'relative', 'absolute', 'fixed', 'sticky']),
      num('top', i18n.t('studioStyle.props.top')),
      num('right', i18n.t('studioStyle.props.right')),
      num('bottom', i18n.t('studioStyle.props.bottom')),
      num('left', i18n.t('studioStyle.props.left')),
      num('z-index', i18n.t('studioStyle.props.zIndex'), ['']),
      sel('float', i18n.t('studioStyle.props.float'), ['none', 'left', 'right']),
      sel('overflow', i18n.t('studioStyle.props.overflow'), ['visible', 'hidden', 'scroll', 'auto']),
    ],
  },
  {
    name: i18n.t('studioStyle.sectors.background'),
    open: false,
    properties: [
      bt('background-color', i18n.t('studioStyle.props.backgroundColor'), 'color'),
      txt('background-image', i18n.t('studioStyle.props.backgroundImage')),
      sel('background-size', i18n.t('studioStyle.props.backgroundSize'), ['auto', 'cover', 'contain']),
      sel('background-position', i18n.t('studioStyle.props.backgroundPosition'), ['center', 'top', 'bottom', 'left', 'right']),
      sel('background-repeat', i18n.t('studioStyle.props.backgroundRepeat'), ['no-repeat', 'repeat', 'repeat-x', 'repeat-y']),
      sel('background-attachment', i18n.t('studioStyle.props.backgroundAttachment'), ['scroll', 'fixed', 'local']),
    ],
  },
  {
    name: i18n.t('studioStyle.sectors.border'),
    open: false,
    properties: [
      num('border-width', i18n.t('studioStyle.props.borderWidth')),
      sel('border-style', i18n.t('studioStyle.props.borderStyle'), ['none', 'solid', 'dashed', 'dotted', 'double']),
      bt('border-color', i18n.t('studioStyle.props.borderColor'), 'color'),
      {
        property: 'border-radius', name: i18n.t('studioStyle.props.borderRadius'), type: 'composite',
        properties: [
          bt('border-top-left-radius', i18n.t('studioStyle.props.borderTopLeftRadius'), 'radius'), bt('border-top-right-radius', i18n.t('studioStyle.props.borderTopRightRadius'), 'radius'),
          bt('border-bottom-right-radius', i18n.t('studioStyle.props.borderBottomRightRadius'), 'radius'), bt('border-bottom-left-radius', i18n.t('studioStyle.props.borderBottomLeftRadius'), 'radius'),
        ],
      },
      txt('outline', i18n.t('studioStyle.props.outline')),
    ],
  },
  {
    name: i18n.t('studioStyle.sectors.effects'),
    open: false,
    properties: [
      bt('box-shadow', i18n.t('studioStyle.props.boxShadow'), 'shadow'),
      num('opacity', i18n.t('studioStyle.props.opacity'), ['']),
      txt('filter', i18n.t('studioStyle.props.filter')),
      txt('backdrop-filter', i18n.t('studioStyle.props.backdropFilter')),
      txt('transform', i18n.t('studioStyle.props.transform')),
      txt('transition', i18n.t('studioStyle.props.transition')),
      bt('transition-duration', i18n.t('studioStyle.props.transitionDuration'), 'duration'),
      sel('cursor', i18n.t('studioStyle.props.cursor'), ['auto', 'pointer', 'default', 'not-allowed', 'text', 'move', 'grab']),
    ],
  },
];
