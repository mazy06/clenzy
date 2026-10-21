import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useForm } from 'react-hook-form';
import type { ServiceRequestFormValues } from '../../schemas';
import ServiceRequestFormAssignment from './ServiceRequestFormAssignment';

vi.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);
function Example({ disabled = false }: { disabled?: boolean }) {
  const { control, setValue, watch } = useForm<ServiceRequestFormValues>({ defaultValues: { assignedToType: 'team', assignedToId: 89 } });
  return <><ServiceRequestFormAssignment control={control} setValue={setValue} errors={{}}
    watchedAssignedToType={watch('assignedToType')} isEditMode canAssignForProperty disabled={disabled}
    users={[]} teams={[{ id: 89, name: 'Équipe de recette', description: '', interventionType: 'OTHER', memberCount: 1 }]} />
    <output aria-label="selected-provider">{watch('assignedToId') ?? 'none'}</output></>;
}
it('conserve le prestataire sélectionné quand le type actif est cliqué à nouveau', () => {
  render(<Example />);
  fireEvent.click(screen.getByRole('radio', { name: /modes.team.title/ }));
  expect(screen.getByLabelText('selected-provider')).toHaveTextContent('89');
  expect(screen.getByRole('combobox')).toHaveTextContent('Équipe de recette');
});
it('efface la cible précédente lors du passage équipe vers individuel, puis retire le sélecteur sans attribution', () => {
  render(<Example />);
  fireEvent.click(screen.getByRole('radio', { name: /modes.user.title/ }));
  expect(screen.getByLabelText('selected-provider')).toHaveTextContent('none');
  expect(screen.getByRole('radio', { name: /modes.user.title/ })).toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: /modes.none.title/ }));
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});
it('désactive les choix et le sélecteur lorsque l’attribution est verrouillée', () => {
  render(<Example disabled />);
  screen.getAllByRole('radio').forEach(radio => expect(radio).toBeDisabled());
  expect(screen.getByRole('combobox')).toBeDisabled();
});
