import { useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import i18n from '../../i18n/config';
import fr from '../../../public/locales/fr.json';
import ar from '../../../public/locales/ar.json';
import type { AutomationRule } from '../../services/api/automationRulesApi';
import {
  ScreenChromeProvider,
  useScreenChrome,
} from '../../components/ScreenChrome';
import AutomationRulesPage from './AutomationRulesPage';

const state = vi.hoisted(() => ({
  canEdit: true,
  canSupervise: true,
  headerTabsSlot: false,
  agentsError: false,
  view: 'list',
  historyError: false,
  saveError: false,
  rules: [] as AutomationRule[],
  toggle: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  retryAgents: vi.fn(),
}));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    hasAnyRole: (roles: string[]) =>
      roles.includes('SUPERVISOR') ? state.canSupervise : state.canEdit,
  }),
}));
vi.mock('../../hooks/useUserPreference', () => ({
  useUserPreference: (key: string, fallback: unknown) =>
    useState(key === 'automation.viewMode' ? state.view : fallback),
}));
vi.mock('../../hooks/usePropertiesList', () => ({
  usePropertiesList: () => ({ properties: [] }),
}));
vi.mock('../supervision/useSupervisionAutoRules', () => ({
  useSupervisionAutoRules: () => ({
    data: [],
    isLoading: false,
    isError: state.agentsError,
    refetch: state.retryAgents,
  }),
  useUpdateSupervisionAutoRules: () => ({ mutate: vi.fn() }),
  useDismissAutoRuleSuggestion: () => ({ mutate: vi.fn() }),
}));
vi.mock('../supervision/core/useSupervisionReport', () => ({
  useSupervisionReport: () => ({ report: null }),
}));
vi.mock('../../components/PageHeader', () => ({
  default: ({ title, actions }: { title: string; actions: ReactNode }) => {
    const { search, setSearchValue, setTabsSlot } = useScreenChrome();
    return (
      <header>
        <h1>{title}</h1>
        {state.headerTabsSlot && <div ref={setTabsSlot} />}
        {search && (
          <input
            aria-label="Recherche"
            value={search?.value ?? ''}
            onChange={(event) => setSearchValue(event.target.value)}
          />
        )}
        {actions}
      </header>
    );
  },
}));
vi.mock('../../hooks/useAutomationRules', () => ({
  useAutomationRules: () => ({
    data: state.rules,
    isLoading: false,
    isError: false,
  }),
  useSystemAutomations: () => ({
    data: [
      {
        key: 'system',
        label: 'Automatisation système test',
        description: 'Indépendante des règles',
        triggerLabel: 'Événement',
        actionLabel: 'Action',
        statusLabel: 'Active',
        mechanism: 'Système',
      },
    ],
    isLoading: false,
  }),
  useToggleRule: () => ({ mutate: state.toggle, isPending: false }),
  useDeleteRule: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateRule: () => ({
    mutate: state.create,
    isPending: false,
    isError: state.saveError,
  }),
  useUpdateRule: () => ({ mutate: state.update, isPending: false }),
  useRuleExecutions: () => ({
    isLoading: false,
    isError: state.historyError,
    refetch: vi.fn(),
    data: { content: [], totalElements: 0 },
  }),
}));
vi.mock('../../services/api/guestMessagingApi', () => ({
  guestMessagingApi: { getTemplates: async () => [] },
}));
vi.mock('../../services/apiClient', () => ({ default: {} }));

const base: AutomationRule = {
  id: 1,
  name: 'Informations d’arrivée',
  enabled: true,
  sortOrder: 0,
  triggerType: 'CHECK_IN_DAY',
  triggerOffsetDays: 0,
  triggerTime: '09:00',
  conditions: null,
  actionType: 'SEND_MESSAGE',
  actionConfig: null,
  templateId: null,
  templateName: null,
  deliveryChannel: 'EMAIL',
  createdAt: '2026-09-18T09:00:00Z',
};
function LocationProbe() {
  return <output data-testid="location">{useLocation().search}</output>;
}

function mount(entry = '/automation') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <ScreenChromeProvider>
          <AutomationRulesPage />
          <LocationProbe />
        </ScreenChromeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  i18n.addResourceBundle('fr', 'translation', fr, true, true);
  state.canEdit = true;
  state.canSupervise = true;
  state.headerTabsSlot = false;
  state.agentsError = false;
  state.view = 'list';
  state.historyError = false;
  state.saveError = false;
  state.rules = [
    base,
    {
      ...base,
      id: 2,
      name: 'Prévenir l’équipe',
      enabled: false,
      triggerType: 'NOISE_ALERT',
      actionType: 'NOTIFY_STAFF',
    },
  ];
});
afterEach(cleanup);

