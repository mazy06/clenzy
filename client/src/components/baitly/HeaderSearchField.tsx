import { SearchIcon, XIcon } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '../ui';

/**
 * Baitly — remaster de components/HeaderSearchField.tsx (MUI), construit
 * sur InputGroup : icône loupe en tête, bouton d'effacement quand rempli.
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
