// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders as render, screen, fireEvent, within } from '../../../test/renderWithProviders';
import { ACTION_ILLUSTRATIONS, ACTION_TYPE_ILLUSTRATIONS, AGENT_ILLUSTRATIONS, actionIllustration } from '../core/actionIllustration';
import { ACTION_REGISTRY } from '../components/actionRegistry';
import { ActionIllustratedHeading } from '../components/ActionIllustration';
import { PendingActionCard } from '../components/PendingActionCard';
import { ConstellationQueue } from '../components/ConstellationQueue';
import { TaskDeckQueue } from '../components/TaskDeckQueue';
import { ActionConfirmModal } from '../components/ActionConfirmModal';
import type { PendingAction } from '../types';

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null, loading: false }) }));

const item = (patch: Partial<PendingAction> = {}): PendingAction => ({
  id: 'illustrated', agentId: 'sync', title: 'No-show possible (réservation #532)',
  motif: 'Arrivée attendue, sans message du voyageur.', reasoning: '',
  createdAt: '2026-10-01T10:00:00Z', expiresAt: '2099-10-01T10:00:00Z',
  applyActionType: 'NOSHOW_MARK', ...patch,
});
const noop = () => {};

describe('Bibliothèque des vignettes HITL', () => {
  it('couvre chaque type déclaré par le serveur et le registre des actions', () => {
    const source = readFileSync(resolve(process.cwd(), '../server/src/main/java/com/clenzy/service/agent/supervision/SupervisionActionType.java'), 'utf8');
    const serverTypes = [...source.matchAll(/public static final String \w+\s*=\s*"([^"]+)"/g)].map((match) => match[1]);
    expect(serverTypes.length).toBeGreaterThanOrEqual(46);
    for (const type of [...serverTypes, ...Object.keys(ACTION_REGISTRY)]) {
      expect(ACTION_TYPE_ILLUSTRATIONS, type).toHaveProperty(type);
    }
  });

  it('livre des fichiers WebP locaux valides et légers pour toutes les vignettes', () => {
    for (const source of Object.values(ACTION_ILLUSTRATIONS)) {
      expect(source).toMatch(/^\/images\/(hitl|notifications)\/[a-z-]+\.webp$/);
      const file = readFileSync(resolve(process.cwd(), 'public', source.slice(1)));
      expect(file.subarray(0, 4).toString()).toBe('RIFF');
      expect(file.subarray(8, 12).toString()).toBe('WEBP');
      expect(file.byteLength).toBeLessThan(35_000);
    }
  });

  it.each([
    ['NOSHOW_MARK', 'no-show'], ['TAX_MARK_FILED', 'tourist-tax'], ['GUIDE_SEND', 'welcome-guide'],
    ['OWNER_PAYOUT', 'owner-transfer'], ['CLEANING_PAYOUT', 'service-transfer'],
    ['LOCK_BATTERY_REPLACE', 'maintenance'], ['PREVENTIVE_MAINTENANCE', 'property-maintenance'],
  ])('reconnaît %s indépendamment du texte ou de la langue', (applyActionType, visual) => {
    expect(actionIllustration(item({ applyActionType, title: 'عنوان', motif: 'Some other translated description.' }))).toBe(visual);
  });

  it('identifie les cartes informatives, paiements et anciens rappels', () => {
    expect(actionIllustration(item({ applyActionType: undefined, sourceTool: 'guest_instructions_missing' }))).toBe('welcome-guide');
    expect(actionIllustration(item({ opensGuestCard: true }))).toBe('traveler-form');
    expect(actionIllustration(item({ kind: 'payment', applyActionType: undefined }))).toBe('payment');
    expect(actionIllustration(item({ kind: 'reminder', id: 'payout-reminder-12', applyActionType: undefined }))).toBe('owner-transfer');
  });

  it('ne devine aucune hausse depuis le titre ou des paramètres illisibles', () => {
    for (const actionParams of [undefined, '{broken', 'null', '[]', '{"direction":"unexpected"}']) {
      expect(actionIllustration(item({ applyActionType: 'PRICE_DROP', title: 'Relever les tarifs', actionParams })))
        .toBe('pricing-optimization');
    }
    expect(actionIllustration(item({ applyActionType: 'PRICE_DROP', actionParams: '{"direction":"up"}' })))
      .toBe('pricing-increase');
    expect(actionIllustration(item({ applyActionType: 'YIELD_PRICE_ADJUST', actionParams: '{"percent":15}' })))
      .toBe('pricing-increase');
    expect(actionIllustration(item({ applyActionType: 'YIELD_PRICE_ADJUST', actionParams: '{"percent":-15}' })))
      .toBe('pricing-optimization');
  });

  it('garantit un repli local pour chaque agent et les futurs types inconnus', () => {
    for (const [agentId, visual] of Object.entries(AGENT_ILLUSTRATIONS)) {
      expect(actionIllustration(item({ agentId: agentId as PendingAction['agentId'], applyActionType: 'NEW_TYPE' }))).toBe(visual);
    }
    for (const type of ['__proto__', 'constructor', 'https://example.test/pixel']) {
      expect(actionIllustration(item({ applyActionType: type, sourceTool: type }))).toBe('channel-sync');
    }
    expect(actionIllustration()).toBe('approval');
  });

  it('préserve la photo de produit unique dans les réassorts', () => {
    const stock = item({ agentId: 'ops', title: 'Stock bas : Capsules café (2 restant)', applyActionType: 'LINEN_STOCK_ORDER',
      motif: 'Seuil de 3 atteint. « Commander » envoie le bon de commande (9 boîtes) à Cafés Belleville — le réassort se confirme ensuite dans la fiche du logement.',
      actionParams: '{"stockItemId":7}',
    });
    const { container } = render(<PendingActionCard action={stock} onValidate={noop} onEdit={noop} />);
    expect(actionIllustration(stock)).toBeNull();
    expect(container.querySelector('.baitly-action-illustration')).toBeNull();
    const photos = container.querySelectorAll<HTMLElement>('.baitly-stock-thumbnail');
    expect(photos).toHaveLength(1);
    expect(photos[0].dataset.catalogKey).not.toBe('custom');
    expect(photos[0].style.backgroundImage).toContain('/images/stock/');
    expect(screen.getByText('2 restants')).toBeVisible();
  });

  it('garde le titre accessible si une image échoue et recharge une nouvelle source', () => {
    const { container, rerender } = render(<ActionIllustratedHeading action={item()}><h3>Réservation à vérifier</h3></ActionIllustratedHeading>);
    const image = container.querySelector('img')!;
    expect(image).toHaveAttribute('alt', '');
    expect(image.parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('width', '80');
    fireEvent.error(image);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Réservation à vérifier' })).toBeVisible();
    rerender(<ActionIllustratedHeading action={item({ applyActionType: 'GUIDE_SEND' })}><h3>Livret</h3></ActionIllustratedHeading>);
    expect(container.querySelector('img')).toHaveAttribute('src', '/images/hitl/welcome-guide.webp');
  });
});

const surfaces = [
  { name: 'constellation', render: (action: PendingAction, onOpen: () => void, onValidate: () => void) =>
    <ConstellationQueue agent="sync" actions={[action]} onValidate={onValidate} onEdit={noop} onOpenActionModal={onOpen} /> },
  { name: 'liste', render: (action: PendingAction, onOpen: () => void, onValidate: () => void) =>
    <PendingActionCard action={action} onValidate={onValidate} onEdit={noop} onOpenActionModal={onOpen} /> },
  { name: 'pile', render: (action: PendingAction, onOpen: () => void, onValidate: () => void) =>
    <TaskDeckQueue actions={[action]} onValidate={onValidate} onEdit={noop} onOpenActionModal={onOpen} /> },
];
describe.each(surfaces)('Vignettes et décisions : $name', (surface) => {
  it('conserve la même image dans la carte et sa confirmation sans exécuter au premier clic', () => {
    const onOpen = vi.fn(), onValidate = vi.fn(), onConfirm = vi.fn();
    const action = item();
    const { container } = render(surface.render(action, onOpen, onValidate));
    expect(container.querySelector('.baitly-action-illustration img')).toHaveAttribute('src', '/images/hitl/no-show.webp');
    expect(container).toHaveTextContent(action.title);
    fireEvent.click(screen.getByRole('button', { name: /Marquer no-show/ }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onValidate).not.toHaveBeenCalled();
    render(<ActionConfirmModal action={action} onClose={noop} onConfirm={onConfirm} />);
    const modal = screen.getByRole('dialog');
    expect(modal.querySelector('.baitly-action-illustration img')).toHaveAttribute('src', '/images/hitl/no-show.webp');
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(within(modal).getByRole('button', { name: 'Marquer', exact: true }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
