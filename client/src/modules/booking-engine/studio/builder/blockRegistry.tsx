import type { ReactNode } from 'react';
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

export type FieldType = 'text' | 'textarea' | 'number' | 'toggle';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  /** Pour `number` : bornes du champ. */
  min?: number;
  max?: number;
  placeholder?: string;
}

export type BlockProps = Record<string, string | number | boolean>;

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
  ],
  render: (p) => (
    <div style={{ padding: '64px 40px', textAlign: 'center', background: 'var(--accent-soft)' }}>
      {p.eyebrow ? (
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>
          {String(p.eyebrow)}
        </div>
      ) : null}
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 700, lineHeight: 1.1, color: 'var(--ink)', maxWidth: 620, margin: '0 auto', textWrap: 'balance' }}>
        {String(p.title)}
      </div>
      {p.subtitle ? (
        <div style={{ fontSize: 17, color: 'var(--muted)', maxWidth: 520, margin: '16px auto 0', lineHeight: 1.5 }}>
          {String(p.subtitle)}
        </div>
      ) : null}
      {p.showSearch ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 460, margin: '28px auto 0', padding: '10px 10px 10px 16px', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 999, boxShadow: 'var(--shadow-card)' }}>
          <Search size={18} color="var(--muted)" strokeWidth={2} />
          <span style={{ flex: 1, textAlign: 'left', color: 'var(--faint)', fontSize: 15 }}>Quand souhaitez-vous partir ?</span>
          <span style={{ height: 36, padding: '0 18px', display: 'inline-flex', alignItems: 'center', borderRadius: 999, background: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 600, fontSize: 14 }}>Rechercher</span>
        </div>
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
  ],
  render: (p) => {
    const cols = Math.min(4, Math.max(1, Number(p.columns) || 3));
    return (
      <div style={{ padding: '48px 40px', background: 'var(--bg)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--ink)' }}>{String(p.heading)}</div>
        {p.subheading ? <div style={{ fontSize: 15, color: 'var(--muted)', marginTop: 4 }}>{String(p.subheading)}</div> : null}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16, marginTop: 24 }}>
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--card)' }}>
              <div style={{ height: 120, background: 'var(--field)' }} />
              <div style={{ padding: 14 }}>
                <div style={{ height: 12, width: '70%', borderRadius: 4, background: 'var(--line-2)' }} />
                <div style={{ height: 10, width: '45%', borderRadius: 4, background: 'var(--line)', marginTop: 8 }} />
                <div style={{ marginTop: 14, fontWeight: 700, color: 'var(--ink)', fontSize: 15 }}>120 € <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 13 }}>/ nuit</span></div>
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
  ],
  render: (p) => (
    <div style={{ padding: '48px 40px', background: 'var(--card)' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--ink)', marginBottom: 20 }}>{String(p.heading)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, maxWidth: 560 }}>
        {lines(p.items).map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--body)', fontSize: 15 }}>
            <span style={{ display: 'inline-flex', width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: 'var(--accent-soft)', color: 'var(--accent)', flexShrink: 0 }}>
              <Check size={13} strokeWidth={2.5} />
            </span>
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
  fields: [{ key: 'content', label: 'Contenu', type: 'textarea' }],
  render: (p) => (
    <div style={{ padding: '40px 40px', background: 'var(--bg)' }}>
      <div style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--body)', maxWidth: 640, whiteSpace: 'pre-wrap' }}>{String(p.content)}</div>
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
  ],
  render: (p) => (
    <div style={{ padding: '56px 40px', background: 'var(--accent-soft)', textAlign: 'center' }}>
      <Quote size={28} color="var(--accent)" strokeWidth={2} style={{ marginBottom: 16 }} />
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, lineHeight: 1.4, color: 'var(--ink)', maxWidth: 600, margin: '0 auto', textWrap: 'balance' }}>
        « {String(p.quote)} »
      </div>
      {p.author ? <div style={{ marginTop: 18, fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>{String(p.author)}</div> : null}
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
  ],
  render: (p) => (
    <div style={{ padding: '56px 40px', background: 'var(--accent)', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--on-accent)', textWrap: 'balance' }}>{String(p.title)}</div>
      <span style={{ display: 'inline-flex', alignItems: 'center', height: 46, padding: '0 26px', marginTop: 22, borderRadius: 999, background: 'var(--card)', color: 'var(--accent)', fontWeight: 700, fontSize: 15 }}>
        {String(p.buttonLabel)}
      </span>
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
  fields: [{ key: 'text', label: 'Texte', type: 'text' }],
  render: (p) => (
    <div style={{ padding: '28px 40px', background: 'var(--surface-2, var(--field))', textAlign: 'center', fontSize: 13, color: 'var(--muted)', borderTop: '1px solid var(--line)' }}>
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
