import { STATUS_TONES } from '../../components/StatusChip';
// Constantes de style partagées par ChannelsPage et ses vues (liste / grille) + sous-sections.
// Les anciens gabarits `sx` (CARD_SX, OTA_CARD_SX, OTA_CARD_CONTENT_SX, STATUS_CHIP_SX,
// OVERLINE_SX) ont disparu avec MUI : chaque vue porte désormais ses classes Baitly UI.

/**
 * Fond doux de la pastille logo par canal. Les canaux tokenisés (Airbnb,
 * Booking) utilisent leurs tokens `--airbnb-soft` / `--booking-soft` ;
 * les autres restent sur le fond neutre du champ (la couleur de MARQUE
 * vit dans le logo lui-même, jamais dans la surface).
 */
export function channelSoftBg(channelId: string): string {
  if (channelId === 'airbnb') return 'var(--airbnb-soft)';
  if (channelId === 'booking') return 'var(--booking-soft)';
  return 'var(--bui-field)';
}

/**
 * Tons de statut d'un canal, pour la primitive StatusChip.
 *
 * `muted` s'ecarte du ton neutre partage : le fond est celui d'un champ
 * (`--bui-field`) et non le survol, pour se detacher de la ligne de tableau.
 */
export const STATUS_CHIP_TOKENS = {
  ok: STATUS_TONES.ok,
  warn: STATUS_TONES.warn,
  err: STATUS_TONES.err,
  muted: { color: 'var(--bui-muted-foreground)', bg: 'var(--bui-field)' },
} as const;

/** Gabarit historique de ces puces : 10,5 px, graisse 700. */
export const STATUS_CHIP_CLASS = 'text-[10.5px] font-bold';
