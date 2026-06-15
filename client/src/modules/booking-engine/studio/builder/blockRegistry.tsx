import type { CSSProperties, ReactNode } from 'react';
import {
  LayoutPanelTop,
  LayoutGrid,
  Sparkles,
  AlignLeft,
  Quote,
  MousePointerClick,
  PanelBottom,
  Check,
  Search,
  type LucideIcon,
} from 'lucide-react';
// Feuille de base des blocs : classes `bkly-*` surchargeables par du CSS custom (Phase A).
// Importée ici → injectée partout où les blocs sont rendus (canvas Studio, aperçu, page publique).
import './blockStyles.css';

/**
 * Registre de blocs du Baitly Studio (F2). Chaque type de bloc déclare : son libellé, son icône,
 * ses props par défaut, les champs éditables (consommés par l'inspector) et son rendu canvas.
 * Le rendu est volontairement React (preview fidèle « assez ») ; l'alignement pixel-perfect avec
 * le rendu public (widget / site SSR) viendra quand les composants de rendu seront partagés.
 */

export type BlockType =
  | 'hero'
  | 'propertyGrid'
  | 'amenities'
  | 'richText'
  | 'testimonial'
  | 'cta'
  | 'footer';

export type FieldType = 'text' | 'textarea' | 'number' | 'toggle' | 'select' | 'color' | 'url' | 'image';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  /** Pour `number` : bornes du champ. */
  min?: number;
  max?: number;
  placeholder?: string;
  /** Pour `select` : choix proposés. */
  options?: { value: string; label: string }[];
}

export type BlockProps = Record<string, string | number | boolean>;

/** Options d'alignement réutilisées par les blocs. */
const ALIGN_OPTIONS = [
  { value: 'left', label: 'Gauche' },
  { value: 'center', label: 'Centré' },
  { value: 'right', label: 'Droite' },
];

/** Champs granulaires communs (alignement, fond) — édition par bloc (2.4). */
const ALIGN_FIELD: FieldDef = { key: 'align', label: 'Alignement', type: 'select', options: ALIGN_OPTIONS };
const BG_COLOR_FIELD: FieldDef = { key: 'bgColor', label: 'Couleur de fond', type: 'color' };

/**
 * Overrides inline par bloc à partir des props granulaires (align / bgColor / bgImage).
 * Appliqués sur la racine `bkly-*` → priment sur les défauts de blockStyles.css.
 */
function sectionStyle(p: BlockProps): CSSProperties {
  const style: CSSProperties = {};
  if (p.align) style.textAlign = p.align as CSSProperties['textAlign'];
  if (p.bgImage) {
    style.backgroundImage = `url("${String(p.bgImage)}")`;
    style.backgroundSize = 'cover';
    style.backgroundPosition = 'center';
  } else if (p.bgColor) {
    style.background = String(p.bgColor);
  }
  return style;
}

export interface BlockDef {
  type: BlockType;
  label: string;
  description: string;
  icon: LucideIcon;
  defaultProps: BlockProps;
  fields: FieldDef[];
  render: (props: BlockProps) => ReactNode;
}

