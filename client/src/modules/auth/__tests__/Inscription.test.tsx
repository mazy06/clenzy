import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Inscription from '../Inscription';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock apiClient
const mockPost = vi.fn();
const mockGet = vi.fn();
vi.mock('../../../services/apiClient', () => ({
  default: {
    post: (...args: unknown[]) => mockPost(...args),
    get: (...args: unknown[]) => mockGet(...args),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

// Mock ClenzyAnimatedLogo
vi.mock('../../../components/ClenzyAnimatedLogo', () => ({
  default: () => <div data-testid="clenzy-logo">Logo</div>,
}));

// Mock Stripe
vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(() => Promise.resolve({})),
}));

vi.mock('@stripe/react-stripe-js', () => ({
  EmbeddedCheckoutProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="stripe-checkout-provider">{children}</div>
  ),
  EmbeddedCheckout: () => <div data-testid="stripe-embedded-checkout">Stripe Checkout Form</div>,
}));

// Prix de test (arbitraires — volontairement differents pour distinguer sync vs standard)
// Si les tarifs changent en prod, ces tests restent valides car ils utilisent ces mocks.
const MOCK_PMS_MONTHLY_CENTS = 4200;  // 42€/mois — valeur arbitraire
const MOCK_PMS_SYNC_CENTS = 7800;     // 78€/mois — valeur arbitraire

