// @vitest-environment jsdom
import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StuckServiceDialog from '../StuckServiceDialog';
import { serviceRequestsApi } from '../../../services/api/serviceRequestsApi';
import { reservationsApi } from '../../../services/api/reservationsApi';
import { useTranslation } from '../../../hooks/useTranslation';

/**
 * La modale d'une prestation sans prestataire.
 *
 * Le formulaire de replanification n'apparaît qu'au clic : c'est ce second
 * rendu qui montait les listes déroulantes et faisait tomber tout le bloc
 * « À traiter » derrière sa limite d'erreur.
 */

vi.mock('../../../services/api/reservationsApi', () => ({
  reservationsApi: { getAll: vi.fn().mockResolvedValue([]) },
}));
vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string, arg?: unknown) =>
      typeof arg === 'string' ? arg : (arg as { defaultValue?: string })?.defaultValue ?? key,
    isArabic: false,
  })),
}));
vi.mock('../../../services/api/serviceRequestsApi', () => ({
  serviceRequestsApi: {
    cancel: vi.fn(),
    reschedule: vi.fn(),
    assignableTeams: vi.fn().mockResolvedValue([]),
  },
}));

/**
 * Limite d'erreur de test.
 *
 * Sans elle, un composant qui plante laisse quand même passer les assertions :
 * React journalise l'erreur, remonte au parent, et le test reste vert. C'est
 * exactement ce qui s'est produit ici — le premier jet de ce test passait alors
 * que le rendu levait « teams.filter is not a function ».
 */
class Catcher extends React.Component<{ children: React.ReactNode }, { crashed: Error | null }> {
  state = { crashed: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { crashed: error };
  }
  render() {
    return this.state.crashed
      ? <div data-testid="crashed">{this.state.crashed.message}</div>
      : this.props.children;
  }
}

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Catcher>
        <StuckServiceDialog
          serviceRequestId={41}
          onClose={() => {}}
          service={{ title: 'Ménage Airbnb', propertyId: 300, propertyName: 'Duplex Marrakech' }}
        />
      </Catcher>
    </QueryClientProvider>,
  );
}

