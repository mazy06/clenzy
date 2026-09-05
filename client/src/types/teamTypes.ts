import type { StatusTone } from '../components/StatusChip';

/**
 * Vocabulaire des types d'équipe.
 *
 * <p>Une équipe porte un type PROPRE — `CLEANING`, `MAINTENANCE`, `OTHER` —
 * qui n'est PAS un {@link InterventionType}. La carte d'équipe interrogeait
 * pourtant `INTERVENTION_TYPE_OPTIONS`, où `MAINTENANCE` n'existe pas : la
 * recherche échouait, le libellé retombait sur la valeur brute de l'enum (d'où
 * « MAINTENANCE » en capitales à côté de « Nettoyage »), et la couleur sur le
 * gris par défaut au lieu de l'ambre. Vingt-deux équipes étaient concernées.</p>
 *
 * <p>La rangée de filtres de la liste tenait déjà la bonne définition, en
 * double. Elle vit désormais ici, une seule fois, pour que le filtre et la
 * carte ne puissent plus diverger.</p>
 *
 * <p>Les teintes sont des JETONS, pas des hexadécimaux : elles suivent donc le
 * thème clair comme le sombre. Ce sont des teintes VIVES, réservées aux
 * pastilles, bordures et aplats — jamais au texte, qui prendrait 2,4:1.</p>
 */
export type TeamTypeValue = 'CLEANING' | 'MAINTENANCE' | 'OTHER';

export interface TeamTypeOption {
  value: TeamTypeValue;
  label: string;
  /**
   * Ton sémantique, à donner à `StatusChip` via `tone`.
   *
   * <p>Surtout PAS via `color` : cette prop porte la teinte fournie dans le
   * texte ET dans la pastille, et une teinte vive en texte sur son propre
   * pastel plafonne vers 2,4:1. Avec `tone`, le libellé prend l'encre `-ink`
   * et seule la pastille reste vive — le couple que décrit le contrat.</p>
   */
  tone: StatusTone;
  /**
   * Jeton de teinte VIVE. Réservé aux bordures, aplats et mélanges — jamais
   * au texte.
   */
  token: string;
  /**
   * Variante `-ink`, pour une pastille posée à MÊME le fond de carte.
   *
   * <p>La teinte vive convient à une pastille sur fond `-soft`, mais sur le
   * blanc de la carte elle tombe à 2,2–2,5:1 et paraît délavée. L'encre y tient
   * 5,3 à 9,0:1 selon le thème.</p>
   */
  inkToken: string;
}

export const TEAM_TYPE_OPTIONS: TeamTypeOption[] = [
  { value: 'CLEANING', label: 'Nettoyage', tone: 'ok',
    token: 'var(--bui-success)', inkToken: 'var(--bui-success-ink)' },
  { value: 'MAINTENANCE', label: 'Maintenance', tone: 'warn',
    token: 'var(--bui-warning)', inkToken: 'var(--bui-warning-ink)' },
  { value: 'OTHER', label: 'Autre', tone: 'info',
    token: 'var(--bui-info)', inkToken: 'var(--bui-info-ink)' },
];

const FALLBACK: TeamTypeOption = {
  value: 'OTHER',
  label: 'Autre',
  tone: 'info',
  token: 'var(--bui-info)',
  inkToken: 'var(--bui-info-ink)',
};

/**
 * Option correspondant au type d'une équipe.
 *
 * <p>Un type inconnu retombe sur « Autre » plutôt que d'afficher la valeur
 * brute de la base : une chaîne d'enum en capitales n'est pas un libellé.</p>
 */
export function teamTypeOption(value: string | null | undefined): TeamTypeOption {
  if (!value) return FALLBACK;
  return TEAM_TYPE_OPTIONS.find((option) => option.value === value) ?? FALLBACK;
}
