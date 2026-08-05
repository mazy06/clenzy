import { SearchIcon, XIcon } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '../ui';

/**
 * Gabarit du champ de recherche — FIXTURE DE GALERIE UNIQUEMENT.
 *
 * <p>Aucun écran de l'application ne dessine son champ de recherche : il est
 * rendu une seule fois par le `PageHeader`, via `components/GlobalSearchField`.
 * Un écran s'y branche avec `useScreenSearch` (ou le pont
 * `components/HeaderSearchField`, qui ne rend rien).</p>
 *
 * <p>Ce composant ne subsiste que pour montrer le gabarit dans la bibliothèque
 * UI. Ne pas l'importer dans un écran — ce serait un SECOND champ de recherche
 * à côté de celui du header.</p>
 */
export interface HeaderSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function HeaderSearchField({
  value,
  onChange,
  placeholder = 'Rechercher…',
  className,
}: HeaderSearchFieldProps) {
  return (
    <InputGroup className={className}>
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="search"
      />
      {value !== '' && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton aria-label="Effacer" size="icon-xs" onClick={() => onChange('')}>
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
