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
import ProviderLogo, { type ProviderId } from './ProviderLogos';

/**
 * Composant generique pour configurer la connexion d'un provider base sur
 * API key (signature, tarification, conformite, ...). Factorise toute la
 * logique commune des 3 cards historiques (ApiKeyProviderCard /
 * PricingProviderCard / ComplianceProviderCard).
 *
 * <h2>Pattern Strategy via props</h2>
 * <ul>
 *   <li>{@code api} : adapter qui implemente le contrat {@link ApiKeyConnectionApi}
 *       — chaque domaine fournit son client (externalConnectionApi,
 *       pricingConnectionApi, complianceConnectionApi).</li>
 *   <li>{@code meta} : metadonnees minimales pour afficher le provider
 *       (label, description, placeholders form, lien doc).</li>
 *   <li>{@code logoId} : ID du logo a rendre (delegue a ProviderLogo).</li>
 * </ul>
 *
 * <h2>Slots</h2>
 * <p>Pour les variations domain-specific :</p>
 * <ul>
 *   <li>{@code headerChip} : chip(s) supplementaire(s) a cote du nom
 *       (ex. QTSP francais pour signature, code pays pour compliance).</li>
 *   <li>{@code bodyAlert} : alerte en haut du body (ex. rappel obligation
 *       legale pour compliance).</li>
 *   <li>{@code scaffoldingNote} : texte custom pour l'alert info en bas du
 *       formulaire de connexion (defaut : message generique).</li>
 * </ul>
 *
 * <h2>SOLID</h2>
 * <ul>
 *   <li>S : Une raison de changer (la mecanique de connexion API key).</li>
 *   <li>O : Etendre = ajouter un nouveau wrapper qui passe une autre api.</li>
 *   <li>D : Depend uniquement d'abstractions (ConnectionApi, ProviderMeta).</li>
 * </ul>
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

// ─── Contrats partages (Strategy) ──────────────────────────────────────────

export interface ApiKeyConnectionStatus<P extends string> {
  connected: boolean;
  providerType?: P;
  serverUrl?: string | null;
  accountIdentifier?: string | null;
  status?: string | null;
  lastTestedAt?: string | null;
  connectedAt?: string | null;
}

export interface ApiKeyConnectionRequest {
  serverUrl: string;
  accountIdentifier?: string;
  apiKey: string;
}

export interface ApiKeyConnectionApi<P extends string> {
  getStatus(provider: P): Promise<ApiKeyConnectionStatus<P>>;
  connect(provider: P, req: ApiKeyConnectionRequest): Promise<ApiKeyConnectionStatus<P>>;
  disconnect(provider: P): Promise<unknown>;
}

export interface ApiKeyProviderMeta {
  label: string;
  description: string;
  serverUrlPlaceholder: string;
  apiKeyHelpUrl?: string;
  accountIdentifierLabel?: string;
}

// ─── Props du composant ────────────────────────────────────────────────────

export interface ApiKeyConnectionCardProps<P extends string> {
  provider: P;
  api: ApiKeyConnectionApi<P>;
  meta: ApiKeyProviderMeta;
  logoId: ProviderId;
  onStatusChange?: (connected: boolean) => void;
  /** Chip(s) supplementaire(s) a cote du nom (QTSP, country, etc.). */
  headerChip?: React.ReactNode;
  /** Alert en haut du body (ex. rappel obligation legale). */
  bodyAlert?: React.ReactNode;
  /** Texte custom pour l'alert info en bas du form. Defaut : message generique. */
  scaffoldingNote?: string;
}

export default function ApiKeyConnectionCard<P extends string>({
  provider,
  api,
  meta,
  logoId,
  onStatusChange,
  headerChip,
  bodyAlert,
  scaffoldingNote,
}: ApiKeyConnectionCardProps<P>) {
  const [status, setStatus] = useState<ApiKeyConnectionStatus<P> | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ serverUrl: '', accountIdentifier: '', apiKey: '' });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  // Pattern "latest callback ref" — evite la boucle de render quand le
  // parent passe une arrow function inline (sinon nouvelle ref a chaque
  // render -> effect relance -> setState -> ...).
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.getStatus(provider)
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
  }, [provider, api]);

  const handleConnect = useCallback(async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await api.connect(provider, {
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
  }, [api, provider, form, meta.label]);

  const handleDisconnect = useCallback(async () => {
    try {
      await api.disconnect(provider);
      setStatus({ connected: false, providerType: provider });
      onStatusChangeRef.current?.(false);
      setMessage({ type: 'success', text: `${meta.label} : connexion supprimée.` });
    } catch {
      setMessage({ type: 'error', text: `Erreur lors de la déconnexion ${meta.label}.` });
    } finally {
      setDisconnectOpen(false);
    }
  }, [api, provider, meta.label]);

  const connected = !!status?.connected;
  const defaultScaffoldingNote =
    `L'intégration ${meta.label} est en cours de scaffolding. La connexion permet de valider et stocker vos credentials ; les appels API métier seront ajoutés prochainement.`;

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
      {/* Header */}
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
        <ProviderLogo provider={logoId} size={40} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '0.92rem', fontWeight: 600 }}>{meta.label}</Typography>
            {headerChip}
          </Box>
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

      {/* Body */}
      <Box sx={{ p: 2 }}>
        {bodyAlert && <Box sx={{ mb: 1.5 }}>{bodyAlert}</Box>}

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
              Pour obtenir vos credentials : voir la doc{' '}
              {meta.apiKeyHelpUrl ? (
                <a href={meta.apiKeyHelpUrl} target="_blank" rel="noreferrer noopener" style={{ color: 'inherit' }}>
                  {meta.label}
                </a>
              ) : (
                meta.label
              )}
              . L'API key est chiffrée avant stockage (AES-256-GCM).
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
              {scaffoldingNote ?? defaultScaffoldingNote}
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

      {/* Disconnect confirmation */}
      <Dialog open={disconnectOpen} onClose={() => setDisconnectOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Déconnecter {meta.label} ?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.85rem' }}>
            Cette action supprime les credentials {meta.label} enregistrés. Vous devrez ressaisir l'API key pour vous reconnecter.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisconnectOpen(false)}>Annuler</Button>
          <Button onClick={handleDisconnect} color="error" variant="contained">Déconnecter</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
