import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../utils/cn';
import StatusChip, { STATUS_TONES, type ToneTokens } from '../../../components/StatusChip';

export type SoftTokens = ToneTokens;

export const OK_TOKENS: SoftTokens = STATUS_TONES.ok;
export const WARN_TOKENS: SoftTokens = STATUS_TONES.warn;
export const ERR_TOKENS: SoftTokens = STATUS_TONES.err;
export const INFO_TOKENS: SoftTokens = STATUS_TONES.info;
export const NEUTRAL_TOKENS: SoftTokens = STATUS_TONES.neutral;

/** Statuts paiement → tokens sémantiques (succès = ok, attente = warn, en cours = info, échec = err). */
export const STATUS_TOKENS: Record<string, SoftTokens> = {
  PAID: OK_TOKENS,
  PENDING: WARN_TOKENS,
  REFUNDED: ERR_TOKENS,
  DRAFT: NEUTRAL_TOKENS,
  ISSUED: INFO_TOKENS,
  PROCESSING: INFO_TOKENS,
  FAILED: ERR_TOKENS,
  CANCELLED: NEUTRAL_TOKENS,
};

const OVERLINE_CLASS = 'text-xs font-medium uppercase tracking-[0.05em] text-[var(--bui-muted-foreground)]';

// ── Section wrapper — carte hairline, titre overline, badge chip soft ───────
export const SectionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  badge: string;
  badgeTokens: SoftTokens;
  children: React.ReactNode;
}> = ({ icon, title, badge, badgeTokens, children }) => (
  <div className="border border-[var(--bui-border)] bg-[var(--bui-card)] rounded-[12px] p-2">
    <div className="flex items-center gap-1.5 mb-2">
      {icon}
      <p className={cn(OVERLINE_CLASS, 'cn-text-body2 flex-1')}>
        {title}
      </p>
      <StatusChip pill tokens={{ color: badgeTokens.color, bg: badgeTokens.bg }} label={badge} />
    </div>
    {children}
  </div>
);

// ── Status chip helper — résout le ton via la map domaine puis délègue au
//    StatusChip partagé (taille sm), rayon pilule conservé. ──────────────────
export const DomainStatusChip: React.FC<{ status: string; map?: Record<string, string>; tokenMap?: Record<string, SoftTokens> }> = ({
  status,
  map,
  tokenMap = STATUS_TOKENS,
}) => {
  // Sans table fournie, le statut est un statut de PAIEMENT : il se traduit
  // ici. La table était naguère un objet de module, figé en français.
  const { t } = useTranslation();
  const label = map
    ? map[status] || status
    : t(`planning.panel.fin.statuses.${status}`, status);

  return (
    <StatusChip
      tokens={tokenMap[status] || NEUTRAL_TOKENS}
      label={label}
      size="sm"
      sx={{ borderRadius: 'var(--radius-pill)' }}
    />
  );
};

// ── Row helper ──────────────────────────────────────────────────────────────
export const FinRow: React.FC<{
  label: string;
  value: React.ReactNode;
  bold?: boolean;
  color?: string;
  secondary?: boolean;
  children?: React.ReactNode;
}> = ({ label, value, bold, color, secondary, children }) => (
  <div className="flex justify-between items-center mb-0.5">
    <p className={cn('cn-text-body2 text-[0.8125rem]', secondary !== false && 'text-[var(--bui-muted-foreground)]')}>
      {label}
    </p>
    <div className="flex items-center gap-1.5">
      {/* `color` et `bold` sont des props : leur valeur n'existe qu'a
          l'execution, donc style inline et non classes Tailwind. */}
      <p
        className="cn-text-body2 font-semibold text-[0.8125rem] tabular-nums"
        style={{
          color: color || 'var(--ink)',
          ...(bold && { fontFamily: 'var(--font-display)' }),
        }}
      >
        {value}
      </p>
      {children}
    </div>
  </div>
);
