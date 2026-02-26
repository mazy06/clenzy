import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InscriptionSuccess from '../InscriptionSuccess';

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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('avec session_id valide', () => {
    it('affiche un message de chargement initialement', () => {
      renderSuccess('?session_id=cs_test_123');
      expect(screen.getByText(/Finalisation de votre inscription/i)).toBeInTheDocument();
    });

    it('affiche le succes apres le delai', async () => {
      renderSuccess('?session_id=cs_test_123');

      await act(async () => {
        vi.advanceTimersByTime(2500);
      });

      expect(screen.getByText(/Inscription reussie/i)).toBeInTheDocument();
    });

    it('affiche le message de confirmation de paiement', async () => {
      renderSuccess('?session_id=cs_test_123');

      await act(async () => {
        vi.advanceTimersByTime(2500);
      });

      expect(screen.getByText(/Votre compte a ete cree et votre paiement confirme/i)).toBeInTheDocument();
    });

    it('affiche le bouton Se connecter', async () => {
      renderSuccess('?session_id=cs_test_123');

      await act(async () => {
        vi.advanceTimersByTime(2500);
      });

      expect(screen.getByRole('button', { name: /Se connecter/i })).toBeInTheDocument();
    });

    it('affiche le logo Clenzy', () => {
      renderSuccess('?session_id=cs_test_123');
      expect(screen.getByTestId('clenzy-logo')).toBeInTheDocument();
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
      expect(screen.queryByText(/Inscription reussie/i)).not.toBeInTheDocument();
    });
  });
});
