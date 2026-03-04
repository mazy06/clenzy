import { useState, useCallback, useEffect } from 'react';
import { keyExchangeApi } from '../services/api/keyExchangeApi';
import { trackEvent } from '../providers/PostHogProvider';
import type {
  KeyExchangePointDto,
  CreateKeyExchangePointDto,
  KeyExchangeCodeDto,
  CreateKeyExchangeCodeDto,
} from '../services/api/keyExchangeApi';

// ─── Types ───────────────────────────────────────────────────────────────────

export type KeyExchangeView = 'offers' | 'keyvault' | 'keynest' | 'history';

export interface KeyVaultFormState {
  propertyId: number | null;
  guardianType: 'MERCHANT' | 'INDIVIDUAL';
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeOpeningHours: string;
}

export interface CodeFormState {
  pointId: number | null;
  guestName: string;
  codeType: 'COLLECTION' | 'DROP_OFF';
  validFrom: string;
  validUntil: string;
}

const INITIAL_KEYVAULT_FORM: KeyVaultFormState = {
  propertyId: null,
  guardianType: 'MERCHANT',
  storeName: '',
  storeAddress: '',
  storePhone: '',
  storeOpeningHours: '',
};

const INITIAL_CODE_FORM: CodeFormState = {
  pointId: null,
  guestName: '',
  codeType: 'COLLECTION',
  validFrom: '',
  validUntil: '',
};

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useKeyExchange() {
  // View routing
  const [currentView, setCurrentView] = useState<KeyExchangeView>('offers');

  // Points state
  const [points, setPoints] = useState<KeyExchangePointDto[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(false);

  // Codes state
  const [activeCodes, setActiveCodes] = useState<KeyExchangeCodeDto[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);

  // Form state
  const [keyVaultForm, setKeyVaultForm] = useState<KeyVaultFormState>(INITIAL_KEYVAULT_FORM);
  const [codeForm, setCodeForm] = useState<CodeFormState>(INITIAL_CODE_FORM);

  // Loading / error
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPoints = points.length > 0;
  const keyvaultPoints = points.filter(p => p.provider === 'CLENZY_KEYVAULT');
  const keynestPoints = points.filter(p => p.provider === 'KEYNEST');

  // ─── Fetch points on mount ──────────────────────────────────────────

  const fetchPoints = useCallback(async () => {
    setLoadingPoints(true);
    try {
      const data = await keyExchangeApi.getPoints();
      setPoints(Array.isArray(data) ? data : []);
    } catch {
      setPoints([]);
    }
    setLoadingPoints(false);
  }, []);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  // ─── Auto-navigate to correct view after fetching points ────────────

  useEffect(() => {
    if (!loadingPoints && hasPoints && currentView === 'offers') {
      // If user has keyvault points, show keyvault view
      const hasKeyVault = points.some(p => p.provider === 'CLENZY_KEYVAULT');
      const hasKeyNest = points.some(p => p.provider === 'KEYNEST');
      if (hasKeyVault) setCurrentView('keyvault');
      else if (hasKeyNest) setCurrentView('keynest');
    }
  }, [loadingPoints, hasPoints, points, currentView]);

  // ─── Create point ──────────────────────────────────────────────────

  const createPoint = useCallback(async (data: CreateKeyExchangePointDto) => {
    setSubmitting(true);
    setError(null);
    try {
      const created = await keyExchangeApi.createPoint(data);
      setPoints(prev => [...prev, created]);
      setKeyVaultForm(INITIAL_KEYVAULT_FORM);
      trackEvent.keyExchangePointConfigured({
        provider: data.provider || 'KEYVAULT',
        pointId: created.id,
      });
      return created;
    } catch (e: any) {
      const msg = e?.message || 'Erreur lors de la creation du point';
      setError(msg);
      throw e;
    } finally {
      setSubmitting(false);
    }
  }, []);

  // ─── Delete point ─────────────────────────────────────────────────

  const deletePoint = useCallback(async (id: number) => {
    setSubmitting(true);
    setError(null);
    try {
      await keyExchangeApi.deletePoint(id);
      setPoints(prev => prev.filter(p => p.id !== id));
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la suppression');
    } finally {
      setSubmitting(false);
    }
  }, []);

  // ─── Fetch codes for a point ──────────────────────────────────────

  const fetchCodes = useCallback(async (pointId: number) => {
    setLoadingCodes(true);
    try {
      const data = await keyExchangeApi.getActiveCodesByPoint(pointId);
      setActiveCodes(Array.isArray(data) ? data : []);
    } catch {
      setActiveCodes([]);
    }
    setLoadingCodes(false);
  }, []);

  // ─── Generate code ────────────────────────────────────────────────

  const generateCode = useCallback(async (data: CreateKeyExchangeCodeDto) => {
    setSubmitting(true);
    setError(null);
    try {
      const created = await keyExchangeApi.generateCode(data);
      setActiveCodes(prev => [...prev, created]);
      setCodeForm(INITIAL_CODE_FORM);
      trackEvent.keyCodeGenerated({
        provider: data.pointId ? 'keyvault' : 'keynest',
        method: 'manual',
        pointId: data.pointId ?? undefined,
      });
      return created;
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la generation du code');
      throw e;
    } finally {
      setSubmitting(false);
    }
  }, []);

  // ─── Cancel code ──────────────────────────────────────────────────

  const cancelCode = useCallback(async (id: number) => {
    setSubmitting(true);
    setError(null);
    try {
      await keyExchangeApi.cancelCode(id);
      setActiveCodes(prev => prev.filter(c => c.id !== id));
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de l\'annulation');
    } finally {
      setSubmitting(false);
    }
  }, []);

  // ─── Form helpers ─────────────────────────────────────────────────

  const setKeyVaultField = useCallback(<K extends keyof KeyVaultFormState>(
    key: K, value: KeyVaultFormState[K],
  ) => {
    setKeyVaultForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const setCodeField = useCallback(<K extends keyof CodeFormState>(
    key: K, value: CodeFormState[K],
  ) => {
    setCodeForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetKeyVaultForm = useCallback(() => setKeyVaultForm(INITIAL_KEYVAULT_FORM), []);
  const resetCodeForm = useCallback(() => setCodeForm(INITIAL_CODE_FORM), []);

  return {
    // View
    currentView,
    setView: setCurrentView,
    // Points
    points,
    keyvaultPoints,
    keynestPoints,
    hasPoints,
    loadingPoints,
    fetchPoints,
    createPoint,
    deletePoint,
    // Codes
    activeCodes,
    loadingCodes,
    fetchCodes,
    generateCode,
    cancelCode,
    // Forms
    keyVaultForm,
    setKeyVaultField,
    resetKeyVaultForm,
    codeForm,
    setCodeField,
    resetCodeForm,
    // State
    submitting,
    error,
    setError,
  };
}
