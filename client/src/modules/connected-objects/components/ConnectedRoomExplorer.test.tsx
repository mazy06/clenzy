import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConnectedRoomExplorer from './ConnectedRoomExplorer';
import type { ConnectedDevice } from '../types';

vi.mock('../../../hooks/useUserPreference', () => ({ useUserPreference: (_key: string, initial: unknown) => { const [value, setValue] = useState(initial); return [value, setValue, { isLoaded: true }]; } }));
vi.mock('../../../hooks/useViewportFill', () => ({ useViewportFill: () => [() => undefined, 650] }));
vi.mock('./PropertyAccessCodeChip', () => ({ default: () => null }));
vi.mock('./RoomDeviceInspector', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, DeviceState: () => null }));

const device: ConnectedDevice = { uid: 'contact:1', id: 1, kind: 'contact', name: 'Fenêtre du salon', roomName: 'Salon', propertyId: 1, propertyName: 'Logement test', provider: 'TUYA', online: true, statusLevel: 'warning', statusLabel: 'Ouverte', actions: ['view'], raw: { contactOpen: true } };
const props = { group: { propertyId: 1, propertyName: 'Logement test', devices: [device] }, property: { bedroomCount: 2, bathroomCount: 1 }, kindFilter: '' as const, actingUid: null, onAction: vi.fn(), onAdd: vi.fn() };
afterEach(cleanup);

describe('room exploration', () => {
  it('changes the room illustration with sensor state and never operates a device by selecting it', () => {
    const { rerender } = render(<ConnectedRoomExplorer {...props} />);
    fireEvent.click(screen.getByTitle('Salon'));
    const image = screen.getByRole('img', { name: 'Illustration de la pièce : Salon' });
    expect(image).toHaveAttribute('src', expect.stringContaining('living-window-open.webp'));
    fireEvent.load(image);
    fireEvent.click(within(screen.getByRole('group', { name: 'Équipements placés dans la pièce' })).getByRole('button'));
    expect(props.onAction).not.toHaveBeenCalled();
    rerender(<ConnectedRoomExplorer {...props} group={{ ...props.group, devices: [{ ...device, raw: { contactOpen: false } }] }} />);
    expect(screen.getByRole('img', { name: 'Illustration de la pièce : Salon' })).toHaveAttribute('src', '/images/connected-rooms/baitly-living.webp');
  });
  it('keeps opening state independent from the type filter', () => {
    render(<ConnectedRoomExplorer {...props} kindFilter="lock" />);
    fireEvent.click(screen.getByTitle('Salon'));
    expect(screen.getByRole('img', { name: 'Illustration de la pièce : Salon' })).toHaveAttribute('src', expect.stringContaining('window-open'));
    expect(screen.getByText('Aucun objet de ce type')).toBeInTheDocument();
  });
  it('offers multiple bedrooms and their different bed illustrations', () => {
    render(<ConnectedRoomExplorer {...props} />);
    fireEvent.click(screen.getByTitle('Chambre 2'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Décor de la chambre' }), { target: { value: 'bedroom-bunk' } });
    expect(screen.getByRole('img', { name: 'Illustration de la pièce : Chambre 2' })).toHaveAttribute('src', expect.stringContaining('bedroom-bunk.webp'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Ajouter dans cette pièce' })[0]);
    expect(props.onAdd).toHaveBeenCalledWith({ propertyId: 1, roomName: 'Chambre 2' });
  });
  it('keeps device selection available if the image fails to load', () => {
    render(<ConnectedRoomExplorer {...props} />);
    fireEvent.click(screen.getByTitle('Salon'));
    fireEvent.error(screen.getByRole('img', { name: 'Illustration de la pièce : Salon' }));
    expect(screen.getByRole('status')).toHaveTextContent('L’illustration est indisponible');
    expect(within(screen.getByRole('group', { name: 'Sélectionner un équipement' })).getByRole('button')).toBeEnabled();
  });
});
