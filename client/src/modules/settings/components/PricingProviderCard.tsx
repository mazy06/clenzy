import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  ErrorOutline,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
} from '../../../icons';
import {
  pricingConnectionApi,
  PRICING_PROVIDER_META,
  type PricingProvider,
  type PricingConnectionStatus,
} from '../../../services/api/pricingConnectionApi';
import ProviderLogo, { type ProviderId } from './ProviderLogos';

/**
 * Card de connexion pour PriceLabs / Beyond. Meme structure que
 * {@code ApiKeyProviderCard} mais ciblee sur l'API pricing. Pourrait etre
 * mutualisee dans un composant generique (refactor futur quand les patterns
 * seront stabilises sur 3+ domaines).
 */

const ACCENT = '#4A9B8E';
const DANGER = '#C97A7A';
const NEUTRAL = '#8A8378';

const statusChipSx = (color: string) => ({
  height: 22,
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.01em',
  borderRadius: '6px',
  px: 0.25,
  backgroundColor: `${color}14`,
  color,
  border: `1px solid ${color}33`,
  '& .MuiChip-icon': { color: `${color} !important`, ml: '6px', mr: '-2px' },
  '& .MuiChip-label': { px: 0.875 },
});

interface Props {
  provider: PricingProvider;
  onStatusChange?: (connected: boolean) => void;
}

