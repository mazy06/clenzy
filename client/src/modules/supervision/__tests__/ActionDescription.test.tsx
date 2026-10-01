// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders as render, screen, fireEvent, within } from '../../../test/renderWithProviders';
import { ActionDescription } from '../components/ActionDescription';
import { ConstellationQueue } from '../components/ConstellationQueue';
import { PendingActionCard } from '../components/PendingActionCard';
import { TaskDeckQueue } from '../components/TaskDeckQueue';
import { SupervisionPendingAction } from '../components/SupervisionPendingAction';
import { ACTION_REGISTRY } from '../components/actionRegistry';
import { actionFacts, descriptionHighlights, readActionParams } from '../core/actionDescription';
import type { AgentId, PendingAction } from '../types';

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null, loading: false }) }));

const item = (patch: Partial<PendingAction> = {}): PendingAction => ({
  id: 'preview', agentId: 'ops', title: 'Une décision à prendre', motif: 'Une information utile.',
  reasoning: '', createdAt: '2026-09-30T12:00:00Z', expiresAt: '2099-09-30T12:00:00Z', ...patch,
});
const stock = item({ title: 'Stock bas : Gel douche (2 restant)', applyActionType: 'LINEN_STOCK_ORDER',
  motif: 'Seuil de 3 atteint. « Commander » envoie le bon de commande (9 flacons) à Hotelia Distribution — le réassort se confirme ensuite dans la fiche du logement.',
  actionParams: '{"stockItemId":7}',
});

