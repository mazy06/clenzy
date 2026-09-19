import React from 'react';
import type { ReservationStatus, ReservationSource } from '../../services/api/reservationsApi';
import { RESERVATION_SOURCE_LABELS } from '../../services/api/reservationsApi';
import { getSourceLogo } from '../planning/utils/sourceLogos';
import { getChannelChipTokens } from '../../utils/channelChipTokens';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';

/**
 * Statut et source d'une réservation, SANS pastille.
 *
 * <p>Les deux colonnes se suivent dans le tableau. Chacune portait un aplat
 * coloré sur CHAQUE ligne : deux murs de pastel côte à côte, qui pesaient plus
 * que les dates et le montant qu'on vient y lire. La couleur revient donc à
 * une marque de 7 px pour le statut, et au logo du canal pour la source — elle
 * ne sert plus de fond, seulement de repère.</p>
 *
 * <p>Au passage, un vrai défaut disparaît : l'encre du statut « Confirmée »
 * était un BRUN (#7A5230, palette du planning, calibrée pour ses fonds sable)
 * posé sur le vert de {@code --ok-soft}. Les deux viennent désormais de la même
 * famille sémantique.</p>
 */

/**
 * La FORME dit l'état, pas seulement la couleur : marque pleine tant que le
 * séjour est devant ou en cours, creuse une fois qu'il est derrière. Un coup
 * d'œil sur la colonne sépare l'actif du clos sans lire un mot.
 */
const STATUS_TONE: Record<string, { ink: string; hollow?: boolean }> = {
  confirmed: { ink: 'var(--bui-success-ink)' },
  pending: { ink: 'var(--bui-warning-ink)' },
  checked_in: { ink: 'var(--bui-info-ink)' },
  checked_out: { ink: 'var(--bui-muted-foreground)', hollow: true },
  cancelled: { ink: 'var(--bui-destructive-ink)', hollow: true },
};

const NEUTRAL_TONE = { ink: 'var(--bui-muted-foreground)', hollow: true };

interface StatusChipProps {
  status: ReservationStatus;
}

export const ReservationStatusChip: React.FC<StatusChipProps> = ({ status }) => {
  const { t } = useTranslation();
  const tone = STATUS_TONE[status] ?? NEUTRAL_TONE;
  const label = t(`reservations.status.${status}`) as string;

  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span
        aria-hidden
        className="size-[7px] shrink-0 rounded-full"
        style={
          tone.hollow
            ? { boxShadow: `inset 0 0 0 1.5px ${tone.ink}` }
            : { backgroundColor: tone.ink }
        }
      />
      <span className="text-xs font-medium" style={{ color: tone.ink }}>
        {label}
      </span>
    </span>
  );
};

interface SourceBadgeProps {
  source: ReservationSource;
}

export const ReservationSourceBadge: React.FC<SourceBadgeProps> = ({ source }) => {
  const label = RESERVATION_SOURCE_LABELS[source] ?? source;
  const logo = getSourceLogo(source);
  /* Réservé aux canaux SANS logo — une réservation directe n'en a pas. La
     pastille des canaux reste la source de vérité de leur couleur. */
  const tokens = getChannelChipTokens(source);

  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      {/* Boîte de largeur fixe, logo ou pas : les libellés de la colonne
          s'alignent, sinon « Direct » partait seul de trois pixels à gauche. */}
      <span aria-hidden className="flex size-4 shrink-0 items-center justify-center">
        {logo ? (
          <img className="block size-4 object-contain" src={logo} alt="" />
        ) : (
          <span
            className="size-[7px] rounded-full"
            style={{ backgroundColor: tokens.color }}
          />
        )}
      </span>
      <span className={cn('text-xs font-medium text-foreground')}>{label}</span>
    </span>
  );
};
