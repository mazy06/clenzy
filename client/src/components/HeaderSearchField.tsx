import { useScreenSearch } from './ScreenChrome';

/**
 * Pont vers la recherche UNIQUE de l'application.
 *
 * L'app n'a plus qu'un seul champ de recherche, rendu en permanence dans le
 * `PageHeader` (cf. `GlobalSearchField`). Ce composant ne dessine donc plus
 * rien : il publie l'état de recherche de l'écran (valeur, placeholder,
 * callback) pour que le champ du header le pilote.
 *
 * Il est conservé pour que les écrans qui l'utilisaient déjà n'aient pas à
 * changer ; du code neuf appellera directement `useScreenSearch`.
 */
interface HeaderSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Entrée dans le champ du header (cf. useScreenSearch). */
  onSubmit?: (value: string) => void;
}

export default function HeaderSearchField({ value, onChange, placeholder, onSubmit }: HeaderSearchFieldProps) {
  useScreenSearch(value, onChange, placeholder, onSubmit);
  return null;
}
