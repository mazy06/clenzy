import React from 'react';
import { Badge } from '../../../components/ui';

// ─── Props ───────────────────────────────────────────────────────────────────

interface GridSectionProps {
  title: string;
  subtitle?: string;
  badge?: number;
  children: React.ReactNode;
}

// ─── Classes stables ────────────────────────────────────────────────────────

/** Surtitre de section : rôle « overline » de l'échelle Baitly UI. */
const SECTION_TITLE_CLASS =
  'text-2xs font-bold uppercase tracking-[0.05em] text-faint leading-[1.2]';

const SUBTITLE_CLASS = 'text-2xs text-muted-foreground mt-[1.5px] leading-[1.2]';

// ─── Component ──────────────────────────────────────────────────────────────

const GridSection: React.FC<GridSectionProps> = React.memo(({
  title,
  subtitle,
  badge,
  children,
}) => (
  // `@container` : declare ICI, une seule fois, pour toutes les sections
  // analytiques. Leurs grilles internes decident de leur nombre de colonnes a
  // partir de la largeur de CETTE section, et non de celle de l'ecran.
  //
  // C'est necessaire parce que ReportDetails place plusieurs de ces sections
  // dans des colonnes DEMI-LARGEUR (`min-[900px]:col-span-6`). Avec des seuils
  // de viewport, un ecran de 1000 px declenchait la mise en page « large » —
  // trois colonnes — dans une boite d'environ 500 px, soit ~160 px par colonne.
  <div className="@container mb-3">
    {/* Header */}
    <div className="flex items-center mb-1">
      <p className={SECTION_TITLE_CLASS}>{title}</p>
      {badge !== undefined && badge > 0 && (
        <Badge
          variant="destructive"
          className="min-w-[18px] h-[18px] rounded-full px-[3px] ms-[4.5px] text-[9px] font-bold tabular-nums"
        >
          {badge}
        </Badge>
      )}
    </div>
    {subtitle && (
      <p className={SUBTITLE_CLASS}>{subtitle}</p>
    )}

    {/* Grid content (children handle their own Grid layout) */}
    <div className="mt-1">
      {children}
    </div>
  </div>
));

GridSection.displayName = 'GridSection';

export default GridSection;