describe('Automation workspace', () => {
  it('opens the Arabic rule editor on the left with translated fields', async () => {
    i18n.addResourceBundle('ar', 'translation', ar, true, true);
    await i18n.changeLanguage('ar');
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'قاعدة جديدة' }));
    expect(screen.getByRole('dialog')).toHaveAttribute('data-side', 'left');
    expect(screen.getByLabelText('اسم القاعدة')).toBeInTheDocument();
  });
  it.each(['list', 'card'])(
    'keeps organisation users read-only in %s view while allowing history',
    (view) => {
      state.canEdit = false;
      state.view = view;
      mount();
      expect(
        screen.queryByRole('button', { name: 'Nouvelle règle' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Actions :/ }),
      ).not.toBeInTheDocument();
      for (const toggle of screen.getAllByRole('switch')) {
        expect(toggle).toBeDisabled();
        fireEvent.click(toggle);
      }
      expect(state.toggle).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Historique : Informations d’arrivée',
        }),
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    },
  );

  it('combines search and filters and restores all rules on reset', () => {
    mount();
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Filtrer les déclencheurs' }),
      { target: { value: 'event' } },
    );
    fireEvent.click(screen.getByRole('button', { name: /En pause\s*1/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Recherche' }), {
      target: { value: 'prevenir' },
    });
    const list = screen.getByRole('list', { name: 'Vos règles' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByText('Prévenir l’équipe')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Recherche' }), {
      target: { value: 'aucun résultat' },
    });
    expect(screen.getByText('Aucune règle ne correspond')).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Réinitialiser les filtres' })[0],
    );
    expect(
      within(screen.getByRole('list', { name: 'Vos règles' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(2);
  });

  it('keeps system automations visible when there are no editable rules', () => {
    state.rules = [];
    mount();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Système' }), {
      button: 0,
      ctrlKey: false,
    });
    expect(screen.getByText('Automatisation système test')).toBeVisible();
  });

  it('isolates each section and keeps search and creation in the rules tab', () => {
    mount('/automation?keep=value');
    expect(screen.getByRole('tab', { name: 'Règles' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.queryByText('Automatisation système test'),
    ).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Système' }), {
      button: 0,
      ctrlKey: false,
    });
    expect(screen.getByText('Automatisation système test')).toBeVisible();
    expect(
      screen.queryByRole('list', { name: 'Vos règles' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Nouvelle règle' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Recherche' }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '?keep=value&tab=system',
    );
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Agents' }), {
      button: 0,
      ctrlKey: false,
    });
    expect(screen.getByText('Aucune action disponible')).toBeVisible();
    expect(
      screen.queryByText('Automatisation système test'),
    ).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Règles' }), {
      button: 0,
      ctrlKey: false,
    });
    expect(
      screen.getByRole('button', { name: 'Nouvelle règle' }),
    ).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Recherche' })).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent('?keep=value');
  });

  it('opens a section directly from its URL', () => {
    mount('/automation?tab=system');
    expect(screen.getByRole('tab', { name: 'Système' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Automatisation système test')).toBeVisible();
  });

  it('navigates through the shared tab selector in the page header', async () => {
    state.headerTabsSlot = true;
    mount();
    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Onglets — Règles' }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Système' }));
    expect(screen.getByText('Automatisation système test')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Onglets — Système' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Nouvelle règle' }),
    ).not.toBeInTheDocument();
  });

  it('hides the agents tab without supervision access and falls back to rules', () => {
    state.canSupervise = false;
    mount('/automation?tab=agents');
    expect(
      screen.queryByRole('tab', { name: 'Agents' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Règles' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('list', { name: 'Vos règles' })).toBeVisible();
  });

  it('shows a retry action when the agents section fails to load', () => {
    state.agentsError = true;
    mount('/automation?tab=agents');
    expect(
      screen.getByText('Impossible de charger les actions des agents.'),
    ).toBeVisible();
    expect(
      screen.queryByText('Aucune action disponible'),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(state.retryAgents).toHaveBeenCalledOnce();
  });

  it('shows a history failure instead of an empty history', () => {
    state.historyError = true;
    mount();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Historique : Informations d’arrivée',
      }),
    );
    expect(
      within(screen.getByRole('dialog')).getByText(
        'Impossible de charger l’historique.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Aucune exécution pour le moment'),
    ).not.toBeInTheDocument();
  });

  it('preserves existing conditions and action configuration when editing', () => {
    state.rules = [
      {
        ...base,
        conditions: '{"propertyIds":[3],"minNights":2}',
        actionConfig: '{"graceHours":4}',
        templateId: 7,
        templateName: 'Arrivée',
      },
    ];
    mount();
    fireEvent.click(
      screen.getByRole('button', { name: 'Informations d’arrivée' }),
    );
    fireEvent.change(screen.getByLabelText('Nom de la règle'), {
      target: { value: 'Arrivée mise à jour' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(state.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        data: expect.objectContaining({
          name: 'Arrivée mise à jour',
          conditions: state.rules[0].conditions,
          actionConfig: state.rules[0].actionConfig,
          templateId: 7,
        }),
      }),
      expect.any(Object),
    );
  });

  it('selects a compatible action and resets the day offset for an event trigger', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle règle' }));
    fireEvent.change(screen.getByLabelText('Nom de la règle'), {
      target: { value: 'Paiement refusé' },
    });
    fireEvent.change(screen.getByLabelText('Décalage (jours)'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('Déclencheur'), {
      target: { value: 'PAYMENT_FAILED' },
    });
    expect(screen.queryByLabelText('Décalage (jours)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Créer la règle' }));
    expect(state.create).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerType: 'PAYMENT_FAILED',
        actionType: 'NOTIFY_STAFF',
        triggerOffsetDays: 0,
      }),
      expect.any(Object),
    );
  });

  it('keeps the form and its values available after a save failure', () => {
    state.saveError = true;
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle règle' }));
    fireEvent.change(screen.getByLabelText('Nom de la règle'), {
      target: { value: 'Accueil voyageur' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Créer la règle' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Nom de la règle')).toHaveValue(
      'Accueil voyageur',
    );
    expect(
      screen.getByText(/Impossible d’enregistrer la règle/),
    ).toBeInTheDocument();
  });
});
