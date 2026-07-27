/**
 * Couleurs du chip de canal (pastille « Airbnb », « Vrbo »… du planning et de
 * la liste des réservations).
 *
 * **Référence unique.** Cette fonction existait à l'identique dans
 * `PanelReservationInfo` et `ReservationStatusChip` — deux modules différents,
 * donc deux endroits à penser à chaque nouveau canal. Elle est ici, dans
 * `utils/`, plutôt que dans l'un des deux modules : aucun des deux n'a de
 * raison de dépendre de l'autre.
 *
 * Les tokens vivent dans `theme/signature/tokens.css` et suivent le thème
 * clair/sombre. Un canal inconnu retombe sur le gris neutre — c'est ce qui
 * permet d'élargir le vocabulaire sans rien casser à l'écran.
 */
export interface ChannelChipTokens {
  bg: string;
  color: string;
}

const NEUTRAL: ChannelChipTokens = { bg: 'var(--field)', color: 'var(--muted)' };

const TOKENS: Record<string, ChannelChipTokens> = {
  airbnb: { bg: 'var(--airbnb-soft)', color: 'var(--airbnb-ink)' },
  booking: { bg: 'var(--booking-soft)', color: 'var(--booking-ink)' },
  vrbo: { bg: 'var(--vrbo-soft)', color: 'var(--vrbo-ink)' },
  expedia: { bg: 'var(--expedia-soft)', color: 'var(--expedia-ink)' },
  // « Direct » est un canal de marque : ses tokens suivent l'accent de session.
  direct: { bg: 'var(--direct-soft)', color: 'var(--direct-ink)' },
};

/** Insensible à la casse : « DIRECT » a existé en base. */
export function getChannelChipTokens(source: string | null | undefined): ChannelChipTokens {
  if (!source) return NEUTRAL;
  return TOKENS[source.toLowerCase()] ?? NEUTRAL;
}