const PricingProviderCard: React.FC<Props> = ({ provider, onStatusChange }) => {
  const meta = PRICING_PROVIDER_META[provider];

  const [status, setStatus] = useState<PricingConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ serverUrl: '', accountIdentifier: '', apiKey: '' });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  // Pattern "latest callback ref" — evite la boucle de render quand le parent
  // passe une arrow function inline (cf. ApiKeyProviderCard pour la rationale)
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    pricingConnectionApi.getStatus(provider)
      .then((s) => {
        if (mounted) {
          setStatus(s);
          onStatusChangeRef.current?.(!!s.connected);
        }
      })
      .catch(() => {
        if (mounted) {
          setStatus({ connected: false, providerType: provider });
          onStatusChangeRef.current?.(false);
        }
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [provider]);

  const handleConnect = useCallback(async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await pricingConnectionApi.connect(provider, {
        serverUrl: form.serverUrl,
        accountIdentifier: form.accountIdentifier || undefined,
        apiKey: form.apiKey,
      });
      setStatus(result);
      onStatusChangeRef.current?.(!!result.connected);
      setMessage({ type: 'success', text: `${meta.label} : connexion enregistrée.` });
      setForm((f) => ({ ...f, apiKey: '' }));
    } catch (err) {
      const msg = (err as { body?: { message?: string } } | null)?.body?.message
        ?? `Erreur de connexion ${meta.label}. Vérifiez vos credentials.`;
      setMessage({ type: 'error', text: msg });
    } finally {
      setSubmitting(false);
    }
  }, [provider, form, meta.label]);

  const handleDisconnect = useCallback(async () => {
    try {
      await pricingConnectionApi.disconnect(provider);
      setStatus({ connected: false, providerType: provider });
      onStatusChangeRef.current?.(false);
      setMessage({ type: 'success', text: `${meta.label} : connexion supprimée.` });
    } catch {
      setMessage({ type: 'error', text: `Erreur lors de la déconnexion ${meta.label}.` });
    } finally {
      setDisconnectOpen(false);
    }
  }, [provider, meta.label]);

  const connected = !!status?.connected;

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: '12px',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: 'none',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.75,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <ProviderLogo provider={provider as ProviderId} size={40} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.92rem', fontWeight: 600 }}>{meta.label}</Typography>
          <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary', mt: 0.5 }}>
            {meta.description}
          </Typography>
        </Box>
        <Box sx={{ flexShrink: 0 }}>
          {loading ? (
            <CircularProgress size={18} />
          ) : connected ? (
            <Chip
              icon={<CheckCircleIcon size={11} strokeWidth={2} />}
              label="Connecté"
              size="small"
              sx={statusChipSx(ACCENT)}
            />
          ) : (
            <Chip
              icon={<ErrorOutline size={11} strokeWidth={2} />}
              label="Non connecté"
              size="small"
              sx={statusChipSx(NEUTRAL)}
            />
          )}
        </Box>
      </Box>

      <Box sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : connected ? (
          <Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25, mb: 1.5 }}>
              <Box>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Serveur</Typography>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>{status?.serverUrl}</Typography>
              </Box>
              {status?.accountIdentifier && (
                <Box>
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                    {meta.accountIdentifierLabel ?? 'Identifiant'}
                  </Typography>
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>{status.accountIdentifier}</Typography>
                </Box>
              )}
              <Box>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Statut</Typography>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>{status?.status}</Typography>
              </Box>
            </Box>
            <Button
              variant="outlined"
              size="small"
              startIcon={<LinkOffIcon size={14} strokeWidth={2} />}
              onClick={() => setDisconnectOpen(true)}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.78rem',
                borderRadius: '8px',
                py: 0.625,
                px: 1.5,
                borderColor: 'divider',
                color: 'text.primary',
                '&:hover': { borderColor: `${DANGER}66`, backgroundColor: `${DANGER}0F`, color: DANGER },
              }}
            >
              Déconnecter {meta.label}
            </Button>
          </Box>
        ) : (
          <Box
            component="form"
            onSubmit={(e) => { e.preventDefault(); handleConnect(); }}
            sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}
          >
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
              Pour générer une API key : voir la doc{' '}
              {meta.apiKeyHelpUrl ? (
                <a href={meta.apiKeyHelpUrl} target="_blank" rel="noreferrer noopener" style={{ color: 'inherit' }}>
                  {meta.label}
                </a>
              ) : (
                meta.label
              )}
              . L'API key est chiffrée avant stockage.
            </Typography>
            <TextField
              label="URL serveur"
              placeholder={meta.serverUrlPlaceholder}
              size="small"
              fullWidth
              required
              value={form.serverUrl}
              onChange={(e) => setForm({ ...form, serverUrl: e.target.value })}
            />
            {meta.accountIdentifierLabel && (
              <TextField
                label={meta.accountIdentifierLabel}
                size="small"
                fullWidth
                value={form.accountIdentifier}
                onChange={(e) => setForm({ ...form, accountIdentifier: e.target.value })}
              />
            )}
            <TextField
              label="API key"
              type="password"
              size="small"
              fullWidth
              required
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              inputProps={{ minLength: 8 }}
            />
            <Box>
              <Button
                type="submit"
                variant="contained"
                size="small"
                disabled={submitting}
                startIcon={submitting ? <CircularProgress size={12} sx={{ color: '#fff' }} /> : <LinkIcon size={14} strokeWidth={2} />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  borderRadius: '8px',
                  py: 0.625,
                  px: 1.5,
                  bgcolor: ACCENT,
                  color: '#fff',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: ACCENT, filter: 'brightness(0.94)' },
                }}
              >
                {submitting ? 'Connexion...' : `Connecter ${meta.label}`}
              </Button>
            </Box>
            <Alert
              severity="info"
              variant="outlined"
              sx={{ mt: 0.5, borderRadius: '8px', fontSize: '0.76rem' }}
            >
              L'intégration {meta.label} est en cours de scaffolding. La connexion permet de valider et stocker vos credentials ; les appels pricing (récupération des prix recommandés, push des règles) seront ajoutés prochainement.
            </Alert>
          </Box>
        )}

        {message && (
          <Alert
            severity={message.type}
            onClose={() => setMessage(null)}
            sx={{ mt: 1.5, borderRadius: '8px' }}
          >
            {message.text}
          </Alert>
        )}
      </Box>

      <Dialog open={disconnectOpen} onClose={() => setDisconnectOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Déconnecter {meta.label} ?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.85rem' }}>
            Cette action supprime les credentials {meta.label} enregistrés pour votre organisation. Vous devrez ressaisir l'API key pour vous reconnecter.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisconnectOpen(false)}>Annuler</Button>
          <Button onClick={handleDisconnect} color="error" variant="contained">Déconnecter</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default PricingProviderCard;
