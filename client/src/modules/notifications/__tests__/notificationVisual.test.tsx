// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderWithProviders as render, screen, fireEvent, waitFor } from '../../../test/renderWithProviders';
import type { Notification } from '../../../services/api/notificationsApi';
import { notificationsApi } from '../../../services/api/notificationsApi';
import { propertyStockApi } from '../../../services/api/propertyStockApi';
import { notificationVisual } from '../notificationVisual';
import { NOTIFICATION_ILLUSTRATIONS } from '../notificationArtwork';
import { actionIllustration } from '../../supervision/core/actionIllustration';
import type { PendingAction } from '../../supervision/types';
import { NotificationThumbnail } from '../NotificationThumbnail';
import NotificationsPage from '../NotificationsPage';
import { SidebarProvider } from '../../../components/ui/sidebar';

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({
  user: { id: 'host', organizationId: 7 }, loading: false, isPlatformStaff: () => false,
}) }));
vi.mock('../../../services/api/notificationsApi', () => ({ notificationsApi: {
  resetAvailability: vi.fn(), getPage: vi.fn(), getUnreadCount: vi.fn(), markAsRead: vi.fn(),
  markAllAsRead: vi.fn(), delete: vi.fn(),
} }));
vi.mock('../../../services/api/propertyStockApi', () => ({ propertyStockApi: { visual: vi.fn() } }));

function notification(patch: Partial<Notification> = {}): Notification {
  return { id: 1, userId: 'host', title: 'No-show possible (réservation #532)', message: 'Arrivée attendue, sans message du voyageur.',
    notificationKey: 'SUPERVISION_SUGGESTION', type: 'warning', category: 'system', read: false,
    createdAt: '2026-10-01T10:00:00Z', metadata: { actionType: 'NOSHOW_MARK', module: 'sync' }, ...patch };
}

beforeEach(() => vi.clearAllMocks());

