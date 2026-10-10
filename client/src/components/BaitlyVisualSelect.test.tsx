import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BaitlyPropertySelect from './BaitlyPropertySelect';
import ServiceItemSelect, { serviceReferenceQuery } from './ServiceItemSelect';

afterEach(cleanup);
const properties = [
  { id: 7, name: 'Villa Atlas', city: 'Marrakech', coverPhotoUrl: '/api/properties/7/photo' },
  { id: 8, name: 'Studio Jemmapes', city: 'Paris' },
];
it('shows the selected housing thumbnail and city, with a fallback when the photo fails', () => {
  const { container } = render(<BaitlyPropertySelect properties={properties} value="7" onChange={vi.fn()}
    label="Lieu" allPlaces="Tous les lieux" empty="Aucun logement" />);
  expect(screen.getByRole('combobox', { name: 'Lieu' })).toHaveValue('Villa Atlas | Marrakech');
  const image = container.querySelector('img')!;
  expect(image.src).toContain('/api/properties/7/photo');
  fireEvent.error(image);
  expect(container.querySelector('img')).toBeNull();
  expect(screen.getByRole('combobox', { name: 'Lieu' })).toHaveValue('Villa Atlas | Marrakech');
});
it('searches housing by city and selects it using the keyboard', async () => {
  const onChange = vi.fn();
  render(<BaitlyPropertySelect properties={properties} value="" onChange={onChange}
    label="Lieu" allPlaces="Tous les lieux" empty="Aucun logement" />);
  const input = screen.getByRole('combobox', { name: 'Lieu' });
  act(() => input.focus());
  fireEvent.change(input, { target: { value: 'Paris' } });
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  const option = await screen.findByRole('option', { name: /Studio Jemmapes.*Paris/ });
  expect(screen.queryByRole('option', { name: /Villa Atlas/ })).not.toBeInTheDocument();
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(onChange).toHaveBeenCalledWith('8'));
  expect(option).toHaveTextContent('Studio Jemmapes | Paris');
});
it('shows generated sector images in the selected service and in the choices', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(serviceReferenceQuery.queryKey, [
    { code: 'cleaning-mid-stay', labelFr: 'Ménage en cours de séjour', labelEn: 'Mid-stay cleaning', legacyType: 'CLEANING', categoryCode: 'CLEANING' },
    { code: 'culinary-breakfast', labelFr: 'Petit-déjeuner', labelEn: 'Breakfast', legacyType: 'OTHER', categoryCode: 'CULINARY' },
  ]);
  const onChange = vi.fn();
  const { container } = render(<QueryClientProvider client={client}><ServiceItemSelect value="cleaning-mid-stay" onChange={onChange} /></QueryClientProvider>);
  expect(container.querySelector('img')?.src).toContain('cleaning.webp');
  const input = screen.getByRole('combobox');
  act(() => input.focus());
  fireEvent.change(input, { target: { value: 'Petit' } });
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  const option = await screen.findByRole('option', { name: 'Petit-déjeuner' });
  expect(option.querySelector('img')?.src).toContain('via-cooking.webp');
  fireEvent.click(option);
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ code: 'culinary-breakfast' }));
});
