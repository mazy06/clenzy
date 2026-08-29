// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders as render, screen, fireEvent, waitFor } from '../../../test/renderWithProviders';
import { ActionInspectionModal } from '../components/ActionInspectionModal';
import type { PendingAction } from '../types';

/**
 * Contrôler un travail rendu, c'est regarder les pièces. La modale les
 * résumait — « 3 photos jointes » — et renvoyait vers un autre écran pour les
 * voir : personne n'y allait, et la validation se faisait à l'aveugle.
 */

const action = (): PendingAction => ({
  id: 'pa-9',
  agentId: 'ops',
  title: 'Ménage rendu — 12 rue des Lilas',
  motif: 'Travail soumis',
  reasoning: '',
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 4 * 3_600_000).toISOString(),
  applyActionType: 'WORK_REVIEW',
  actionParams: JSON.stringify({ interventionId: 97 }),
});

const preview = (photos: string[]) => ({
  channel: null,
  recipients: [],
  subject: null,
  body: null,
  bodyRendered: false,
  facts: [`${photos.length} photos jointes au travail rendu.`],
  blocked: null,
  options: [],
  photos,
});

const PHOTOS = ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB', 'data:image/jpeg;base64,CCC'];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(preview(PHOTOS)),
  }));
});
afterEach(() => vi.unstubAllGlobals());

const noop = () => {};

describe('<ActionInspectionModal> — les pièces', () => {
  it('affiche une vignette par photo, pas un décompte', async () => {
    render(<ActionInspectionModal action={action()} onClose={noop} onApprove={noop} onReject={noop} />);

    await waitFor(() => expect(screen.getAllByRole('button', { name: /Agrandir la photo/ })).toHaveLength(3));
    const imgs = document.querySelectorAll('img');
    expect(Array.from(imgs).map((i) => i.getAttribute('src'))).toEqual(PHOTOS);
  });

  it('cliquer une vignette montre la pièce en grand', async () => {
    render(<ActionInspectionModal action={action()} onClose={noop} onApprove={noop} onReject={noop} />);

    await waitFor(() => screen.getAllByRole('button', { name: /Agrandir la photo/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Agrandir la photo 2' }));

    expect(screen.getByAltText('Photo 2 sur 3')).toBeTruthy();
    expect(screen.getByText('2 / 3')).toBeTruthy();
  });

  it('parcourt les pièces en boucle sans revenir à la grille', async () => {
    render(<ActionInspectionModal action={action()} onClose={noop} onApprove={noop} onReject={noop} />);

    await waitFor(() => screen.getAllByRole('button', { name: /Agrandir la photo/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Agrandir la photo 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Photo suivante' }));

    // La dernière pièce suivie de la première : sinon le bouton semble cassé.
    expect(screen.getByAltText('Photo 1 sur 3')).toBeTruthy();
  });

  it('sans photo jointe, n’affiche aucune grille', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(preview([])),
    }));
    render(<ActionInspectionModal action={action()} onClose={noop} onApprove={noop} onReject={noop} />);

    await waitFor(() => expect(screen.getByText(/0 photos jointes/)).toBeTruthy());
    expect(screen.queryByRole('button', { name: /Agrandir la photo/ })).toBeNull();
  });
});
