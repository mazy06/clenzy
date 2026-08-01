import { STATUS_TONES } from '../../components/StatusChip';
// Constantes de style partagées par ChannelsPage et ses vues (liste / grille) + sous-sections.
// Alignées sur le référentiel Signature (DESIGN_BASELINE) : cartes plates hairline r14,
// hover bordure --line-2 uniquement (pas d'ombre au repos, pas de lift).

export const CARD_SX = {
  border: '1px solid',
  borderColor: 'var(--line)',
  bgcolor: 'var(--card)',
  boxShadow: 'none',
  borderRadius: '14px',
  p: 2,
} as const;

export const OTA_CARD_SX = {
  border: '1px solid',
  borderColor: 'var(--line)',
  bgcolor: 'var(--card)',
  borderRadius: '14px',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  transition: 'border-color 0.18s cubic-bezier(.16,1,.3,1)',
  cursor: 'default',
  '&:hover': {
    borderColor: 'var(--line-2)',
  },
} as const;

export const OTA_CARD_CONTENT_SX = {
  p: 2.5,
  display: 'flex',
  flexDirection: 'column',
  gap: 1.5,
  flex: 1,
} as const;

/**
 * Fond doux de la pastille logo par canal. Les canaux tokenisés (Airbnb,
 * Booking) utilisent leurs tokens `--airbnb-soft` / `--booking-soft` ;
 * les autres restent sur le fond neutre `--field` (la couleur de MARQUE
 * vit dans le logo lui-même, jamais dans la surface).
 */
export function channelSoftBg(channelId: string): string {
  if (channelId === 'airbnb') return 'var(--airbnb-soft)';
  if (channelId === 'booking') return 'var(--booking-soft)';
  return 'var(--field)';
}

/** Chip de statut -soft (pattern Signature : texte couleur + fond -soft). */
/**
 * Tons de statut d'un canal, pour la primitive StatusChip.
 *
 * `muted` s'ecarte du ton neutre partage : le fond est `--field` (surface de
 * champ) et non `--hover`, pour se detacher de la ligne de tableau.
 */
export const STATUS_CHIP_TOKENS = {
  ok: STATUS_TONES.ok,
  warn: STATUS_TONES.warn,
  err: STATUS_TONES.err,
  muted: { color: 'var(--muted)', bg: 'var(--field)' },
} as const;

/** Gabarit historique de ces puces : 10,5 px, graisse 700. */
export const STATUS_CHIP_CLASS = 'text-[10.5px] font-bold';

export const STATUS_CHIP_SX = {
  ok: {
    fontSize: '10.5px',
    height: 22,
    fontWeight: 700,
    backgroundColor: 'var(--ok-soft)',
    color: 'var(--ok)',
    border: 'none',
    '& .MuiChip-icon': { color: 'var(--ok)' },
  },
  warn: {
    fontSize: '10.5px',
    height: 22,
    fontWeight: 700,
    backgroundColor: 'var(--warn-soft)',
    color: 'var(--warn)',
    border: 'none',
    '& .MuiChip-icon': { color: 'var(--warn)' },
  },
  err: {
    fontSize: '10.5px',
    height: 22,
    fontWeight: 700,
    backgroundColor: 'var(--err-soft)',
    color: 'var(--err)',
    border: 'none',
    '& .MuiChip-icon': { color: 'var(--err)' },
  },
  muted: {
    fontSize: '10.5px',
    height: 22,
    fontWeight: 700,
    backgroundColor: 'var(--field)',
    color: 'var(--muted)',
    border: 'none',
    '& .MuiChip-icon': { color: 'var(--muted)' },
  },
} as const;

/** Entête de colonne / label overline (10.5px fw700 uppercase --faint). */
export const OVERLINE_SX = {
  fontSize: '10.5px',
  fontWeight: 700,
  color: 'var(--faint)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
} as const;