// Helpers pour calculer le prix attendu a partir des mocks (meme logique que le composant)
function expectedPriceEuros(cents: number): string {
  const euros = cents / 100;
  return euros % 1 === 0 ? `${euros}€` : `${euros.toFixed(2).replace('.', ',')}€`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderInscription(searchParams = '') {
  return render(
    <MemoryRouter initialEntries={[`/inscription${searchParams}`]}>
      <Inscription />
    </MemoryRouter>,
  );
}

/** Helper : soumet le formulaire et attend la transition vers le step paiement */
async function goToPaymentStep() {
  mockPost.mockResolvedValueOnce({
    clientSecret: 'cs_test_secret_123',
    sessionId: 'cs_session_123',
  });

  renderInscription('?email=jean@test.com&fullName=Jean+Dupont&forfait=essentiel');

  // Cliquer sur "Continuer vers le paiement" (soumission directe)
  fireEvent.click(screen.getByRole('button', { name: /Continuer vers le paiement/i }));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Inscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Par defaut, mockGet retourne les prix de test pour /public/pricing-info
    mockGet.mockResolvedValue({
      pmsMonthlyPriceCents: MOCK_PMS_MONTHLY_CENTS,
      pmsSyncPriceCents: MOCK_PMS_SYNC_CENTS,
    });
  });

  describe('Stepper', () => {
    it('affiche 2 etapes dans le stepper', () => {
      renderInscription();
      expect(screen.getByText('Vos informations')).toBeInTheDocument();
      expect(screen.getByText('Paiement')).toBeInTheDocument();
      // L etape mot de passe n existe plus
      expect(screen.queryByText('Votre mot de passe')).not.toBeInTheDocument();
    });

    it('demarre a l etape 1 (informations)', () => {
      renderInscription();
      expect(screen.getByLabelText(/Nom complet/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    });
  });

  describe('Etape 1 - Informations', () => {
    it('affiche les champs nom, email, telephone et les chips type orga', () => {
      renderInscription();
      expect(screen.getByLabelText(/Nom complet/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Telephone/i)).toBeInTheDocument();
      // Chips type d'organisation
      expect(screen.getByText('Particulier')).toBeInTheDocument();
      expect(screen.getByText('Conciergerie')).toBeInTheDocument();
      expect(screen.getByText('Societe de menage')).toBeInTheDocument();
      // Champ societe cache par defaut (mode Particulier)
      expect(screen.queryByLabelText(/Nom de la societe/i)).not.toBeInTheDocument();
    });

    it('affiche les periodes de facturation', () => {
      renderInscription();
      expect(screen.getByText('Mensuel')).toBeInTheDocument();
      expect(screen.getByText('Annuel')).toBeInTheDocument();
      expect(screen.getByText('2 ans')).toBeInTheDocument();
    });

    it('pre-remplit les champs depuis les query params', () => {
      renderInscription('?email=jean@test.com&fullName=Jean+Dupont&forfait=essentiel&billingPeriod=MONTHLY');
      expect(screen.getByDisplayValue('jean@test.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Jean Dupont')).toBeInTheDocument();
    });

    it('desactive le bouton si les champs obligatoires sont vides', () => {
      renderInscription();
      const btn = screen.getByRole('button', { name: /Continuer vers le paiement/i });
      expect(btn).toBeDisabled();
    });

    it('active le bouton quand les champs obligatoires sont remplis', () => {
      renderInscription('?email=jean@test.com&fullName=Jean+Dupont&forfait=essentiel');
      const btn = screen.getByRole('button', { name: /Continuer vers le paiement/i });
      expect(btn).toBeEnabled();
    });

    it('affiche le badge forfait quand pre-rempli', () => {
      renderInscription('?forfait=essentiel&email=jean@test.com');
      expect(screen.getByText('Forfait Essentiel')).toBeInTheDocument();
    });
  });

  describe('Soumission vers le paiement', () => {
    it('appelle l API /public/inscription sans mot de passe', async () => {
      await goToPaymentStep();

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/public/inscription',
          expect.objectContaining({
            fullName: 'Jean Dupont',
            email: 'jean@test.com',
            forfait: 'essentiel',
            billingPeriod: 'MONTHLY',
          }),
          { skipAuth: true },
        );
        // Le mot de passe ne doit PAS etre envoye
        const callArgs = mockPost.mock.calls[0][1];
        expect(callArgs.password).toBeUndefined();
      });
    });

    it('affiche le Stripe Embedded Checkout apres soumission', async () => {
      await goToPaymentStep();

      await waitFor(() => {
        expect(screen.getByTestId('stripe-checkout-provider')).toBeInTheDocument();
        expect(screen.getByTestId('stripe-embedded-checkout')).toBeInTheDocument();
      });
    });

    it('affiche le recapitulatif de commande au step paiement', async () => {
      await goToPaymentStep();

      await waitFor(() => {
        expect(screen.getByText('Paiement securise via Stripe')).toBeInTheDocument();
        expect(screen.getByText('Total a payer')).toBeInTheDocument();
      });
    });

    it('cache le bouton et le lien login au step paiement', async () => {
      await goToPaymentStep();

      await waitFor(() => {
        expect(screen.getByTestId('stripe-embedded-checkout')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /Continuer vers le paiement/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/Deja un compte/i)).not.toBeInTheDocument();
    });
  });

  describe('Gestion des erreurs', () => {
    it('affiche une erreur si l API retourne 409 (email deja existant)', async () => {
      const error = new Error('Email already exists');
      (error as any).status = 409;
      mockPost.mockRejectedValueOnce(error);

      renderInscription('?email=jean@test.com&fullName=Jean+Dupont&forfait=essentiel');

      // Soumettre directement
      fireEvent.click(screen.getByRole('button', { name: /Continuer vers le paiement/i }));

      await waitFor(() => {
        expect(screen.getByText(/Un compte existe deja avec cette adresse email/i)).toBeInTheDocument();
      });
    });

    it('affiche une erreur si la reponse ne contient pas de clientSecret', async () => {
      mockPost.mockResolvedValueOnce({ sessionId: 'cs_test' });

      renderInscription('?email=jean@test.com&fullName=Jean+Dupont&forfait=essentiel');
      fireEvent.click(screen.getByRole('button', { name: /Continuer vers le paiement/i }));

      await waitFor(() => {
        expect(screen.getByText(/Erreur lors de la creation de la session de paiement/i)).toBeInTheDocument();
      });
    });
  });

  describe('Lien login', () => {
    it('affiche le lien "Se connecter" a l etape informations', () => {
      renderInscription();
      expect(screen.getByText(/Se connecter/i)).toBeInTheDocument();
    });
  });

  describe('Type d organisation', () => {
    it('affiche le champ societe quand Conciergerie est selectionne', () => {
      renderInscription();
      // Par defaut, le champ societe n'est pas visible
      expect(screen.queryByLabelText(/Nom de la societe/i)).not.toBeInTheDocument();
      // Cliquer sur Conciergerie
      fireEvent.click(screen.getByText('Conciergerie'));
      expect(screen.getByLabelText(/Nom de la societe/i)).toBeInTheDocument();
    });

    it('cache le champ societe quand on revient a Particulier', () => {
      renderInscription();
      fireEvent.click(screen.getByText('Conciergerie'));
      expect(screen.getByLabelText(/Nom de la societe/i)).toBeInTheDocument();
      // Revenir a Particulier
      fireEvent.click(screen.getByText('Particulier'));
      expect(screen.queryByLabelText(/Nom de la societe/i)).not.toBeInTheDocument();
    });

    it('desactive le bouton si Conciergerie selectionne sans nom de societe', () => {
      renderInscription('?email=jean@test.com&fullName=Jean+Dupont&forfait=essentiel');
      fireEvent.click(screen.getByText('Conciergerie'));
      const btn = screen.getByRole('button', { name: /Continuer vers le paiement/i });
      expect(btn).toBeDisabled();
    });

    it('active le bouton quand Conciergerie + nom de societe rempli', () => {
      renderInscription('?email=jean@test.com&fullName=Jean+Dupont&forfait=essentiel');
      fireEvent.click(screen.getByText('Conciergerie'));
      fireEvent.change(screen.getByLabelText(/Nom de la societe/i), { target: { value: 'Ma Conciergerie' } });
      const btn = screen.getByRole('button', { name: /Continuer vers le paiement/i });
      expect(btn).toBeEnabled();
    });

    it('envoie organizationType dans l appel API', async () => {
      mockPost.mockResolvedValueOnce({
        clientSecret: 'cs_test_secret_123',
        sessionId: 'cs_session_123',
      });

      renderInscription('?email=jean@test.com&fullName=Jean+Dupont&forfait=essentiel');
      // Selectionner Conciergerie
      fireEvent.click(screen.getByText('Conciergerie'));
      // Remplir le nom de societe
      fireEvent.change(screen.getByLabelText(/Nom de la societe/i), { target: { value: 'Ma Conciergerie' } });
      // Soumettre
      fireEvent.click(screen.getByRole('button', { name: /Continuer vers le paiement/i }));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/public/inscription',
          expect.objectContaining({
            organizationType: 'CONCIERGE',
            companyName: 'Ma Conciergerie',
          }),
          { skipAuth: true },
        );
      });
    });

    it('n envoie pas companyName en mode Particulier', async () => {
      mockPost.mockResolvedValueOnce({
        clientSecret: 'cs_test_secret_123',
        sessionId: 'cs_session_123',
      });

      renderInscription('?email=jean@test.com&fullName=Jean+Dupont&forfait=essentiel');
      // Rester en Particulier (defaut) — soumettre directement
      fireEvent.click(screen.getByRole('button', { name: /Continuer vers le paiement/i }));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/public/inscription',
          expect.objectContaining({
            organizationType: 'INDIVIDUAL',
          }),
          { skipAuth: true },
        );
        // companyName doit etre undefined (pas envoye)
        const callArgs = mockPost.mock.calls[0][1];
        expect(callArgs.companyName).toBeUndefined();
      });
    });
  });

  describe('Mode sync (calendarSync=sync)', () => {
    it('affiche le label Synchro dans le badge forfait en mode sync', async () => {
      renderInscription('?forfait=premium&email=jean@test.com&fullName=Jean+Dupont&calendarSync=sync');
      expect(await screen.findByText(/Synchro/i)).toBeInTheDocument();
    });

    it('utilise le prix sync au lieu du prix standard en mode sync', async () => {
      renderInscription('?forfait=premium&email=jean@test.com&fullName=Jean+Dupont&calendarSync=sync');
      const expectedSync = expectedPriceEuros(MOCK_PMS_SYNC_CENTS);
      const expectedStandard = expectedPriceEuros(MOCK_PMS_MONTHLY_CENTS);
      // Le prix sync (derive du mock) doit apparaitre, pas le prix standard
      await waitFor(() => {
        const syncMatches = screen.getAllByText(new RegExp(expectedSync.replace('€', '€')));
        expect(syncMatches.length).toBeGreaterThan(0);
      });
      // Le prix standard ne doit PAS apparaitre
      expect(screen.queryAllByText(new RegExp(expectedStandard.replace('€', '€')))).toHaveLength(0);
    });

    it('utilise le prix standard en mode non-sync', async () => {
      renderInscription('?forfait=premium&email=jean@test.com&fullName=Jean+Dupont&calendarSync=manuel');
      const expectedSync = expectedPriceEuros(MOCK_PMS_SYNC_CENTS);
      const expectedStandard = expectedPriceEuros(MOCK_PMS_MONTHLY_CENTS);
      // Le prix standard (derive du mock) doit apparaitre, pas le prix sync
      await waitFor(() => {
        const standardMatches = screen.getAllByText(new RegExp(expectedStandard.replace('€', '€')));
        expect(standardMatches.length).toBeGreaterThan(0);
      });
      // Le prix sync ne doit PAS apparaitre
      expect(screen.queryAllByText(new RegExp(expectedSync.replace('€', '€')))).toHaveLength(0);
    });
  });
});
