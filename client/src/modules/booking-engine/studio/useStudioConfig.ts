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
  /** Patch local + persistance immédiate (PUT) du payload fusionné — pour les changements qui doivent être
   *  sauvegardés tout de suite (ex. bibliothèque de composites), sans attendre un clic « Enregistrer ». */
  patchPersist: (changes: Partial<BookingEngineConfig>) => Promise<void>;
  save: () => Promise<void>;
  /** Régénère la clé API (invalide l'ancienne immédiatement). */
  regenerateKey: () => Promise<void>;
  /** Active / désactive le booking engine. */
  setEnabled: (enabled: boolean) => Promise<void>;
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

  const patchPersist = useCallback(async (changes: Partial<BookingEngineConfig>) => {
    if (!config || !id) { setConfig((prev) => (prev ? { ...prev, ...changes } : prev)); return; }
    // Fusionne explicitement (≠ lire l'état après setConfig, qui serait obsolète) puis PUT le payload complet.
    const merged = { ...config, ...changes };
    setConfig(merged);
    setSaving(true);
    setError(null);
    try {
      const updated = await bookingEngineApi.updateConfig(id, toUpdatePayload(merged));
      setConfig(updated);
      setOriginal(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible');
      throw e;
    } finally {
      setSaving(false);
    }
  }, [config, id]);

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

  // Met à jour un champ géré hors payload (apiKey/enabled) dans le brouillon ET la base,
  // pour ne pas fausser l'état dirty ni écraser les autres éditions en cours.
  const adoptManaged = useCallback((changes: Partial<BookingEngineConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...changes } : prev));
    setOriginal((prev) => (prev ? { ...prev, ...changes } : prev));
  }, []);

  const regenerateKey = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const updated = await bookingEngineApi.regenerateApiKey(id);
      adoptManaged({ apiKey: updated.apiKey });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Régénération de la clé impossible');
      throw e;
    }
  }, [id, adoptManaged]);

  const setEnabled = useCallback(async (enabled: boolean) => {
    if (!id) return;
    setError(null);
    try {
      const updated = await bookingEngineApi.toggleEnabled(id, enabled);
      adoptManaged({ enabled: updated.enabled });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Changement de statut impossible');
      throw e;
    }
  }, [id, adoptManaged]);

  const dirty = config !== null && original !== null && JSON.stringify(config) !== JSON.stringify(original);

  return { config, loading, error, saving, dirty, patch, patchPersist, save, regenerateKey, setEnabled };
}
