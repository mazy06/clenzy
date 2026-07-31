import React, { useEffect, useMemo, useState } from 'react';
import StatusChip from '../../../components/StatusChip';
import { Alert as UiAlert, AlertDescription } from '../../../components/ui';
import { Info, TriangleAlert } from 'lucide-react';
import { Spinner } from '../../../components/ui';
import { Card } from '../../../components/ui';
import { Box, Button, Chip, Alert, TextField } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle as CheckCircleIcon,
  ErrorOutline,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  ArrowForward as ArrowRightIcon,
  Science as TestIcon,
} from '../../../icons';
import {
  useDisconnectChannel,
  useConnectChannel,
  useTestChannelConnection,
} from '../../../hooks/useChannelConnections';
import { useAirbnbConnect } from '../../../hooks/useAirbnb';
import {
  CONNECTABLE_CHANNELS,
  CHANNEL_BACKEND_MAP,
  CHANNEL_CREDENTIAL_FIELDS,
  type ChannelId,
  type ChannelConnectionStatus,
  type ChannelConnectionTestResult,
} from '../../../services/api/channelConnectionApi';
import type { AirbnbConnectionStatus } from '../../../services/api/airbnbApi';
import type { OtaChannel } from '../../../services/channels/otaChannels';
import IntegrationConfigDialog from './IntegrationConfigDialog';

/**
 * Modal unifie pour les OTAs dans la vitrine Integrations.
 *
 * <h2>4 cas geres (un seul composant)</h2>
 * <ul>
 *   <li><b>Coming soon</b> (Trip.com/HomeToGo/etc. quand !available) :
 *       message "en cours de developpement"</li>
 *   <li><b>Deja connecte</b> (form OTA ou Airbnb) : affiche les data
 *       enregistrees (Property ID, dates) + boutons Modifier/Deconnecter</li>
 *   <li><b>Airbnb non connecte</b> : CTA "Se connecter via Airbnb (OAuth)"</li>
 *   <li><b>Form OTA non connecte</b> : formulaire dynamique base sur
 *       CHANNEL_CREDENTIAL_FIELDS + boutons Tester / Connecter</li>
 * </ul>
 *
 * <h2>Layout uniforme</h2>
 * <p>Strictement le meme format que les autres modales d'integration
 * (KYC, Compliance, Channel Manager, etc.) : wrap dans
 * {@link IntegrationConfigDialog} -> Paper -> Header logo+nom+chip+status
 * + Body. Aucune divergence visuelle avec le reste de l'ecran.</p>
 */

const ACCENT = 'var(--ok)';
const DANGER = 'var(--err)';
const NEUTRAL = 'var(--muted)';


// Labels FR pour les champs de credentials — evite la dependance sur i18n
// pour ces stubs scaffoldes.
const FIELD_LABELS: Record<string, string> = {
  hotelId: 'Hotel ID',
  username: 'Nom d\'utilisateur',
  password: 'Mot de passe',
  propertyId: 'Property ID',
  apiKey: 'API key',
  apiSecret: 'API secret',
  listingId: 'Listing ID',
  accessToken: 'Access token',
  refreshToken: 'Refresh token (optionnel)',
  partnerId: 'Partner ID',
  icalUrl: 'URL iCal',
};

interface OtaInfoDialogProps {
  ota: OtaChannel | null;
  open: boolean;
  onClose: () => void;
  channelStatus?: ChannelConnectionStatus | null;
  airbnbStatus?: AirbnbConnectionStatus | null;
}