describe('Descriptions HITL', () => {
  it('rend le stock, le seuil, la commande et le fournisseur sans répéter le paragraphe', () => {
    render(<ActionDescription action={stock} />);
    expect(screen.getByText('2 restants')).toBeVisible();
    expect(screen.getByText('Seuil de réassort : 3')).toBeVisible();
    expect(screen.getByText('Hotelia Distribution')).toBeVisible();
    expect(screen.getByText(/9/)).toHaveTextContent('9 flacons');
    expect(screen.queryByText(stock.motif)).toBeNull();
    expect(screen.getByText(/le réassort se confirme ensuite/)).toBeVisible();
  });

  it('indique le fournisseur manquant sans inventer une commande', () => {
    render(<ActionDescription action={item({ title: 'Stock bas : Thé (0 restant)', motif: 'Seuil de 2 atteint et aucun fournisseur configuré — renseigner le fournisseur dans la fiche du logement pour que la commande devienne un clic.' })} />);
    expect(screen.getByText('0 restant')).toBeVisible();
    expect(screen.getByText('Fournisseur à renseigner')).toBeVisible();
    expect(screen.queryByText('À commander')).toBeNull();
  });

  it('compare chaque devis dans sa devise sans créer de classement monétaire', () => {
    const motif = '« Remplacement du chauffe-eau » : 2 devis reçu(s) — Atlas — 180.50 EUR (dispo 2026-10-04) · Riad Services — 1950 MAD. « Approuver » retient le moins cher (Atlas), écarte les autres et reporte le montant sur l’intervention.';
    render(<ActionDescription action={item({ applyActionType: 'QUOTE_APPROVAL', motif })} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Atlas');
    expect(rows[0]).toHaveTextContent('EUR');
    expect(rows[1]).toHaveTextContent('MAD');
    expect(rows[1]).toHaveTextContent('Disponibilité non précisée');
    expect(screen.getByText(/écarte les autres/)).toBeVisible();
  });

  it('garde tout le texte quand un devis est mal formé', () => {
    const motif = '« Travaux » : 2 devis reçu(s) — Atlas — 180 EUR · Devis incomplet. « Approuver » retient le moins cher.';
    const { container } = render(<ActionDescription action={item({ applyActionType: 'QUOTE_APPROVAL', motif })} />);
    expect(container).toHaveTextContent('Devis incomplet');
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('rend les indices du no-show et conserve la démarche sur le canal', () => {
    const { container } = render(<ActionDescription action={item({ agentId: 'sync', applyActionType: 'NOSHOW_MARK', motif: "Arrivée prévue le 2026-09-27, aucun signe de vie depuis : pas de fiche voyageur déposée, aucun message reçu. « Marquer no-show » libère les nuits restantes pour la revente — la déclaration sur le canal d'origine reste à faire par vos soins (fenêtre de 48 h chez la plupart des OTA)." })} />);
    expect(container.querySelector('time')).toHaveAttribute('datetime', '2026-09-27');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Fiche voyageur absente')).toBeVisible();
    expect(container).toHaveTextContent("la déclaration sur le canal d'origine reste à faire");
    expect(screen.getByText('48 h').tagName).toBe('STRONG');
  });

  it('respecte les dates exclusives des restrictions et ne crée aucun paramètre par défaut', () => {
    const a = item({ applyActionType: 'MIN_STAY_RESTRICTION', actionParams: '{"from":"2026-10-24","to":"2026-10-27","minNights":3,"weekendsOnly":false}' });
    const { container } = render(<ActionDescription action={a} />);
    expect(container.querySelector('time[datetime="2026-10-26"]')).toBeTruthy();
    expect(container.querySelector('time[datetime="2026-10-27"]')).toBeNull();
    expect(screen.getByText('3 nuits')).toBeVisible();
    expect(screen.getByText('Toute la période')).toBeVisible();
    expect(actionFacts(item({ applyActionType: 'MIN_STAY_RESTRICTION', actionParams: '{}' }))).toEqual([]);
  });

  it('affiche l’échéance réellement fournie par le serveur sans inventer le solde futur', () => {
    render(<ActionDescription action={item({ kind: 'payment', amountEur: 40, depositEur: 40, paymentStage: 'deposit' })} />);
    const steps = screen.getAllByRole('listitem');
    expect(steps[0]).toHaveTextContent('40');
    expect(steps[1]).toHaveTextContent('À déterminer');
    expect(steps[0]).toHaveAttribute('data-current', 'true');
    expect(screen.getByText('Le règlement est à confirmer sur la page de paiement.')).toBeVisible();
  });

  it('ne déduit pas une seconde fois l’acompte déjà payé du montant de l’échéance', () => {
    render(<ActionDescription action={item({ kind: 'payment', amountEur: 180, depositEur: 40, depositPaid: true, paymentStage: 'balance' })} />);
    const steps = screen.getAllByRole('listitem');
    expect(steps[0]).toHaveTextContent('Acompte déjà versé');
    expect(steps[0]).toHaveTextContent('40');
    expect(steps[1]).toHaveTextContent('180');
    expect(steps[1]).not.toHaveTextContent('140');
  });

  it('n’affiche pas de solde négatif avec des données de paiement incohérentes', () => {
    render(<ActionDescription action={item({ kind: 'payment', amountEur: 30, depositEur: 40 })} />);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByText('Le règlement est à confirmer sur la page de paiement.')).toBeVisible();
  });

  it('compare les revenus réels et garde le recalcul à l’envoi', () => {
    const { container } = render(<ActionDescription action={item({ agentId: 'own', applyActionType: 'OWNER_REVENUE_NOTE', motif: "Revenus de 2026-08 : 2100 € contre 3500 € le même mois l'an dernier. « Envoyer » adresse une note au propriétaire avec les chiffres recalculés à l’envoi." })} />);
    expect(screen.getByText('Même mois l’an dernier')).toBeVisible();
    const bars = container.querySelectorAll<HTMLElement>('.baitly-description-comparison-track > span');
    expect(bars[0].style.width).toBe('60%');
    expect(bars[1].style.width).toBe('100%');
    expect(container).toHaveTextContent('recalculés à l’envoi');
  });

  it('met la date légale en avant et garde les conséquences de l’effacement', () => {
    const { container } = render(<ActionDescription action={item({ agentId: 'cmp', applyActionType: 'GDPR_ERASE', motif: 'Demande de voyageur@example.test reçue le 2026-09-28T10:30:00 — échéance légale le 2026-10-28 (J-28). « Effacer » est IRRÉVERSIBLE : identité et messages purgés ; factures conservées.' })} />);
    expect(screen.getByText('Échéance légale').nextElementSibling?.querySelector('time')).toHaveAttribute('datetime', '2026-10-28');
    expect(container).toHaveTextContent('IRRÉVERSIBLE');
    expect(container).toHaveTextContent('factures conservées');
    expect(container).not.toHaveTextContent('J-28');
  });

  it('présente la note et la citation de l’avis sans échapper la recommandation', () => {
    const { container } = render(<ActionDescription action={item({ agentId: 'rep', applyActionType: 'REVIEW_DRAFT_REPLY', motif: 'Avis 4/5 de Inès K. le 4 mai 2026, sans réponse hôte. « Accueil chaleureux. » Répondre personnellement.' })} />);
    expect(screen.getByText('4/5')).toBeVisible();
    expect(container.querySelector('blockquote')).toHaveTextContent('Accueil chaleureux.');
    expect(screen.getByText('Répondre personnellement.')).toBeVisible();
  });

  it('accentue les chiffres sans perdre les décimales, unités ni texte', () => {
    const text = 'Rembourser 12.50 EUR avant 2026-10-02 à 14:30 pour #532 (15 %).';
    expect(descriptionHighlights(text).map((part) => part.text).join('')).toBe(text);
    expect(descriptionHighlights(text).filter((part) => part.important).map((part) => part.text)).toContain('12.50 EUR');
  });

  it('garde une citation de plusieurs phrases dans un aperçu distinct du commentaire', () => {
    const quote = 'Nous pouvons préparer votre arrivée à partir de 14:30. Merci de confirmer votre heure d’arrivée pour organiser l’accueil.';
    const { container } = render(<ActionDescription action={item({ agentId: 'com', motif: `Proposition de réponse. « ${quote} » À relire avant envoi.` })} />);
    expect(container.querySelector('blockquote')).toHaveTextContent(quote);
    expect(screen.getByText('À relire avant envoi.')).toBeVisible();
  });

  it.each(['null', '[]', '"texte"', '{', '{"token":"secret","deviceId":12}'])('ne montre jamais les paramètres techniques : %s', (actionParams) => {
    const { container } = render(<ActionDescription action={item({ applyActionType: 'LOCK_BATTERY_REPLACE', actionParams })} />);
    expect(container).not.toHaveTextContent('secret');
    expect(container).not.toHaveTextContent('deviceId');
    expect(screen.getByText('Une information utile.')).toBeVisible();
    expect(readActionParams(actionParams)).toBeTypeOf('object');
  });

  it.each(Object.keys(ACTION_REGISTRY))('préserve une description inconnue pour le type %s', (applyActionType) => {
    const { container } = render(<ActionDescription action={item({ applyActionType, actionParams: '{}', motif: 'Contexte métier à garder. Détail nécessaire pour décider.' })} />);
    expect(container).toHaveTextContent('Contexte métier à garder.');
    expect(container).toHaveTextContent('Détail nécessaire pour décider.');
  });

  it.each(['com', 'rev', 'ops', 'fin', 'rep', 'sync', 'cmp', 'gst', 'own', 'gro'] as AgentId[])('garde les cartes informatives de %s lisibles et sûres', (agentId) => {
    const { container } = render(<ActionDescription action={item({ agentId, motif: 'Pièce attendue le 2026-10-05. <img src=x onerror=alert(1)>' })} />);
    expect(container).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('2026-10-05').tagName).toBe('STRONG');
  });
});

const surfaces = [
  { name: 'constellation', render: (action: PendingAction, onOpen: () => void, onValidate: () => void) => <ConstellationQueue agent="ops" actions={[action]} onValidate={onValidate} onEdit={() => {}} onOpenActionModal={onOpen} /> },
  { name: 'liste', render: (action: PendingAction, onOpen: () => void, onValidate: () => void) => <PendingActionCard action={action} onValidate={onValidate} onEdit={() => {}} onOpenActionModal={onOpen} /> },
  { name: 'pile', render: (action: PendingAction, onOpen: () => void, onValidate: () => void) => <TaskDeckQueue actions={[action]} onValidate={onValidate} onEdit={() => {}} onOpenActionModal={onOpen} /> },
];
describe.each(surfaces)('Présentation et actions : $name', (surface) => {
  it('affiche les mêmes faits et ouvre l’éditeur avant de commander', () => {
    const onOpen = vi.fn(), onValidate = vi.fn();
    render(surface.render({ ...stock, reasoning: stock.motif }, onOpen, onValidate));
    expect(screen.getByText('2 restants')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Pourquoi ?' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Commander' }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onValidate).not.toHaveBeenCalled();
  });
});

it('une validation live ne reprend le run qu’une fois après une décision explicite', () => {
  const onResolve = vi.fn();
  render(<SupervisionPendingAction action={{ interruptId: 'pending', toolName: 'Envoyer le message', message: 'Le voyageur arrive le 2026-10-02.' }} onResolve={onResolve} />);
  const dialog = screen.getByRole('alertdialog');
  expect(onResolve).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Valider' }));
  expect(onResolve).toHaveBeenCalledExactlyOnceWith(true);
  expect(within(dialog).getByRole('button', { name: 'Refuser' })).toBeDisabled();
});
