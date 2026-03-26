import { useState, useCallback } from 'react';
import { bookingEngineApi, GuestProfile, GuestRegisterData, GuestLoginData } from '../services/api/bookingEngineApi';

interface GuestSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  profile: GuestProfile;
}

interface UseGuestAuthReturn {
  session: GuestSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  register: (data: Omit<GuestRegisterData, 'organizationId'>) => Promise<boolean>;
  login: (data: Omit<GuestLoginData, 'organizationId'>) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  setError: (msg: string) => void;
  forgotPassword: (email: string) => Promise<void>;
  resetPasswordSent: boolean;
}

export function useGuestAuth(organizationId: number | null): UseGuestAuthReturn {
  const [session, setSession] = useState<GuestSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetPasswordSent, setResetPasswordSent] = useState(false);

  const register = useCallback(async (data: Omit<GuestRegisterData, 'organizationId'>): Promise<boolean> => {
    if (!organizationId) {
      setError('Organisation non sélectionnée');
      return false;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await bookingEngineApi.guestRegister({
        ...data,
        organizationId,
      });
      setSession(response);
      return true;
    } catch (err: unknown) {
      const message = extractErrorMessage(err, 'Erreur lors de l\'inscription');
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  const login = useCallback(async (data: Omit<GuestLoginData, 'organizationId'>): Promise<boolean> => {
    if (!organizationId) {
      setError('Organisation non sélectionnée');
      return false;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await bookingEngineApi.guestLogin({
        ...data,
        organizationId,
      });
      setSession(response);
      return true;
    } catch (err: unknown) {
      const message = extractErrorMessage(err, 'Email ou mot de passe incorrect');
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  const logout = useCallback(() => {
    setSession(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const forgotPassword = useCallback(async (email: string) => {
    if (!organizationId) {
      setError('Organisation non configurée');
      return;
    }
    setIsLoading(true);
    setError(null);
    setResetPasswordSent(false);
    try {
      await bookingEngineApi.guestForgotPassword({ email, organizationId });
      setResetPasswordSent(true);
    } catch (err: unknown) {
      const message = extractErrorMessage(err, 'Erreur lors de l\'envoi du lien de réinitialisation');
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  return {
    session,
    isAuthenticated: session !== null,
    isLoading,
    error,
    register,
    login,
    logout,
    clearError,
    setError,
    forgotPassword,
    resetPasswordSent,
  };
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response;
    if (response?.data?.error) return response.data.error;
  }
  return fallback;
}