export default function OtaInfoDialog({
  ota,
  open,
  onClose,
  channelStatus,
  airbnbStatus,
}: OtaInfoDialogProps) {
  const navigate = useNavigate();
  const disconnectMutation = useDisconnectChannel();
  const connectMutation = useConnectChannel();
  const testMutation = useTestChannelConnection();
  const airbnbConnectMutation = useAirbnbConnect();

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<ChannelConnectionTestResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Quand un OTA est connecte, le mode par defaut est "consultation".
  // Click sur "Modifier la connexion" -> editingForm=true pour afficher
  // le formulaire de re-saisie sans quitter le modal.
  const [editingForm, setEditingForm] = useState(false);

  // Reset l'etat local quand l'OTA change ou que le modal s'ouvre/ferme
  useEffect(() => {
    setFormData({});
    setTestResult(null);
    setActionError(null);
    setEditingForm(false);
    connectMutation.reset();
    testMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ota?.id, open]);

  // Champs requis pour ce channel (CHANNEL_CREDENTIAL_FIELDS indexe par
  // backend enum, pas par frontend id — d'ou le mapping intermediaire)
  const fields = useMemo(() => {
    if (!ota) return [];
    const backendChannel = CHANNEL_BACKEND_MAP[ota.id as ChannelId];
    return backendChannel ? CHANNEL_CREDENTIAL_FIELDS[backendChannel] ?? [] : [];
  }, [ota]);

  const isFormValid = useMemo(
    () => fields.filter((f) => f.required).every((f) => formData[f.key]?.trim()),
    [fields, formData],
  );

  if (!ota) return null;

  const isAirbnb = ota.id === 'airbnb';
  const isFormConnectable = CONNECTABLE_CHANNELS.includes(ota.id as ChannelId);
  const isAirbnbConnected = isAirbnb && !!airbnbStatus?.connected;
  const isChannelConnected = isFormConnectable && !!channelStatus?.connected;
  const isConnected = isAirbnbConnected || isChannelConnected;
  // Affiche le formulaire si : pas connecte ET form-connectable, OU bien
  // l'utilisateur a clique "Modifier" sur la vue connecte.
  const showForm = ota.available && isFormConnectable && (!isChannelConnected || editingForm);

  const handleFieldChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setTestResult(null);
    setActionError(null);
  };

  const handleTest = () => {
    setTestResult(null);
    setActionError(null);
    testMutation.mutate(
      { channelId: ota.id as ChannelId, request: { credentials: formData } },
      {
        onSuccess: (result) => setTestResult(result),
        onError: (err: Error) => setActionError(`Test échoué : ${err.message ?? 'erreur inconnue'}`),
      },
    );
  };

  const handleConnect = () => {
    setActionError(null);
    connectMutation.mutate(
      { channelId: ota.id as ChannelId, request: { credentials: formData } },
      {
        onSuccess: () => {
          setEditingForm(false);
          setFormData({});
          onClose();
        },
        onError: (err: Error) => setActionError(err.message ?? `Erreur lors de la connexion ${ota.name}.`),
      },
    );
  };

  const handleDisconnect = async () => {
    if (!isFormConnectable) return;
    setActionError(null);
    try {
      await disconnectMutation.mutateAsync(ota.id as ChannelId);
      onClose();
    } catch (err) {
      setActionError((err as Error).message ?? 'Erreur lors de la déconnexion.');
    }
  };

  const handleAirbnbConnect = () => {
    setActionError(null);
    airbnbConnectMutation.mutate(undefined, {
      onError: (err: Error) => setActionError(err.message ?? 'Erreur OAuth Airbnb.'),
    });
  };

  return (
    <IntegrationConfigDialog open={open} onClose={onClose}>
      <Card className="gap-0 py-0 border-border overflow-hidden">
        {/* ─── Header (uniforme avec ApiKeyConnectionCard) ─────────────── */}
        <div className="px-3 py-2.5 flex items-start gap-2 border-b border-[divider]">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '10px',
              backgroundColor: ota.logo ? 'transparent' : ota.brandColor,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            {ota.logo ? (
              <img className="max-w-full max-h-[100%] object-contain" src={ota.logo} alt="" />
            ) : (
              <p className="cn-text-body1 text-[0.85rem] font-bold text-[var(--on-accent)]">
                {ota.name.slice(0, 2).toUpperCase()}
              </p>
            )}
          </Box>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-0.5 flex-wrap">
              <p className="cn-text-body1 text-[0.92rem] font-semibold">{ota.name}</p>
              <Chip
                label={ota.segment}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.62rem',
                  fontWeight: 600,
                  bgcolor: 'var(--ok-soft)',
                  color: ACCENT,
                  border: '1px solid color-mix(in srgb, var(--ok) 20%, transparent)',
                  '& .MuiChip-label': { px: 0.625 },
                }}
              />
            </div>
            <p className="cn-text-body1 text-[0.74rem] text-muted-foreground mt-0.5">
              {isAirbnb
                ? 'Connexion OAuth2 native'
                : isFormConnectable
                  ? 'Connexion via formulaire (API ou iCal)'
                  : 'Intégration en cours de développement'}
            </p>
          </div>
          <div className="shrink-0">
            {isConnected ? (
              <StatusChip color={ACCENT} label="Connecté" icon={<CheckCircleIcon size={11} strokeWidth={2} />} />
            ) : (
              <StatusChip color={NEUTRAL} label={ota.available ? 'Non connecté' : 'Bientôt'} icon={<ErrorOutline size={11} strokeWidth={2} />} />
            )}
          </div>
        </div>

        {/* ─── Body ────────────────────────────────────────────────────── */}
        <div className="p-3">
          {/* Cas 1 : Coming soon */}
          {!ota.available && (
            <UiAlert variant="info" className="text-[0.78rem]">
              <Info />
              <AlertDescription>L'intégration {ota.name}est en cours de développement. La page <strong>Channels</strong>permet d'exprimer votre intérêt et de suivre la disponibilité.</AlertDescription>
            </UiAlert>
          )}

          {/* Cas 2 : Deja connecte (form OTA ou Airbnb), mode consultation */}
          {ota.available && isConnected && !editingForm && (
            <div>
              <Alert
                severity="success"
                variant="outlined"
                icon={<CheckCircleIcon size={16} strokeWidth={2} />}
                sx={{ borderRadius: '8px', fontSize: '0.78rem', mb: 1.5 }}
              >
                Cette intégration est <strong>active</strong>. Vous pouvez gérer la connexion ici ou depuis l'onglet Channels.
              </Alert>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25, mb: 1.5 }}>
                {isChannelConnected && channelStatus && (
                  <>
                    {channelStatus.externalPropertyId && (
                      <div>
                        <p className="cn-text-body1 text-[0.7rem] text-muted-foreground">Property ID</p>
                        <p className="cn-text-body1 text-[0.82rem] font-medium">{channelStatus.externalPropertyId}</p>
                      </div>
                    )}
                    {channelStatus.connectedAt && (
                      <div>
                        <p className="cn-text-body1 text-[0.7rem] text-muted-foreground">Connecté depuis</p>
                        <p className="cn-text-body1 text-[0.82rem] font-medium">
                          {new Date(channelStatus.connectedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                    {channelStatus.lastSyncAt && (
                      <div>
                        <p className="cn-text-body1 text-[0.7rem] text-muted-foreground">Dernière sync</p>
                        <p className="cn-text-body1 text-[0.82rem] font-medium">
                          {new Date(channelStatus.lastSyncAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                  </>
                )}
                {isAirbnbConnected && airbnbStatus?.connectedAt && (
                  <div>
                    <p className="cn-text-body1 text-[0.7rem] text-muted-foreground">Connecté depuis</p>
                    <p className="cn-text-body1 text-[0.82rem] font-medium">
                      {new Date(airbnbStatus.connectedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                )}
              </Box>

              <div className="flex gap-1.5 flex-wrap">
                {isFormConnectable && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<LinkIcon size={14} strokeWidth={2} />}
                    onClick={() => setEditingForm(true)}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      borderRadius: '8px',
                      borderColor: 'divider',
                      color: 'text.primary',
                      '&:hover': { borderColor: 'color-mix(in srgb, var(--ok) 40%, transparent)', backgroundColor: 'var(--ok-soft)', color: ACCENT },
                    }}
                  >
                    Modifier la connexion
                  </Button>
                )}
                {isFormConnectable && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={disconnectMutation.isPending ? <Spinner className="size-3" /> : <LinkOffIcon size={14} strokeWidth={2} />}
                    onClick={handleDisconnect}
                    disabled={disconnectMutation.isPending}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      borderRadius: '8px',
                      borderColor: 'divider',
                      color: 'text.primary',
                      '&:hover': { borderColor: 'color-mix(in srgb, var(--err) 40%, transparent)', backgroundColor: 'var(--err-soft)', color: DANGER },
                    }}
                  >
                    {disconnectMutation.isPending ? 'Déconnexion...' : `Déconnecter ${ota.name}`}
                  </Button>
                )}
                <Button
                  variant="text"
                  size="small"
                  endIcon={<ArrowRightIcon size={14} strokeWidth={2} />}
                  onClick={() => navigate('/channels')}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    color: 'text.secondary',
                    '&:hover': { color: ACCENT },
                  }}
                >
                  Gérer dans Channels
                </Button>
              </div>
            </div>
          )}

          {/* Cas 3 : Airbnb non connecte (OAuth) */}
          {ota.available && isAirbnb && !isConnected && (
            <div>
              <p className="cn-text-body1 text-[0.82rem] text-muted-foreground mb-2">
                Airbnb utilise un flow OAuth2 natif. Vous serez redirigé vers Airbnb pour autoriser l'accès à votre compte.
              </p>
              <div className="flex gap-1.5 flex-wrap">
                <Button
                  variant="contained"
                  size="small"
                  startIcon={airbnbConnectMutation.isPending ? <Spinner className="size-3" /> : <LinkIcon size={14} strokeWidth={2} />}
                  onClick={handleAirbnbConnect}
                  disabled={airbnbConnectMutation.isPending}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  {airbnbConnectMutation.isPending ? 'Redirection...' : 'Se connecter via Airbnb'}
                </Button>
                <Button
                  variant="text"
                  size="small"
                  endIcon={<ArrowRightIcon size={14} strokeWidth={2} />}
                  onClick={() => navigate('/channels')}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    color: 'text.secondary',
                  }}
                >
                  Détails dans Channels
                </Button>
              </div>
            </div>
          )}

          {/* Cas 4 : Form OTA — non connecte OU mode "modifier" */}
          {showForm && (
            <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); handleConnect(); }}>
              <p className="cn-text-body1 text-[0.78rem] text-muted-foreground">
                {editingForm
                  ? `Modifier les credentials ${ota.name}. Les anciennes valeurs seront ecrasees apres connexion.`
                  : `Renseignez vos credentials ${ota.name}. Ils sont chiffrés (AES-256) avant stockage.`}
              </p>

              {fields.map((field) => (
                <TextField
                  key={field.key}
                  label={FIELD_LABELS[field.key] ?? field.key}
                  type={field.type}
                  size="small"
                  fullWidth
                  required={field.required}
                  placeholder={field.placeholder}
                  value={formData[field.key] ?? ''}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  autoComplete="off"
                />
              ))}

              {/* Resultat test */}
              {testResult && (
                <Alert
                  severity={testResult.success ? 'success' : 'error'}
                  variant="outlined"
                  icon={testResult.success ? <CheckCircleIcon size={14} strokeWidth={2} /> : undefined}
                  sx={{ borderRadius: '8px', fontSize: '0.76rem' }}
                >
                  {testResult.success
                    ? `Credentials valides${testResult.channelPropertyName ? ` (${testResult.channelPropertyName})` : ''}.`
                    : testResult.message}
                </Alert>
              )}

              <div className="flex gap-1.5 flex-wrap mt-0.5">
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  startIcon={testMutation.isPending ? <Spinner className="size-3" /> : <TestIcon size={14} strokeWidth={2} />}
                  onClick={handleTest}
                  disabled={!isFormValid || testMutation.isPending || connectMutation.isPending}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    borderRadius: '8px',
                    borderColor: 'divider',
                    color: 'text.primary',
                    '&:hover': { borderColor: 'color-mix(in srgb, var(--ok) 40%, transparent)', backgroundColor: 'var(--ok-soft)', color: ACCENT },
                  }}
                >
                  {testMutation.isPending ? 'Test en cours...' : 'Tester'}
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  size="small"
                  startIcon={connectMutation.isPending ? <Spinner className="size-3" /> : <LinkIcon size={14} strokeWidth={2} />}
                  disabled={!isFormValid || connectMutation.isPending}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  {connectMutation.isPending ? 'Connexion...' : `Connecter ${ota.name}`}
                </Button>
                {editingForm && (
                  <Button
                    type="button"
                    variant="text"
                    size="small"
                    onClick={() => { setEditingForm(false); setFormData({}); setTestResult(null); }}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      color: 'text.secondary',
                    }}
                  >
                    Annuler
                  </Button>
                )}
              </div>
            </form>
          )}

          {actionError && (
            <UiAlert variant="destructive" className="mt-2 text-[0.78rem]">
              <TriangleAlert />
              <AlertDescription>{actionError}</AlertDescription>
            </UiAlert>
          )}
        </div>
      </Card>
    </IntegrationConfigDialog>
  );
}
