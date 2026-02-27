import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InscriptionSuccess from '../InscriptionSuccess';

// Mock apiClient
const mockPost = vi.fn();
vi.mock('../../../services/apiClient', () => ({
  default: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

// Mock ClenzyAnimatedLogo
vi.mock('../../../components/ClenzyAnimatedLogo', () => ({
  default: () => <div data-testid="clenzy-logo">Logo</div>,
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderSuccess(searchParams = '') {
  return render(
    <MemoryRouter initialEntries={[`/inscription/success${searchParams}`]}>
      <InscriptionSuccess />
    </MemoryRouter>,
  );
}

describe('InscriptionSuccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Simuler un email stocke en sessionStorage
    sessionStorage.setItem('inscription_email', 'jean@test.com');
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  describe('avec session_id valide', () => {
    it('affiche un message de chargement initialement', () => {
      renderSuccess('?session_id=cs_test_123');
      expect(screen.getByText(/Finalisation de votre paiement/i)).toBeInTheDocument();
    });

    it('affiche le message de verification email apres le delai', async () => {
      renderSuccess('?session_id=cs_test_123');

      await act(async () => {
        vi.advanceTimersByTime(2500);
      });

      expect(screen.getByText(/Verifiez votre boite email/i)).toBeInTheDocument();
    });

    it('affiche le message de confirmation de paiement', async () => {
      renderSuccess('?session_id=cs_test_123');

      await act(async () => {
        vi.advanceTimersByTime(2500);
      });

      expect(screen.getByText(/Votre paiement a ete confirme avec succes/i)).toBeInTheDocument();
    });

    it('affiche le bouton Renvoyer l email', async () => {
      renderSuccess('?session_id=cs_test_123');

      await act(async () => {
        vi.advanceTimersByTime(2500);
      });

      expect(screen.getByRole('button', { name: /Renvoyer l'email/i })).toBeInTheDocument();
    });

    it('affiche la note pour verifier les spams', async () => {
      renderSuccess('?session_id=cs_test_123');

      await act(async () => {
        vi.advanceTimersByTime(2500);
      });

      expect(screen.getByText(/Verifiez vos spams/i)).toBeInTheDocument();
    });

    it('affiche l email de l utilisateur', async () => {
      renderSuccess('?session_id=cs_test_123');

      await act(async () => {
        vi.advanceTimersByTime(2500);
      });

      expect(screen.getByText(/jean@test.com/i)).toBeInTheDocument();
    });

    it('affiche le logo Clenzy', () => {
      renderSuccess('?session_id=cs_test_123');
      expect(screen.getByTestId('clenzy-logo')).toBeInTheDocument();
    });

    it('appelle l API pour renvoyer l email quand on clique', async () => {
      mockPost.mockResolvedValueOnce({});
      renderSuccess('?session_id=cs_test_123');

      await act(async () => {
        vi.advanceTimersByTime(2500);
      });

      // Passer en real timers pour le clic async
      vi.useRealTimers();

      fireEvent.click(screen.getByRole('button', { name: /Renvoyer l'email/i }));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/public/inscription/resend-confirmation',
          { email: 'jean@test.com' },
          { skipAuth: true },
        );
      });
    });

    it('affiche un message de succes apres renvoi', async () => {
      mockPost.mockResolvedValueOnce({});
      renderSuccess('?session_id=cs_test_123');

      await act(async () => {
        vi.advanceTimersByTime(2500);
      });

      vi.useRealTimers();

      fireEvent.click(screen.getByRole('button', { name: /Renvoyer l'email/i }));

      await waitFor(() => {
        expect(screen.getByText(/Un nouveau lien de confirmation a ete envoye/i)).toBeInTheDocument();
      });
    });
  });

  describe('sans session_id', () => {
    it('affiche un message d erreur', () => {
      renderSuccess();
      expect(screen.getByText(/Session introuvable/i)).toBeInTheDocument();
    });

    it('affiche un bouton de retour a la connexion', () => {
      renderSuccess();
      expect(screen.getByRole('button', { name: /Retour a la connexion/i })).toBeInTheDocument();
    });

    it('n affiche pas le message de succes', () => {
      renderSuccess();
      expect(screen.queryByText(/Verifiez votre boite email/i)).not.toBeInTheDocument();
    });
  });
});
