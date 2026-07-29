import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ActionCardDialog from '../ActionCardDialog';
import { ACTION_CARDS, DEDICATED_ACTION_KINDS } from '../actionCards';
import { actionItemsApi } from '../../../services/api/actionItemsApi';
import { ACTION_KINDS } from '../../../services/api/dashboardOperationsApi';
import type { DashboardActionItem } from '../../../services/api/dashboardOperationsApi';

/**
 * La carte de décision d'une action.
 *
 * <p>Ce qui est vérifié ici n'est pas la mise en page : c'est que la carte ne
 * ment pas. Un bouton proposé là où le geste n'existe pas ferait perdre du
 * temps ; un geste envoyé sans sa cible échouerait en silence ; et une carte
 * qui se referme sur un échec ferait croire l'action traitée.</p>
 */

vi.mock('../../../services/api/actionItemsApi', () => ({
  actionItemsApi: { act: vi.fn() },
  refreshActionQueue: vi.fn().mockResolvedValue(undefined),
}));

function item(overrides: Partial<DashboardActionItem> = {}): DashboardActionItem {
  return {
    id: 'noise:7',
    kind: 'NOISE_ALERT_UNACKNOWLEDGED',
    severity: 'critical',
    title: 'Alerte de bruit non acquittée',
    detail: null,
    subject: null,
    targetId: 7,
    propertyId: 300,
    propertyName: 'Riad Zitoun',
    amount: null,
    badge: null,
    actionType: null,
    actionItemId: 41,
    ...overrides,
  };
}

function renderCard(value: DashboardActionItem | null, onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ActionCardDialog item={value} onClose={onClose} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return onClose;
}

describe('ActionCardDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('énonce ce qui s’est passé ET ce que coûte l’inaction', () => {
    renderCard(item());

    // La seconde phrase est celle qui fait décider : sans elle, rien ne
    // distingue l'urgent du reste.
    expect(screen.getByText(/dépassement sonore/)).toBeInTheDocument();
    expect(screen.getByText(/plainte de voisinage/)).toBeInTheDocument();
  });

  it('porte le geste réel quand il existe', async () => {
    vi.mocked(actionItemsApi.act).mockResolvedValue(undefined);
    renderCard(item());

    fireEvent.click(screen.getByRole('button', { name: /Acquitter/ }));

    await waitFor(() => expect(actionItemsApi.act).toHaveBeenCalledWith(41, 'acknowledge'));
  });

  it('ne propose aucun geste là où il n’en existe pas', () => {
    // Reconnecter une intégration passe par un parcours externe : un bouton
    // ici ne ferait rien, et le proposer ferait perdre du temps.
    renderCard(item({ kind: 'INTEGRATION_DISCONNECTED', title: 'Airbnb' }));

    expect(screen.queryByRole('button', { name: /Acquitter|Approuver|Libérer/ }))
      .not.toBeInTheDocument();
    expect(screen.getByText(/ne se fait pas depuis ici/)).toBeInTheDocument();
  });

  it('désactive le geste quand la ligne n’a pas d’identité persistée', () => {
    // Cas des fixtures de galerie : le geste n'aurait aucune cible.
    renderCard(item({ actionItemId: null }));

    expect(screen.getByRole('button', { name: /Acquitter/ })).toBeDisabled();
  });

  it('sur échec, la carte reste ouverte et le dit', async () => {
    vi.mocked(actionItemsApi.act).mockRejectedValue(new Error('boom'));
    const onClose = renderCard(item());

    fireEvent.click(screen.getByRole('button', { name: /Acquitter/ }));

    // Se refermer ferait croire l'action traitée alors qu'elle ne l'est pas.
    await waitFor(() => expect(screen.getByText(/a échoué/)).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('n’ouvre rien pour une nature inconnue de la table', () => {
    renderCard(item({ kind: 'REVIEW_UNANSWERED' }));

    // Les avis ont leur propre carte : celle-ci ne doit pas s'y substituer avec
    // un contenu générique.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('table des cartes', () => {
  it('chaque geste déclaré porte son libellé et sa confirmation', () => {
    // Un geste sans message de succès laisserait l'utilisateur sans preuve que
    // quelque chose s'est produit.
    for (const [kind, card] of Object.entries(ACTION_CARDS)) {
      if (!card?.gesture) continue;
      expect(card.gesture.action, `${kind}: action`).toBeTruthy();
      expect(card.gesture.label, `${kind}: libellé`).toBeTruthy();
      expect(card.gesture.done, `${kind}: message de succès`).toBeTruthy();
    }
  });

  it('chaque nature annonce une conséquence, pas seulement un constat', () => {
    for (const [kind, card] of Object.entries(ACTION_CARDS)) {
      expect(card?.what, `${kind}: constat`).toBeTruthy();
      expect(card?.consequence, `${kind}: conséquence`).toBeTruthy();
      // Le constat et la conséquence disent deux choses différentes.
      expect(card?.consequence, `${kind}: doublon`).not.toEqual(card?.what);
    }
  });
});

describe('rejeu douteux', () => {
  beforeEach(() => vi.clearAllMocks());

  it('avertit et change le libellé quand l’envoi a peut-être eu lieu', () => {
    renderCard(item({
      kind: 'AUTOMATION_FAILED',
      title: 'Message de bienvenue',
      actionType: 'MAY_HAVE_SENT',
    }));

    expect(screen.getByText(/une seconde fois/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /malgré le risque/ })).toBeInTheDocument();
  });

  it('n’avertit pas quand rien n’est parti', () => {
    // Une confirmation systématique s'apprend à cliquer sans lire : elle ne
    // doit apparaître que là où le doute existe réellement.
    renderCard(item({
      kind: 'AUTOMATION_FAILED',
      title: 'Message de bienvenue',
      actionType: 'SAFE_REPLAY',
    }));

    expect(screen.queryByText(/une seconde fois/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rejouer cette règle/ })).toBeInTheDocument();
  });
});

describe('couverture des natures', () => {
  it('chaque nature ouvre quelque chose au clic', () => {
    // Quatre natures n'ouvraient rien : on cliquait, et il ne se passait
    // rien. L'aiguillage étant une suite de conditions écrites à la main,
    // rien ne le signalait — ce test est ce qui le signale désormais.
    const orphans = ACTION_KINDS.filter(
      (kind) => !ACTION_CARDS[kind] && !DEDICATED_ACTION_KINDS.has(kind),
    );

    expect(orphans).toEqual([]);
  });
});
