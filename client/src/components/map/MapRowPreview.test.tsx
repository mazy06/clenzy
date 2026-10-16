import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Popover, PopoverAnchor, PopoverTrigger } from '../ui';
import MapRowPreview from './MapRowPreview';
import { MapCardCoordinator, useMapCardClaim } from './MapCardCoordinator';

vi.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));

function Fixture() {
  return <><div data-testid="list" style={{ overflowY: 'auto', height: 200 }}>
    <Popover><PopoverAnchor asChild><div data-map-preview-anchor>
      <PopoverTrigger asChild><button>Ouvrir</button></PopoverTrigger>
    </div></PopoverAnchor>
    <MapRowPreview label="Prestataire" side="end">
      <div data-testid="preview-scroll" style={{ overflowY: 'auto', height: 100 }}>Informations</div>
    </MapRowPreview></Popover>
  </div><div data-testid="other-list" /></>;
}

it('closes on source-list scrolling without restoring focus or changing its scroll position', () => {
  render(<Fixture />);
  const trigger = screen.getByRole('button', { name: 'Ouvrir' });
  fireEvent.click(trigger);
  expect(screen.getByRole('dialog')).toBeTruthy();
  const focus = vi.spyOn(trigger, 'focus');
  const list = screen.getByTestId('list');
  list.scrollTop = 120;
  fireEvent.scroll(list);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(list.scrollTop).toBe(120);
  expect(focus).not.toHaveBeenCalled();
  fireEvent.click(trigger);
  expect(screen.getByRole('dialog')).toBeTruthy();
});

it('allows scrolling inside the preview and in unrelated lists', async () => {
  render(<Fixture />);
  fireEvent.click(screen.getByRole('button', { name: 'Ouvrir' }));
  fireEvent.scroll(screen.getByTestId('preview-scroll'));
  fireEvent.scroll(screen.getByTestId('other-list'));
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.scroll(window);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

it('opens a list preview and a native map popup exclusively in either order', () => {
  let claim: ReturnType<typeof useMapCardClaim>;
  function MapPopup() { claim = useMapCardClaim(); return null; }
  render(<MapCardCoordinator><MapPopup /><Fixture /></MapCardCoordinator>);
  fireEvent.click(screen.getByRole('button', { name: 'Ouvrir' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  const closeNativePopup = vi.fn();
  let releaseNativePopup: () => void;
  act(() => { releaseNativePopup = claim(closeNativePopup); });
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Ouvrir' }));
  expect(closeNativePopup).toHaveBeenCalledOnce();
  expect(screen.getByRole('dialog')).toBeTruthy();
  // La fermeture tardive de l'ancienne bulle ne libère pas la nouvelle fiche.
  act(() => releaseNativePopup());
  act(() => { claim(vi.fn()); });
  expect(screen.queryByRole('dialog')).toBeNull();
});
