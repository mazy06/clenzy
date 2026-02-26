import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

// mockGet retourne les prix par defaut pour /public/pricing-info (configure dans beforeEach)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderInscription(searchParams = '') {
  return render(
    <MemoryRouter initialEntries={[`/inscription${searchParams}`]}>
      <Inscription />
    </MemoryRouter>,
  );
}

/** Helper : va au step 2 avec des donnees valides pre-remplies */
function goToStep2() {
  renderInscription('?email=jean@test.com&fullName=Jean+Dupont&forfait=essentiel');
  fireEvent.click(screen.getByRole('button', { name: /Suivant/i }));
}

/** Helper : remplit les mots de passe dans le step 2 */
function fillPasswords(password = 'MotDePasse123!') {
  // Les 2 champs password sont rendus dans l'ordre : Mot de passe, Confirmer
  const passwordInputs = screen.getAllByDisplayValue('');
  const pwFields = passwordInputs.filter(
    (el) => el.getAttribute('type') === 'password',
  );
  fireEvent.change(pwFields[0], { target: { value: password } });
  fireEvent.change(pwFields[1], { target: { value: password } });
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
    it('affiche 3 etapes dans le stepper', () => {
      renderInscription();
      expect(screen.getByText('Vos informations')).toBeInTheDocument();
      expect(screen.getByText('Votre mot de passe')).toBeInTheDocument();
      expect(screen.getByText('Paiement')).toBeInTheDocument();
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

    it('desactive le bouton Suivant si les champs obligatoires sont vides', () => {
      renderInscription();
      const suivantBtn = screen.getByRole('button', { name: /Suivant/i });
      expect(suivantBtn).toBeDisabled();
    });

    it('active le bouton Suivant quand les champs obligatoires sont remplis', () => {
      renderInscription('?email=jean@test.com&fullName=Jean+Dupont&forfait=essentiel');
      const suivantBtn = screen.getByRole('button', { name: /Suivant/i });
      expect(suivantBtn).toBeEnabled();
    });

    it('affiche le badge forfait quand pre-rempli', () => {
      renderInscription('?forfait=essentiel&email=jean@test.com');
      expect(screen.getByText('Forfait Essentiel')).toBeInTheDocument();
    });
  });

  describe('Navigation Step 1 → Step 2', () => {
    it('passe a l etape 2 quand on clique Suivant avec donnees valides', () => {
      goToStep2();
      // On doit voir les champs mot de passe (2 inputs type="password")
      const pwFields = screen.getAllByDisplayValue('').filter(
        (el) => el.getAttribute('type') === 'password',
      );
      expect(pwFields).toHaveLength(2);
    });
  });

  describe('Etape 2 - Mot de passe', () => {
    it('affiche le recapitulatif avec les infos saisies', () => {
      goToStep2();
      expect(screen.getByText('Recapitulatif')).toBeInTheDocument();
      expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
      expect(screen.getByText('jean@test.com')).toBeInTheDocument();
    });

    it('affiche le bouton "Continuer vers le paiement"', () => {
      goToStep2();
      expect(screen.getByRole('button', { name: /Continuer vers le paiement/i })).toBeInTheDocument();
    });

    it('desactive le bouton si le mot de passe est trop court', () => {
      goToStep2();
      fillPasswords('1234');
      expect(screen.getByRole('button', { name: /Continuer vers le paiement/i })).toBeDisabled();
    });

    it('active le bouton quand les mots de passe sont valides et identiques', () => {
      goToStep2();
      fillPasswords('MotDePasse123!');
      expect(screen.getByRole('button', { name: /Continuer vers le paiement/i })).toBeEnabled();
    });

    it('permet de revenir a l etape 1 avec le bouton Retour', () => {
      goToStep2();
      fireEvent.click(screen.getByRole('button', { name: /Retour/i }));
      expect(screen.getByLabelText(/Nom complet/i)).toBeInTheDocument();
    });
  });

  describe('Etape 2 → Etape 3 (Paiement)', () => {
    async function goToStep3() {
      mockPost.mockResolvedValueOnce({
        clientSecret: 'cs_test_secret_123',
        sessionId: 'cs_session_123',
      });

      renderInscription('?email=jean@test.com&fullName=Jean+Dupont&forfait=essentiel');

      // Step 1 → Step 2
      fireEvent.click(screen.getByRole('button', { name: /Suivant/i }));

      // Fill passwords
      fillPasswords('MotDePasse123!');

      // Step 2 → Step 3
      fireEvent.click(screen.getByRole('button', { name: /Continuer vers le paiement/i }));
    }

    it('appelle l API /public/inscription avec les bonnes donnees', async () => {
      await goToStep3();

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/public/inscription',
          expect.objectContaining({
            fullName: 'Jean Dupont',
            email: 'jean@test.com',
            forfait: 'essentiel',
            billingPeriod: 'MONTHLY',
            password: 'MotDePasse123!',
          }),
          { skipAuth: true },
        );
      });
    });

    it('affiche le Stripe Embedded Checkout au step 3', async () => {
      await goToStep3();

      await waitFor(() => {
        expect(screen.getByTestId('stripe-checkout-provider')).toBeInTheDocument();
        expect(screen.getByTestId('stripe-embedded-checkout')).toBeInTheDocument();
      });
    });

    it('affiche le recapitulatif de commande dans le step 3', async () => {
      await goToStep3();

      await waitFor(() => {
        expect(screen.getByText('Paiement securise via Stripe')).toBeInTheDocument();
        expect(screen.getByText('Total a payer')).toBeInTheDocument();
      });
    });

    it('cache les boutons navigation et le lien login au step 3', async () => {
      await goToStep3();

      await waitFor(() => {
        expect(screen.getByTestId('stripe-embedded-checkout')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /Suivant/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Retour$/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/Deja un compte/i)).not.toBeInTheDocument();
    });
  });

  describe('Gestion des erreurs', () => {
    it('affiche une erreur si l API retourne 409 (email deja existant)', async () => {
      const error = new Error('Email already exists');
      (error as any).status = 409;
      mockPost.mockRejectedValueOnce(error);

      renderInscription('?email=jean@test.com&fullName=Jean+Dupont&forfait=essentiel');

      // Go to step 2
      fireEvent.click(screen.getByRole('button', { name: /Suivant/i }));

      // Fill passwords and submit
      fillPasswords('MotDePasse123!');
      fireEvent.click(screen.getByRole('button', { name: /Continuer vers le paiement/i }));

      await waitFor(() => {
        expect(screen.getByText(/Un compte existe deja avec cette adresse email/i)).toBeInTheDocument();
      });
    });

    it('affiche une erreur si la reponse ne contient pas de clientSecret', async () => {
      mockPost.mockResolvedValueOnce({ sessionId: 'cs_test' });

      renderInscription('?email=jean@test.com&fullName=Jean+Dupont&forfait=essentiel');
      fireEvent.click(screen.getByRole('button', { name: /Suivant/i }));
      fillPasswords('MotDePasse123!');
      fireEvent.click(screen.getByRole('button', { name: /Continuer vers le paiement/i }));

      await waitFor(() => {
        expect(screen.getByText(/Erreur lors de la creation de la session de paiement/i)).toBeInTheDocument();
      });
    });
  });

  describe('Lien login', () => {
    it('affiche le lien "Se connecter" aux etapes 1 et 2', () => {
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

    it('desactive Suivant si Conciergerie selectionne sans nom de societe', () => {
      renderInscription('?email=jean@test.com&fullName=Jean+Dupont&forfait=essentiel');
      fireEvent.click(screen.getByText('Conciergerie'));
      const suivantBtn = screen.getByRole('button', { name: /Suivant/i });
      expect(suivantBtn).toBeDisabled();
    });

    it('active Suivant quand Conciergerie + nom de societe rempli', () => {
      renderInscription('?email=jean@test.com&fullName=Jean+Dupont&forfait=essentiel');
      fireEvent.click(screen.getByText('Conciergerie'));
      fireEvent.change(screen.getByLabelText(/Nom de la societe/i), { target: { value: 'Ma Conciergerie' } });
      const suivantBtn = screen.getByRole('button', { name: /Suivant/i });
      expect(suivantBtn).toBeEnabled();
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
      // Step 1 -> Step 2
      fireEvent.click(screen.getByRole('button', { name: /Suivant/i }));
      // Remplir les mots de passe
      fillPasswords('MotDePasse123!');
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
      // Rester en Particulier (defaut)
      // Step 1 -> Step 2
      fireEvent.click(screen.getByRole('button', { name: /Suivant/i }));
      fillPasswords('MotDePasse123!');
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
