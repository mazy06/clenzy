import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  TextField,
} from '@mui/material';
import {
  partnerConnectionApi,
  type PartnerServiceProvider,
} from '../../../services/api/partnerConnectionApi';

/**
 * Formulaire de connexion d'UN service partenaire du catalogue (scaffolding),
 * rendu DANS le modal de détail du service via le hook {@code configForService}
 * de {@link ServiceCatalogSection} — même pattern que ActivityProviderConfigForm.
 *
 * Les credentials sont chiffrées et enregistrées côté serveur ; aucun appel API
 * partenaire n'est encore effectué (note honnête affichée dans le formulaire).
 */
export default function PartnerServiceConfigForm({
  provider,
  serviceName,
}: {
  provider: PartnerServiceProvider;
  serviceName: string;
}) {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [connectedServerUrl, setConnectedServerUrl] = useState<string | null>(null);
  const [form, setForm] = useState({ serverUrl: '', accountIdentifier: '', apiKey: '' });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    partnerConnectionApi
      .getStatus(provider)
      .then((s) => {
        if (!active) return;
        setConnected(s.connected);
        setConnectedServerUrl(s.serverUrl ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [provider]);

  const handleConnect = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const status = await partnerConnectionApi.connect(provider, {
        serverUrl: form.serverUrl.trim(),
        accountIdentifier: form.accountIdentifier.trim() || undefined,
        apiKey: form.apiKey.trim(),
      });
      setConnected(status.connected);
      setConnectedServerUrl(status.serverUrl ?? null);
      setForm({ serverUrl: '', accountIdentifier: '', apiKey: '' });
      setMessage({ type: 'success', text: 'Accès enregistrés (chiffrés).' });
    } catch {
      setMessage({ type: 'error', text: "Impossible d'enregistrer les accès. Vérifiez l'URL (https://…) et la clé API (8 caractères minimum)." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      await partnerConnectionApi.disconnect(provider);
      setConnected(false);
      setConnectedServerUrl(null);
      setMessage({ type: 'success', text: 'Connexion supprimée.' });
    } catch {
      setMessage({ type: 'error', text: 'Impossible de supprimer la connexion.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={22} />
      </Box>
    );
  }

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5, mb: 1.5 }}>
      <Alert severity="info" variant="outlined" sx={{ borderRadius: '8px', fontSize: '0.74rem', mb: 1.25 }}>
        Vos accès {serviceName} sont chiffrés et enregistrés dès maintenant ; la
        synchronisation native sera activée dans une prochaine release.
      </Alert>

      {connected ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label="Accès enregistrés"
            size="small"
            sx={{
              height: 20,
              fontSize: '0.66rem',
              fontWeight: 700,
              color: 'var(--ok)',
              backgroundColor: 'var(--ok-soft)',
              border: '1px solid color-mix(in srgb, var(--ok) 25%, transparent)',
            }}
          />
          {connectedServerUrl && (
            <Box component="span" sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
              {connectedServerUrl}
            </Box>
          )}
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={handleDisconnect}
            disabled={submitting}
            sx={{ ml: 'auto', textTransform: 'none', fontWeight: 600, fontSize: '0.74rem', borderRadius: '8px' }}
          >
            Déconnecter
          </Button>
        </Box>
      ) : (
        <>
          <TextField
            label="URL de l'API"
            placeholder="https://api.exemple.com"
            value={form.serverUrl}
            onChange={(e) => setForm((f) => ({ ...f, serverUrl: e.target.value }))}
            size="small"
            fullWidth
            sx={{ mb: 1 }}
          />
          <TextField
            label="Identifiant de compte (optionnel)"
            value={form.accountIdentifier}
            onChange={(e) => setForm((f) => ({ ...f, accountIdentifier: e.target.value }))}
            size="small"
            fullWidth
            sx={{ mb: 1 }}
          />
          <TextField
            label="Clé API"
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
            size="small"
            fullWidth
            sx={{ mb: 1 }}
          />
          <Button
            size="small"
            variant="contained"
            onClick={handleConnect}
            disabled={submitting || !form.serverUrl.trim() || form.apiKey.trim().length < 8}
            startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : undefined}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Enregistrer les accès
          </Button>
        </>
      )}

      {message && (
        <Alert severity={message.type} variant="outlined" sx={{ borderRadius: '8px', fontSize: '0.74rem', mt: 1.25 }}>
          {message.text}
        </Alert>
      )}
    </Box>
  );
}
