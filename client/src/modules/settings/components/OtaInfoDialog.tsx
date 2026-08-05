import React, { useEffect, useMemo, useState } from 'react';
import { Alert as UiAlert, AlertDescription } from '../../../components/ui';
import { Info, TriangleAlert } from 'lucide-react';
import { Spinner } from '../../../components/ui';
import { Badge, Card } from '../../../components/ui';
import { Button, Field, FieldLabel, Input } from '../../../components/ui';
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
        <div className="px-3 py-2.5 flex items-start gap-2 border-b border-border">
          <div className="size-10 rounded-lg inline-flex items-center justify-center overflow-hidden shrink-0" style={{ backgroundColor: ota.logo ? 'transparent' : ota.brandColor }} aria-hidden="true">
            {ota.logo ? (
              <img className="max-w-full max-h-full object-contain" src={ota.logo} alt="" />
            ) : (
              // Encre posée sur une couleur de MARQUE, pas sur une surface du
              // thème : elle doit rester claire en clair comme en sombre.
              <p className="text-sm font-bold text-white">
                {ota.name.slice(0, 2).toUpperCase()}
              </p>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              <p className="text-sm font-semibold tracking-tight">{ota.name}</p>
              <Badge variant="success" className="h-[18px] px-1.5 text-2xs">{ota.segment}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isAirbnb
                ? 'Connexion OAuth2 native'
                : isFormConnectable
                  ? 'Connexion via formulaire (API ou iCal)'
                  : 'Intégration en cours de développement'}
            </p>
          </div>
          <div className="shrink-0">
            {isConnected ? (
              <Badge variant="success">
                <CheckCircleIcon size={11} strokeWidth={2} />
                Connecté
              </Badge>
            ) : (
              <Badge variant="secondary">
                <ErrorOutline size={11} strokeWidth={2} />
                {ota.available ? 'Non connecté' : 'Bientôt'}
              </Badge>
            )}
          </div>
        </div>

        {/* ─── Body ────────────────────────────────────────────────────── */}
        <div className="p-3">
          {/* Cas 1 : Coming soon */}
          {!ota.available && (
            <UiAlert variant="info" className="text-xs">
              <Info />
              <AlertDescription>L'intégration {ota.name}est en cours de développement. La page <strong>Channels</strong>permet d'exprimer votre intérêt et de suivre la disponibilité.</AlertDescription>
            </UiAlert>
          )}

          {/* Cas 2 : Deja connecte (form OTA ou Airbnb), mode consultation */}
          {ota.available && isConnected && !editingForm && (
            <div>
              <UiAlert variant="success" className="text-xs mb-2">
                <CheckCircleIcon size={16} strokeWidth={2} />
                <AlertDescription>
                  Cette intégration est <strong>active</strong>. Vous pouvez gérer la connexion ici ou depuis l'onglet Channels.
                </AlertDescription>
              </UiAlert>

              <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[1fr_1fr] gap-[7.5px] mb-[9px]">
                {isChannelConnected && channelStatus && (
                  <>
                    {channelStatus.externalPropertyId && (
                      <div>
                        <p className="text-xs text-muted-foreground">Property ID</p>
                        <p className="text-sm font-medium tabular-nums">{channelStatus.externalPropertyId}</p>
                      </div>
                    )}
                    {channelStatus.connectedAt && (
                      <div>
                        <p className="text-xs text-muted-foreground">Connecté depuis</p>
                        <p className="text-sm font-medium tabular-nums">
                          {new Date(channelStatus.connectedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                    {channelStatus.lastSyncAt && (
                      <div>
                        <p className="text-xs text-muted-foreground">Dernière sync</p>
                        <p className="text-sm font-medium tabular-nums">
                          {new Date(channelStatus.lastSyncAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                  </>
                )}
                {isAirbnbConnected && airbnbStatus?.connectedAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">Connecté depuis</p>
                    <p className="text-sm font-medium tabular-nums">
                      {new Date(airbnbStatus.connectedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {isFormConnectable && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingForm(true)}
                  >
                    <LinkIcon size={14} strokeWidth={2} />
                    Modifier la connexion
                  </Button>
                )}
                {isFormConnectable && (
                  // Deconnecter est l'action irreversible de cette zone : le kit lui
                  // donne la variante destructive, la ou MUI ne l'exprimait qu'au hover.
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={disconnectMutation.isPending}
                  >
                    {disconnectMutation.isPending ? <Spinner className="size-3" /> : <LinkOffIcon size={14} strokeWidth={2} />}
                    {disconnectMutation.isPending ? 'Déconnexion...' : `Déconnecter ${ota.name}`}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/channels')}
                >
                  Gérer dans Channels
                  <ArrowRightIcon size={14} strokeWidth={2} />
                </Button>
              </div>
            </div>
          )}

          {/* Cas 3 : Airbnb non connecte (OAuth) */}
          {ota.available && isAirbnb && !isConnected && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Airbnb utilise un flow OAuth2 natif. Vous serez redirigé vers Airbnb pour autoriser l'accès à votre compte.
              </p>
              <div className="flex gap-1.5 flex-wrap">
                <Button
                  size="sm"
                  onClick={handleAirbnbConnect}
                  disabled={airbnbConnectMutation.isPending}
                >
                  {airbnbConnectMutation.isPending ? <Spinner className="size-3" /> : <LinkIcon size={14} strokeWidth={2} />}
                  {airbnbConnectMutation.isPending ? 'Redirection...' : 'Se connecter via Airbnb'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/channels')}
                >
                  Détails dans Channels
                  <ArrowRightIcon size={14} strokeWidth={2} />
                </Button>
              </div>
            </div>
          )}

          {/* Cas 4 : Form OTA — non connecte OU mode "modifier" */}
          {showForm && (
            <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); handleConnect(); }}>
              <p className="text-xs text-muted-foreground">
                {editingForm
                  ? `Modifier les credentials ${ota.name}. Les anciennes valeurs seront ecrasees apres connexion.`
                  : `Renseignez vos credentials ${ota.name}. Ils sont chiffrés (AES-256) avant stockage.`}
              </p>

              {fields.map((credentialField) => (
                // L'id derive de la cle du credential (hotelId, apiKey...) : stable
                // et unique dans la modale, contrairement a un index de boucle.
                <Field key={credentialField.key}>
                  <FieldLabel htmlFor={`ota-credential-${credentialField.key}`}>
                    {FIELD_LABELS[credentialField.key] ?? credentialField.key}
                  </FieldLabel>
                  <Input
                    id={`ota-credential-${credentialField.key}`}
                    className="w-full"
                    type={credentialField.type}
                    required={credentialField.required}
                    placeholder={credentialField.placeholder}
                    value={formData[credentialField.key] ?? ''}
                    onChange={(e) => handleFieldChange(credentialField.key, e.target.value)}
                    autoComplete="off"
                  />
                </Field>
              ))}

              {/* Resultat test */}
              {testResult && (
                <UiAlert variant={testResult.success ? 'success' : 'destructive'} className="text-xs">
                  {testResult.success ? <CheckCircleIcon size={14} strokeWidth={2} /> : <TriangleAlert />}
                  <AlertDescription>
                    {testResult.success
                      ? `Credentials valides${testResult.channelPropertyName ? ` (${testResult.channelPropertyName})` : ''}.`
                      : testResult.message}
                  </AlertDescription>
                </UiAlert>
              )}

              <div className="flex gap-1.5 flex-wrap mt-0.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTest}
                  disabled={!isFormValid || testMutation.isPending || connectMutation.isPending}
                >
                  {testMutation.isPending ? <Spinner className="size-3" /> : <TestIcon size={14} strokeWidth={2} />}
                  {testMutation.isPending ? 'Test en cours...' : 'Tester'}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!isFormValid || connectMutation.isPending}
                >
                  {connectMutation.isPending ? <Spinner className="size-3" /> : <LinkIcon size={14} strokeWidth={2} />}
                  {connectMutation.isPending ? 'Connexion...' : `Connecter ${ota.name}`}
                </Button>
                {editingForm && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setEditingForm(false); setFormData({}); setTestResult(null); }}
                  >
                    Annuler
                  </Button>
                )}
              </div>
            </form>
          )}

          {actionError && (
            <UiAlert variant="destructive" className="mt-2 text-xs">
              <TriangleAlert />
              <AlertDescription>{actionError}</AlertDescription>
            </UiAlert>
          )}
        </div>
      </Card>
    </IntegrationConfigDialog>
  );
}
