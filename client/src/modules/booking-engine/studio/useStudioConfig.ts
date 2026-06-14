import { useCallback, useEffect, useState } from 'react';
import {
  bookingEngineApi,
  type BookingEngineConfig,
  type BookingEngineConfigUpdate,
} from '../../../services/api/bookingEngineApi';

/**
 * État partagé de la config du booking engine en cours d'édition dans le Studio (F3).
 * Charge la config par ID, garde un brouillon local éditable, calcule l'état « dirty »,
 * et persiste via un PUT du payload complet (l'API attend l'objet entier).
 */

function toUpdatePayload(c: BookingEngineConfig): BookingEngineConfigUpdate {
  const { id: _id, organizationId: _org, apiKey: _key, enabled: _enabled, organizationName: _name, ...rest } = c;
  return rest;
}

export interface StudioConfigState {
  config: BookingEngineConfig | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  dirty: boolean;
  patch: (changes: Partial<BookingEngineConfig>) => void;
  save: () => Promise<void>;
}

export function useStudioConfig(id: number | undefined): StudioConfigState {
  const [config, setConfig] = useState<BookingEngineConfig | null>(null);
  const [original, setOriginal] = useState<BookingEngineConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    setError(null);
    bookingEngineApi.getConfigById(id)
      .then((c) => { if (alive) { setConfig(c); setOriginal(c); } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Chargement impossible'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  const patch = useCallback((changes: Partial<BookingEngineConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...changes } : prev));
  }, []);

  const save = useCallback(async () => {
    if (!config || !id) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await bookingEngineApi.updateConfig(id, toUpdatePayload(config));
      setConfig(updated);
      setOriginal(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible');
      throw e;
    } finally {
      setSaving(false);
    }
  }, [config, id]);

  const dirty = config !== null && original !== null && JSON.stringify(config) !== JSON.stringify(original);

  return { config, loading, error, saving, dirty, patch, save };
}