describe('Vignettes des notifications', () => {
  it('couvre chaque notification déclarée par le serveur, même sans métadonnées', () => {
    const source = readFileSync(resolve(process.cwd(), '../server/src/main/java/com/clenzy/model/NotificationKey.java'), 'utf8');
    const keys = [...source.matchAll(/^\s+([A-Z_]+)\(NotificationType\./gm)].map(match => match[1]);
    expect(keys.length).toBeGreaterThanOrEqual(152);
    const missing = keys.filter(notificationKey => !notificationVisual(notification({ notificationKey, metadata: null })));
    expect(missing).toEqual([]);
  });

  it('livre une image WebP locale et légère pour chaque illustration', () => {
    for (const source of Object.values(NOTIFICATION_ILLUSTRATIONS)) {
      expect(source).toMatch(/^\/images\/(hitl|notifications)\/[a-z-]+\.webp$/);
      const bytes = readFileSync(resolve(process.cwd(), 'public', source.slice(1)));
      expect(bytes.subarray(0, 4).toString(), source).toBe('RIFF');
      expect(bytes.subarray(8, 12).toString(), source).toBe('WEBP');
      expect(bytes.byteLength, source).toBeLessThan(35_000);
    }
  });

  it.each([
    ['GUEST_MESSAGE_SENT', 'message-sent'], ['CONTACT_MESSAGE_SENT', 'message-sent'],
    ['GUEST_MESSAGE_FAILED', 'message-delivery'], ['CONVERSATION_NEW_MESSAGE', 'message-received'],
    ['ACCESS_CODE_ROTATED', 'access-code'], ['SMART_LOCK_CODE_ROTATED_MANUALLY', 'access-code'],
    ['SMART_LOCK_CODE_GENERATION_FAILED', 'access-problem'], ['GUEST_DOOR_UNLOCKED', 'door-access'],
    ['SERVICE_REQUEST_TEAM_ASSIGNED', 'team-assigned'], ['INTERVENTION_ASSIGNED_TO_TEAM', 'team-assigned'],
    ['DOCUMENT_GENERATED', 'document'], ['RESERVATION_CREATED', 'reservation'],
    ['INCIDENT_OPENED', 'system-incident'], ['INCIDENT_RESOLVED', 'system-restored'],
    ['SERVICE_REQUEST_NO_TEAM_AVAILABLE', 'provider-search'],
  ])('reconnaît la scène de %s sans analyser son texte', (notificationKey, visual) => {
    expect(notificationVisual(notification({ notificationKey, title: 'عنوان', message: '', metadata: null })))
      .toEqual({ kind: 'illustration', visual });
  });

  it('préserve le sujet HITL lorsqu’une notification automatique porte un type d’action', () => {
    expect(notificationVisual(notification({ notificationKey: 'SUPERVISION_AUTO_APPLIED', metadata: { actionType: 'GUIDE_SEND' } })))
      .toEqual({ kind: 'illustration', visual: 'welcome-guide' });
  });

  it('garde la place de la vignette si le fichier échoue et charge la prochaine notification', () => {
    const { container, rerender } = render(<NotificationThumbnail notification={notification({ notificationKey: 'GUEST_MESSAGE_SENT', metadata: null })} />);
    const image = container.querySelector('img')!;
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('width', '48');
    expect(image).toHaveAttribute('loading', 'lazy');
    fireEvent.error(image);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.baitly-notification-thumbnail')).not.toBeNull();
    rerender(<NotificationThumbnail notification={notification({ notificationKey: 'ACCESS_CODE_ROTATED', metadata: null })} size="detail" />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/images/notifications/access-code.webp');
    expect(container.querySelector('img')).toHaveAttribute('width', '64');
  });

  it.each([
    ['NOSHOW_MARK', 'no-show'], ['TAX_MARK_FILED', 'tourist-tax'], ['GUIDE_SEND', 'welcome-guide'],
    ['OWNER_PAYOUT', 'owner-transfer'], ['CLEANING_PAYOUT', 'service-transfer'], ['YIELD_PRICE_ADJUST', 'pricing-optimization'],
  ])('reprend la vignette HITL de %s sans dépendre du titre traduit', (actionType, visual) => {
    expect(notificationVisual(notification({ title: 'عنوان', metadata: { actionType } }))).toEqual({ kind: 'illustration', visual });
  });

  it.each([
    ['SERVICE_REQUEST_TEAM_ASSIGNED', 'SERVICE_REQUEST_NO_TEAM_AVAILABLE'],
    ['PAYMENT_CONFIRMED', 'PAYMENT_FAILED'], ['PAYMENT_CONFIRMED', 'PAYMENT_REFUND_COMPLETED'],
    ['PAYMENT_CONFIRMED', 'PAYMENT_DEFERRED_OVERDUE'], ['RESERVATION_CREATED', 'RESERVATION_CANCELLED'],
    ['SERVICE_REQUEST_APPROVED', 'SERVICE_REQUEST_REJECTED'], ['SERVICE_REQUEST_CREATED', 'SERVICE_REQUEST_URGENT'],
    ['INTERVENTION_CREATED', 'INTERVENTION_CANCELLED'], ['INTERVENTION_COMPLETED', 'INTERVENTION_OVERDUE'],
    ['DOCUMENT_GENERATED', 'DOCUMENT_GENERATION_FAILED'], ['ICAL_IMPORT_SUCCESS', 'ICAL_IMPORT_FAILED'],
    ['INCIDENT_OPENED', 'INCIDENT_RESOLVED'], ['NOISE_ALERT_CRITICAL', 'NOISE_ALERT_RESOLVED'],
    ['REVIEW_RECEIVED', 'REVIEW_NEGATIVE_ALERT'], ['PAYOUT_SENT', 'PAYOUT_BLOCKED_ONBOARDING'],
  ])('ne confond plus %s avec %s', (first, second) => {
    const visual = (notificationKey: string) => notificationVisual(notification({ notificationKey, metadata: null }));
    expect(visual(first)).not.toEqual(visual(second));
  });

  it.each([
    ['REASSIGN_MANUAL', undefined, 'provider-search'],
    ['REASSIGN_CLEANING', undefined, 'provider-search'],
    ['PRICE_DROP', 'down', 'pricing-optimization'], ['PRICE_DROP', 'up', 'pricing-increase'],
    ['YIELD_PRICE_ADJUST', undefined, 'pricing-optimization'], ['PROMO_DEACTIVATE', undefined, 'promotion-end'],
  ])('partage le sens de %s (%s) entre carte HITL et notification', (actionType, direction, expected) => {
    const action: PendingAction = { id: 'test', agentId: 'ops', title: 'عنوان', motif: '', reasoning: '',
      createdAt: '', expiresAt: '', applyActionType: actionType, actionParams: JSON.stringify({ direction }) };
    const card = actionIllustration(action);
    expect(card).toBe(expected);
    expect(notificationVisual(notification({ title: 'Different translated title',
      metadata: { actionType, priceDirection: direction } }))).toEqual({ kind: 'illustration', visual: card });
  });

  it('une identité d’action résiduelle ne masque pas un échec ou une absence de prestataire explicite', () => {
    expect(notificationVisual(notification({ notificationKey: 'PAYMENT_FAILED', metadata: { actionType: 'GOODWILL_REFUND' } })))
      .toEqual({ kind: 'illustration', visual: 'payment-failed' });
    expect(notificationVisual(notification({ notificationKey: 'SERVICE_REQUEST_NO_TEAM_AVAILABLE', metadata: { actionType: 'CLEANING_REQUEST' } })))
      .toEqual({ kind: 'illustration', visual: 'provider-search' });
  });

  it('distingue les événements associés et les événements sans rapport', () => {
    expect(notificationVisual(notification({ notificationKey: 'PAYOUT_EXECUTED', metadata: null })))
      .toEqual({ kind: 'illustration', visual: 'owner-transfer' });
    expect(notificationVisual(notification({ notificationKey: 'TEAM_MEMBER_INVITED', metadata: null }))).toBeNull();
    expect(notificationVisual(notification({ metadata: { sourceTool: 'guest_instructions_missing' } })))
      .toEqual({ kind: 'illustration', visual: 'welcome-guide' });
  });

  it('garde un repli local pour un type inconnu sans charger une URL de la notification', () => {
    expect(notificationVisual(notification({ metadata: { actionType: 'NEW_TYPE', module: 'fin' } })))
      .toEqual({ kind: 'illustration', visual: 'payment' });
    for (const value of ['__proto__', 'constructor', 'https://example.test/pixel']) {
      expect(notificationVisual(notification({ metadata: { actionType: value, module: value, sourceTool: value } })))
        .toEqual({ kind: 'illustration', visual: 'approval' });
    }
  });

  it.each(['Draps housse 140x190', 'Sucre en dosettes', 'Torchons de cuisine', "Bouteille d'eau 50cl"])(
    'retrouve la photo du catalogue pour un ancien réassort de %s', (name) => {
      const { container } = render(<NotificationThumbnail notification={notification({
        title: `Stock bas : ${name} (2 restant)`, metadata: { actionType: 'LINEN_STOCK_ORDER' },
      })} />);
      const thumbnail = container.querySelector<HTMLElement>('.baitly-stock-thumbnail')!;
      expect(thumbnail.dataset.catalogKey).not.toBe('custom');
      expect(thumbnail.style.backgroundImage).toContain('/images/');
      expect(thumbnail.style.width).toBe('48px');
      expect(container.querySelector('.baitly-action-illustration')).toBeNull();
      expect(propertyStockApi.visual).not.toHaveBeenCalled();
    },
  );

  it('distingue un ancien drap sans qualificatif du drap-housse et du drap de bain', () => {
    const { container } = render(<>{['Draps 140x190', 'Draps housse 140x190', 'Draps de bain'].map((name) =>
      <NotificationThumbnail key={name} notification={notification({ title: `Stock bas : ${name} (2 restant)`, metadata: { actionType: 'LINEN_STOCK_ORDER' } })} />,
    )}</>);
    expect([...container.querySelectorAll<HTMLElement>('.baitly-stock-thumbnail')].map(el => el.dataset.catalogKey))
      .toEqual(['flat-sheet', 'fitted-sheet', 'bath-towel']);
  });

  it('retrouve la photo personnelle une seule fois pour la liste et le détail, avec repli si elle échoue', async () => {
    const photoUrl = 'data:image/png;base64,cGhvdG8=';
    vi.mocked(propertyStockApi.visual).mockResolvedValue({ name: 'Sucre en dosettes', catalogKey: 'sugar-portions', photoUrl });
    const row = notification({ title: 'Stock bas : Sucre en dosettes (2 restant)', metadata: { actionType: 'LINEN_STOCK_ORDER', stockItemId: 42 } });
    const { container } = render(<><NotificationThumbnail notification={row} /><NotificationThumbnail notification={row} size="detail" /></>);
    await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(2));
    expect(propertyStockApi.visual).toHaveBeenCalledExactlyOnceWith(42);
    const images = [...container.querySelectorAll('img')];
    for (const image of images) expect(image).toHaveAttribute('src', photoUrl);
    expect(container.querySelector('[data-size="detail"] .baitly-stock-thumbnail')).toHaveStyle({ width: '64px' });
    fireEvent.error(images[0]);
    expect(container.querySelector('[data-size="list"] img')).toBeNull();
    expect(container.querySelector('[data-size="list"] .baitly-stock-thumbnail')).not.toHaveAttribute('data-catalog-key', 'custom');
  });

  it.each([0, -1, 1.5, 'https://example.test/photo', {}, Number.MAX_SAFE_INTEGER + 1])('ignore un identifiant article invalide : %s', (stockItemId) => {
    render(<NotificationThumbnail notification={notification({ title: 'Stock bas : Café (2 restant)', metadata: { actionType: 'LINEN_STOCK_ORDER', stockItemId } })} />);
    expect(propertyStockApi.visual).not.toHaveBeenCalled();
  });

  it('affiche la même image dans la ligne et le détail ouvert au clavier, sans perdre le marquage lu', async () => {
    const row = notification();
    vi.mocked(notificationsApi.getPage).mockResolvedValue({ content: [row], totalElements: 1, size: 10, page: 0 });
    vi.mocked(notificationsApi.getUnreadCount).mockResolvedValue({ count: 1 });
    vi.mocked(notificationsApi.markAsRead).mockResolvedValue({ ...row, read: true });
    const { container } = render(<SidebarProvider><NotificationsPage /></SidebarProvider>);
    await screen.findByText(row.message);
    const line = container.querySelector('[data-notif-row]')!;
    expect(line.querySelector('img')).toHaveAttribute('src', '/images/hitl/no-show.webp');
    fireEvent.keyDown(line, { key: 'Enter' });
    await waitFor(() => expect(container.querySelector('[data-size="detail"] img')).toHaveAttribute('src', '/images/hitl/no-show.webp'));
    expect(notificationsApi.markAsRead).toHaveBeenCalledExactlyOnceWith(row.id);
    expect(notificationsApi.delete).not.toHaveBeenCalled();
  });
});
