import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Spinner } from '../../../components/ui';
import { Card } from '../../../components/ui';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';
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

const ACCENT = 'var(--ok)';
const DANGER = 'var(--err)';
const NEUTRAL = 'var(--muted)';

const statusChipSx = (color: string) => ({
  height: 22,
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.01em',
  borderRadius: '6px',
  px: 0.25,
  backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`,
  color,
  border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
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
    <Card className="gap-0 py-0 border-border overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 flex items-start gap-2 border-b border-[divider]">
        <ProviderLogo provider={logoId} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <p className="cn-text-body1 text-[0.92rem] font-semibold">{meta.label}</p>
            {headerChip}
          </div>
          <p className="cn-text-body1 text-[0.74rem] text-muted-foreground mt-0.5">
            {meta.description}
          </p>
        </div>
        <div className="shrink-0">
          {loading ? (
            <Spinner className="size-[18px]" />
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
        </div>
      </div>

      {/* Body */}
      <div className="p-3">
        {bodyAlert && <div className="mb-2">{bodyAlert}</div>}

        {loading ? (
          <div className="flex justify-center py-3">
            <Spinner className="size-6" />
          </div>
        ) : connected ? (
          <div>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25, mb: 1.5 }}>
              <div>
                <p className="cn-text-body1 text-[0.7rem] text-muted-foreground">Serveur</p>
                <p className="cn-text-body1 text-[0.82rem] font-medium">{status?.serverUrl}</p>
              </div>
              {status?.accountIdentifier && (
                <div>
                  <p className="cn-text-body1 text-[0.7rem] text-muted-foreground">
                    {meta.accountIdentifierLabel ?? 'Identifiant'}
                  </p>
                  <p className="cn-text-body1 text-[0.82rem] font-medium">{status.accountIdentifier}</p>
                </div>
              )}
              <div>
                <p className="cn-text-body1 text-[0.7rem] text-muted-foreground">Statut</p>
                <p className="cn-text-body1 text-[0.82rem] font-medium">{status?.status}</p>
              </div>
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
                '&:hover': { borderColor: 'color-mix(in srgb, var(--err) 40%, transparent)', backgroundColor: 'var(--err-soft)', color: DANGER },
              }}
            >
              Déconnecter {meta.label}
            </Button>
          </div>
        ) : (
          <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); handleConnect(); }}>
            <p className="cn-text-body1 text-[0.78rem] text-muted-foreground">
              Pour obtenir vos credentials : voir la doc{' '}
              {meta.apiKeyHelpUrl ? (
                <a href={meta.apiKeyHelpUrl} target="_blank" rel="noreferrer noopener" style={{ color: 'inherit' }}>
                  {meta.label}
                </a>
              ) : (
                meta.label
              )}
              . L'API key est chiffrée avant stockage (AES-256-GCM).
            </p>
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
            <div>
              <Button
                type="submit"
                variant="contained"
                size="small"
                disabled={submitting}
                startIcon={submitting ? <Spinner className="size-3" /> : <LinkIcon size={14} strokeWidth={2} />}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                {submitting ? 'Connexion...' : `Connecter ${meta.label}`}
              </Button>
            </div>
            <Alert
              severity="info"
              variant="outlined"
              sx={{ mt: 0.5, borderRadius: '8px', fontSize: '0.76rem' }}
            >
              {scaffoldingNote ?? defaultScaffoldingNote}
            </Alert>
          </form>
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
      </div>

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
    </Card>
  );
}
