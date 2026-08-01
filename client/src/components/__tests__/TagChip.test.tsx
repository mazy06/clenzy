import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import TagChip from '../TagChip';

/**
 * TagChip remplace le `Chip` de MUI dans les `<Autocomplete multiple>`. Le
 * risque n'est pas visuel : c'est que le contrat clavier des tags disparaisse
 * en silence, parce qu'il n'est ecrit nulle part dans `useAutocomplete` — la
 * moitie vit dans le composant `Chip`, qu'on retire.
 *
 * Ces tests fixent ce contrat. Ils echoueraient si l'on perdait
 * `data-tag-index`, `tabIndex`, ou la suppression au relachement de touche.
 */

function Champ({ onChange = () => {} }: { onChange?: (v: string[]) => void }) {
  const [val, setVal] = React.useState(['alpha@x.fr', 'beta@x.fr']);
  return (
    <Autocomplete
      multiple
      freeSolo
      options={[]}
      value={val}
      onChange={(_, v) => { setVal(v as string[]); onChange(v as string[]); }}
      renderTags={(items, getTagProps) =>
        items.map((option, index) => {
          const { key, ...tagProps } = getTagProps({ index });
          return <TagChip key={key} {...tagProps} label={option} />;
        })
      }
      renderInput={(params) => <TextField {...params} label="Emails" />}
    />
  );
}

describe('TagChip dans un Autocomplete multiple', () => {
  it('porte data-tag-index et reste focalisable par programme', () => {
    render(<Champ />);
    const tags = document.querySelectorAll('[data-tag-index]');
    expect(tags).toHaveLength(2);
    // useAutocomplete focalise un tag via
    // anchorEl.querySelector('[data-tag-index="N"]').focus() : sans tabIndex,
    // l'appel est sans effet et la navigation entre tags est perdue.
    expect((tags[0] as HTMLElement).tabIndex).toBe(-1);
    (tags[1] as HTMLElement).focus();
    expect(document.activeElement).toBe(tags[1]);
  });

  it('la fleche gauche depuis le champ donne le focus au dernier tag', () => {
    render(<Champ />);
    const input = screen.getByLabelText('Emails');
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(document.querySelector('[data-tag-index="1"]'));
  });

  it('fleche puis Retour arriere retire le tag vise, UNE seule fois', () => {
    const onChange = vi.fn();
    render(<Champ onChange={onChange} />);
    const input = screen.getByLabelText('Emails');
    input.focus();

    // Deux fois a gauche : le tag vise est le PREMIER. Le chemin compte — le
    // `focusedTag` de useAutocomplete est un etat interne que seules ses
    // propres fleches renseignent ; un `.focus()` programmatique le laisse a
    // -1, et la racine retomberait sur le dernier tag.
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    const vise = document.activeElement as HTMLElement;
    expect(vise.getAttribute('data-tag-index')).toBe('0');

    // La suppression appartient a la racine de l'Autocomplete, qui traite la
    // touche a l'appui pendant que l'evenement remonte depuis le tag.
    fireEvent.keyDown(vise, { key: 'Backspace' });
    expect(onChange).toHaveBeenCalledWith(['beta@x.fr']);

    // Et TagChip ne doit surtout pas en refaire une au relachement : ce serait
    // deux entrees retirees pour une frappe.
    fireEvent.keyUp(vise, { key: 'Backspace' });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('la croix retire le tag et reste hors de l ordre de tabulation', () => {
    const onChange = vi.fn();
    render(<Champ onChange={onChange} />);
    const croix = screen.getAllByRole('button', { name: 'Retirer' })[0];
    // Comme la croix de MUI : cliquable, mais on ne traverse pas une croix par
    // tag avant d'atteindre le champ suivant.
    expect((croix as HTMLElement).tabIndex).toBe(-1);
    fireEvent.click(croix);
    expect(onChange).toHaveBeenCalledWith(['beta@x.fr']);
  });
});