describe('<StuckServiceDialog>', () => {
  beforeEach(() => vi.clearAllMocks());

  it('propose de clôturer ou de replanifier', () => {
    renderDialog();

    expect(screen.getByText('Ménage Airbnb')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Clôturer/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Replanifier/ })).toBeTruthy();
  });

  it('ne confond pas un échec de requête avec une absence de prestataire', async () => {
    // Annoncer « aucune équipe » quand la question n'a pas pu être posée ferait
    // conclure à tort qu'il n'y a personne — et masquerait un serveur en panne.
    vi.mocked(serviceRequestsApi.assignableTeams).mockRejectedValue({
      status: 500,
      message: 'Boom côté serveur',
    });

    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /Replanifier/ }));
    await screen.findByLabelText(/Heure/);

    // Le nom accessible des jours dépend de react-day-picker (date complète,
    // localisée) : on clique le premier jour sélectionnable plutôt que de
    // coupler le test à ce libellé.
    // La modale est rendue dans un portail : les jours vivent dans le document,
    // pas dans le conteneur retourné par `render`.
    const days = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-day]'))
      .filter((button) => !button.disabled);
    expect(days.length).toBeGreaterThan(0);
    fireEvent.click(days[days.length - 1]);

    expect(await screen.findByText(/Boom côté serveur/)).toBeTruthy();
    expect(screen.queryByText(/Aucune équipe/)).toBeNull();
  });

  it('explique quand des équipes couvrent le logement mais qu’aucune n’est libre', async () => {
    // Une liste de « Occupée » sans explication laisse croire que le logement
    // n'est pas couvert, alors que c'est l'heure choisie qui bloque.
    vi.mocked(serviceRequestsApi.assignableTeams).mockResolvedValue([
      { teamId: 1, name: 'Équipe Marrakech', origin: 'ZONE', available: false, conflicts: 2 },
      { teamId: 2, name: 'Équipe Gueliz', origin: 'DEFAULT', available: false, conflicts: 1 },
    ]);

    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /Replanifier/ }));
    await screen.findByLabelText(/Heure/);
    const days = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-day]'))
      .filter((button) => !button.disabled);
    fireEvent.click(days[days.length - 1]);

    // Les équipes restent proposées — décaler l'heure peut les libérer.
    expect(await screen.findByText('Équipe Marrakech')).toBeTruthy();
    expect(screen.getByText('Équipe Gueliz')).toBeTruthy();
    expect(screen.getByText(/Aucune équipe n’est libre sur ce créneau/)).toBeTruthy();
  });

  it('rattache au séjour qui couvre le jour choisi', async () => {
    // Le jour cliqué par le test est le dernier jour sélectionnable du mois
    // affiché : on construit un séjour qui le couvre, et un autre qui ne le
    // couvre pas, pour vérifier que c'est bien le bon qui ressort.
    const today = new Date();
    // Date LOCALE, pas `toISOString()` : celui-ci convertit en UTC et recule
    // d'un jour dès qu'on est à l'est de Greenwich — le piège que le composant
    // évite, et que ce test reproduisait.
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    // Le calendrier affiche aussi les premiers jours du mois suivant, et ils
    // sont cliquables : le séjour doit les couvrir pour que le test porte sur
    // la déduction, pas sur le hasard du jour retenu.
    const wideEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    vi.mocked(reservationsApi.getAll).mockResolvedValue([
      { id: 8, guestName: 'Sofia M.', checkIn: iso(today), checkOut: iso(wideEnd) },
      { id: 9, guestName: 'Hors période', checkIn: '2000-01-01', checkOut: '2000-01-05' },
    ] as never);

    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /Replanifier/ }));
    await screen.findByLabelText(/Heure/);
    // Le PREMIER jour cliquable est aujourd'hui (le passé est désactivé) : il
    // tombe donc dans le séjour, quel que soit le nombre de mois affichés.
    const days = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-day]'))
      .filter((button) => !button.disabled);
    fireEvent.click(days[0]);

    // Les dates du séjour sont rendues littéralement, contrairement au nom du
    // voyageur qui passe par l'interpolation i18n (non résolue en test).
    expect(await screen.findByText(new RegExp(`${iso(today)}.*${iso(wideEnd)}`))).toBeTruthy();
    expect(screen.queryByText(/Aucun séjour ce jour-là/)).toBeNull();
  });

  it('rattache encore le jour du départ — le ménage se fait ce jour-là', async () => {
    // Borne haute incluse. L'exclure priverait de rattachement le cas le plus
    // courant : le ménage de départ.
    const today = new Date();
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const threeDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3);
    vi.mocked(reservationsApi.getAll).mockResolvedValue([
      { id: 8, guestName: 'Sofia M.', checkIn: iso(threeDaysAgo), checkOut: iso(today) },
    ] as never);

    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /Replanifier/ }));
    await screen.findByLabelText(/Heure/);
    // Les dates passées sont désactivées : le premier jour cliquable est donc
    // aujourd'hui, c'est-à-dire le jour de départ du séjour.
    const days = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-day]'))
      .filter((button) => !button.disabled);
    fireEvent.click(days[0]);

    expect(await screen.findByText(new RegExp(`${iso(threeDaysAgo)}.*${iso(today)}`))).toBeTruthy();
    expect(screen.queryByText(/Aucun séjour ce jour-là/)).toBeNull();
  });

  it('prévient quand le jour choisi ne tombe dans aucun séjour', async () => {
    vi.mocked(reservationsApi.getAll).mockResolvedValue([
      { id: 9, guestName: 'Hors période', checkIn: '2000-01-01', checkOut: '2000-01-05' },
    ] as never);

    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /Replanifier/ }));
    await screen.findByLabelText(/Heure/);
    const days = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-day]'))
      .filter((button) => !button.disabled);
    fireEvent.click(days[days.length - 1]);

    expect(await screen.findByText(/Aucun séjour ce jour-là/)).toBeTruthy();
  });

  it('rend le calendrier hégirien en arabe', async () => {
    // Umm al-Qura, pas une traduction du grégorien : le mois affiché n'est pas
    // le même. On le reconnaît aux chiffres arabes de react-day-picker.
    vi.mocked(useTranslation).mockReturnValue({
      t: ((key: string, arg?: unknown) =>
        typeof arg === 'string' ? arg : (arg as { defaultValue?: string })?.defaultValue ?? key) as never,
      isArabic: true,
    } as never);

    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /Replanifier/ }));
    await screen.findByLabelText(/Heure/);

    const days = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-day]'));
    expect(days.length).toBeGreaterThan(0);
    // Les libellés des jours sont en chiffres arabes-indiens (٠١٢…).
    expect(days.some((button) => /[\u0660-\u0669]/.test(button.textContent ?? ''))).toBe(true);
  });

  it('affiche le formulaire de replanification sans tomber en erreur', async () => {
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: /Replanifier/ }));

    // Les trois choix du formulaire : quand, par qui, et pour quel séjour.
    expect(await screen.findByLabelText(/Heure/)).toBeTruthy();
    expect(screen.getByText(/Prestataire/)).toBeTruthy();
    expect(screen.getByText(/Séjour concerné/)).toBeTruthy();
    // Tant qu'aucune date n'est choisie, on ne prétend pas connaître les
    // disponibilités.
    expect(screen.getByText(/Choisissez une date/)).toBeTruthy();

    await waitFor(() => expect(screen.queryByTestId('crashed')).toBeNull());
  });
});