/** Découpe un champ multi-lignes en items non vides. */
function lines(value: unknown): string[] {
  return String(value ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

const HERO: BlockDef = {
  type: 'hero',
  label: 'Bannière',
  description: 'Titre, accroche et barre de recherche.',
  icon: LayoutPanelTop,
  defaultProps: {
    eyebrow: 'Location courte durée',
    title: 'Votre prochain séjour commence ici',
    subtitle: 'Réservez en direct, sans frais cachés, en quelques clics.',
    showSearch: true,
  },
  fields: [
    { key: 'eyebrow', label: 'Sur-titre', type: 'text' },
    { key: 'title', label: 'Titre', type: 'text' },
    { key: 'subtitle', label: 'Accroche', type: 'textarea' },
    { key: 'showSearch', label: 'Afficher la recherche', type: 'toggle' },
    ALIGN_FIELD,
    BG_COLOR_FIELD,
    { key: 'bgImage', label: 'Image de fond (URL)', type: 'image' },
  ],
  render: (p) => (
    <div className="bkly-section bkly-hero" style={sectionStyle(p)}>
      {p.eyebrow ? <div className="bkly-hero__eyebrow">{String(p.eyebrow)}</div> : null}
      <div className="bkly-hero__title">{String(p.title)}</div>
      {p.subtitle ? <div className="bkly-hero__subtitle">{String(p.subtitle)}</div> : null}
      {p.showSearch ? (
        <a href="#reserver" className="bkly-hero__search">
          <span className="bkly-hero__search-icon"><Search size={18} strokeWidth={2} /></span>
          <span className="bkly-hero__search-text">Quand souhaitez-vous partir ?</span>
          <span className="bkly-hero__search-btn">Rechercher</span>
        </a>
      ) : null}
    </div>
  ),
};

const PROPERTY_GRID: BlockDef = {
  type: 'propertyGrid',
  label: 'Grille de logements',
  description: 'Vos biens en cartes, sur N colonnes.',
  icon: LayoutGrid,
  defaultProps: {
    heading: 'Nos logements',
    subheading: 'Une sélection prête à réserver.',
    columns: 3,
  },
  fields: [
    { key: 'heading', label: 'Titre', type: 'text' },
    { key: 'subheading', label: 'Sous-titre', type: 'text' },
    { key: 'columns', label: 'Colonnes', type: 'number', min: 1, max: 4 },
    BG_COLOR_FIELD,
  ],
  render: (p) => {
    const cols = Math.min(4, Math.max(1, Number(p.columns) || 3));
    return (
      <div className="bkly-section bkly-property-grid" style={sectionStyle(p)}>
        <div className="bkly-property-grid__heading">{String(p.heading)}</div>
        {p.subheading ? <div className="bkly-property-grid__subheading">{String(p.subheading)}</div> : null}
        <div className="bkly-property-grid__list" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="bkly-property-card">
              <div className="bkly-property-card__image" />
              <div className="bkly-property-card__body">
                <div className="bkly-property-card__line" />
                <div className="bkly-property-card__line bkly-property-card__line--sub" />
                <div className="bkly-property-card__price">120 € <span className="bkly-property-card__price-unit">/ nuit</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
};

const AMENITIES: BlockDef = {
  type: 'amenities',
  label: 'Équipements',
  description: 'Liste à puces des atouts (une ligne par item).',
  icon: Sparkles,
  defaultProps: {
    heading: 'Tout est prévu',
    items: 'Wi-Fi fibre\nParking gratuit\nCheck-in autonome\nCuisine équipée',
  },
  fields: [
    { key: 'heading', label: 'Titre', type: 'text' },
    { key: 'items', label: 'Équipements (un par ligne)', type: 'textarea' },
    BG_COLOR_FIELD,
  ],
  render: (p) => (
    <div className="bkly-section bkly-amenities" style={sectionStyle(p)}>
      <div className="bkly-amenities__heading">{String(p.heading)}</div>
      <div className="bkly-amenities__list">
        {lines(p.items).map((item, i) => (
          <div key={i} className="bkly-amenities__item">
            <span className="bkly-amenities__icon"><Check size={13} strokeWidth={2.5} /></span>
            {item}
          </div>
        ))}
      </div>
    </div>
  ),
};

const RICH_TEXT: BlockDef = {
  type: 'richText',
  label: 'Texte',
  description: 'Un bloc de texte libre.',
  icon: AlignLeft,
  defaultProps: {
    content: 'Décrivez votre maison, votre quartier, ce qui rend le séjour unique.',
  },
  fields: [
    { key: 'content', label: 'Contenu', type: 'textarea' },
    ALIGN_FIELD,
    BG_COLOR_FIELD,
  ],
  render: (p) => (
    <div className="bkly-section bkly-rich-text" style={sectionStyle(p)}>
      <div className="bkly-rich-text__content">{String(p.content)}</div>
    </div>
  ),
};

const TESTIMONIAL: BlockDef = {
  type: 'testimonial',
  label: 'Témoignage',
  description: 'Une citation client.',
  icon: Quote,
  defaultProps: {
    quote: 'Séjour parfait, hôte aux petits soins. On revient l’an prochain.',
    author: 'Camille D., Lyon',
  },
  fields: [
    { key: 'quote', label: 'Citation', type: 'textarea' },
    { key: 'author', label: 'Auteur', type: 'text' },
    ALIGN_FIELD,
    BG_COLOR_FIELD,
  ],
  render: (p) => (
    <div className="bkly-section bkly-testimonial" style={sectionStyle(p)}>
      <Quote size={28} strokeWidth={2} className="bkly-testimonial__icon" />
      <div className="bkly-testimonial__quote">« {String(p.quote)} »</div>
      {p.author ? <div className="bkly-testimonial__author">{String(p.author)}</div> : null}
    </div>
  ),
};

const CTA: BlockDef = {
  type: 'cta',
  label: 'Appel à l’action',
  description: 'Bandeau de conversion.',
  icon: MousePointerClick,
  defaultProps: {
    title: 'Prêt à réserver votre séjour ?',
    buttonLabel: 'Voir les disponibilités',
  },
  fields: [
    { key: 'title', label: 'Titre', type: 'text' },
    { key: 'buttonLabel', label: 'Bouton', type: 'text' },
    { key: 'buttonUrl', label: 'Lien du bouton (défaut : réservation)', type: 'url' },
    ALIGN_FIELD,
    BG_COLOR_FIELD,
  ],
  render: (p) => (
    <div className="bkly-section bkly-cta" style={sectionStyle(p)}>
      <div className="bkly-cta__title">{String(p.title)}</div>
      <a href={p.buttonUrl ? String(p.buttonUrl) : '#reserver'} className="bkly-cta__button">{String(p.buttonLabel)}</a>
    </div>
  ),
};

const FOOTER: BlockDef = {
  type: 'footer',
  label: 'Pied de page',
  description: 'Mentions et liens de bas de page.',
  icon: PanelBottom,
  defaultProps: {
    text: '© Votre conciergerie — Réservation directe sécurisée',
  },
  fields: [
    { key: 'text', label: 'Texte', type: 'text' },
    BG_COLOR_FIELD,
  ],
  render: (p) => (
    <div className="bkly-section bkly-footer" style={sectionStyle(p)}>
      {String(p.text)}
    </div>
  ),
};

export const BLOCK_REGISTRY: Record<BlockType, BlockDef> = {
  hero: HERO,
  propertyGrid: PROPERTY_GRID,
  amenities: AMENITIES,
  richText: RICH_TEXT,
  testimonial: TESTIMONIAL,
  cta: CTA,
  footer: FOOTER,
};

/** Ordre d'apparition dans la bibliothèque de blocs. */
export const BLOCK_ORDER: BlockType[] = ['hero', 'propertyGrid', 'amenities', 'richText', 'testimonial', 'cta', 'footer'];

export function getBlockDef(type: BlockType): BlockDef {
  return BLOCK_REGISTRY[type];
}

/** Bloc prêt au rendu (structurellement identique à BlockInstance du builder). */
export interface ParsedBlock {
  id: string;
  type: BlockType;
  props: BlockProps;
}

/**
 * Parse un layout JSON persisté (liste de {type, props}) en blocs prêts au rendu.
 * Tolérant : entrées invalides ou types inconnus ignorés ; props complétées par les défauts.
 * Utilisé par le rendu public (page hébergée) et réutilisable par le builder.
 */
export function parsePageLayout(json: string | null | undefined): ParsedBlock[] {
  if (!json) return [];
  try {
    const arr: unknown = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((b): b is { type: BlockType; props?: BlockProps } =>
        !!b && typeof (b as { type?: unknown }).type === 'string' && (b as { type: string }).type in BLOCK_REGISTRY)
      .map((b, i) => ({ id: `p${i}`, type: b.type, props: { ...getBlockDef(b.type).defaultProps, ...(b.props ?? {}) } }));
  } catch {
    return [];
  }
}
