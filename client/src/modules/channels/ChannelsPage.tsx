import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Divider,
  IconButton,
  Tooltip,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
} from '@mui/material';
import {
  LinkOff as LinkOffIcon,
  Link as LinkIcon,
  Sync as SyncIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CleaningServices as CleaningIcon,
  OpenInNew as OpenInNewIcon,
  TrendingUp as PricingIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { Star as StarIcon } from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { SPACING } from '../../theme/spacing';
import type { AirbnbConnectionStatus, AirbnbListingMapping } from '../../services/api/airbnbApi';
import type { Property } from '../../services/api/propertiesApi';
import {
  useAirbnbConnectionStatus,
  useAirbnbListings,
  useChannelProperties,
  useAirbnbConnect,
  useAirbnbDisconnect,
  useToggleSync,
  useToggleAutoInterventions,
  useToggleAutoPushPricing,
  useLinkListing,
  useUnlinkListing,
} from '../../hooks/useAirbnb';
import { useChannelConnections, useDisconnectChannel } from '../../hooks/useChannelConnections';
import { CHANNEL_BACKEND_MAP } from '../../services/api/channelConnectionApi';
import type { ChannelId } from '../../services/api/channelConnectionApi';
import ChannelConnectDialog from './ChannelConnectDialog';

// Logo imports
import airbnbLogoSmall from '../../assets/logo/airbnb-logo-small.png';
import bookingLogoSmall from '../../assets/logo/booking-logo-small.svg';
import expediaLogo from '../../assets/logo/expedia-logo.png';
import mabeetLogo from '../../assets/logo/mabeet-logo-small.png';
import rentellyLogo from '../../assets/logo/rentelly-logo-small.svg';
import gathernLogo from '../../assets/logo/gathern-logo-small.webp';
import keaseLogo from '../../assets/logo/kease-logo-small.svg';
import hotelsComLogo from '../../assets/logo/hotels-com-logo-small.svg';
import agodaLogo from '../../assets/logo/agoda-logo-small.svg';
import vrboLogo from '../../assets/logo/vrbo-logo-small.svg';
import abritelLogo from '../../assets/logo/abritel-logo-small.svg';
import hometogoLogo from '../../assets/logo/hometogo-logo-small.svg';

// ─── OTA Definitions ────────────────────────────────────────────────────────

interface OtaChannel {
  id: string;
  name: string;
  brandColor: string;
  brandGradient: string;
  logo: string | null;
  available: boolean;
  descriptionKey: string;
}

const OTA_CHANNELS: OtaChannel[] = [
  {
    id: 'airbnb',
    name: 'Airbnb',
    brandColor: '#FF5A5F',
    brandGradient: 'linear-gradient(135deg, #FF5A5F 0%, #FF8A8D 100%)',
    logo: airbnbLogoSmall,
    available: true,
    descriptionKey: 'channels.airbnb.connectDescription',
  },
  {
    id: 'booking',
    name: 'Booking.com',
    brandColor: '#003580',
    brandGradient: 'linear-gradient(135deg, #003580 0%, #0050B5 100%)',
    logo: bookingLogoSmall,
    available: true,
    descriptionKey: 'channels.ota.booking.description',
  },
  {
    id: 'expedia',
    name: 'Expedia',
    brandColor: '#00355F',
    brandGradient: 'linear-gradient(135deg, #00355F 0%, #1A6199 100%)',
    logo: expediaLogo,
    available: true,
    descriptionKey: 'channels.ota.expedia.description',
  },
  {
    id: 'hotels',
    name: 'Hotels.com',
    brandColor: '#191E3B',
    brandGradient: 'linear-gradient(135deg, #191E3B 0%, #3A4070 100%)',
    logo: hotelsComLogo,
    available: true,
    descriptionKey: 'channels.ota.hotels.description',
  },
  {
    id: 'agoda',
    name: 'Agoda',
    brandColor: '#2067DA',
    brandGradient: 'linear-gradient(135deg, #2067DA 0%, #4D8AE8 100%)',
    logo: agodaLogo,
    available: true,
    descriptionKey: 'channels.ota.agoda.description',
  },
  {
    id: 'tripcom',
    name: 'Trip.com',
    brandColor: '#3264FF',
    brandGradient: 'linear-gradient(135deg, #3264FF 0%, #6590FF 100%)',
    logo: null,
    available: false,
    descriptionKey: 'channels.ota.tripcom.description',
  },
  {
    id: 'vrbo',
    name: 'Vrbo',
    brandColor: '#1A2B49',
    brandGradient: 'linear-gradient(135deg, #1A2B49 0%, #3A5070 100%)',
    logo: vrboLogo,
    available: true,
    descriptionKey: 'channels.ota.vrbo.description',
  },
  {
    id: 'abritel',
    name: 'Abritel',
    brandColor: '#1668E3',
    brandGradient: 'linear-gradient(135deg, #1668E3 0%, #4A8EF0 100%)',
    logo: abritelLogo,
    available: true,
    descriptionKey: 'channels.ota.abritel.description',
  },
  {
    id: 'hometogo',
    name: 'HomeToGo',
    brandColor: '#4D21B7',
    brandGradient: 'linear-gradient(135deg, #4D21B7 28.84%, #FF8080 102.45%)',
    logo: hometogoLogo,
    available: false,
    descriptionKey: 'channels.ota.hometogo.description',
  },
  {
    id: 'gathern',
    name: 'Gathern',
    brandColor: '#4F2396',
    brandGradient: 'linear-gradient(135deg, #4F2396 0%, #7A4FC4 100%)',
    logo: gathernLogo,
    available: false,
    descriptionKey: 'channels.ota.gathern.description',
  },
  {
    id: 'rentelly',
    name: 'Rentelly',
    brandColor: '#118B7D',
    brandGradient: 'linear-gradient(135deg, #118B7D 0%, #3AAF9F 100%)',
    logo: rentellyLogo,
    available: false,
    descriptionKey: 'channels.ota.rentelly.description',
  },
  {
    id: 'kease',
    name: 'Kease',
    brandColor: '#1A1A1A',
    brandGradient: 'linear-gradient(135deg, #1A1A1A 0%, #444444 100%)',
    logo: keaseLogo,
    available: false,
    descriptionKey: 'channels.ota.kease.description',
  },
  {
    id: 'stay',
    name: 'Stay.sa',
    brandColor: '#2D5F8A',
    brandGradient: 'linear-gradient(135deg, #2D5F8A 0%, #4A8ABF 100%)',
    logo: null,
    available: false,
    descriptionKey: 'channels.ota.stay.description',
  },
  {
    id: 'mabeet',
    name: 'Mabeet',
    brandColor: '#099EAC',
    brandGradient: 'linear-gradient(135deg, #099EAC 0%, #3BBAC6 100%)',
    logo: mabeetLogo,
    available: false,
    descriptionKey: 'channels.ota.mabeet.description',
  },
];

// ─── Style Constants ────────────────────────────────────────────────────────

const CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  borderRadius: 1.5,
  p: 2,
} as const;

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#4A9B8E',
  EXPIRED: '#D4A574',
  REVOKED: '#d32f2f',
  ERROR: '#d32f2f',
};

const OTA_CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1.5,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: 'default',
  '&:hover': {
    transform: 'translateY(-3px)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
    borderColor: 'grey.300',
  },
} as const;

const OTA_CARD_CONTENT_SX = {
  p: 2.5,
  display: 'flex',
  flexDirection: 'column',
  gap: 1.5,
  flex: 1,
} as const;

// ─── Component ──────────────────────────────────────────────────────────────

const ChannelsPage: React.FC = () => {
  const { t, currentLanguage } = useTranslation();
  const navigate = useNavigate();
  const dateLocale = currentLanguage === 'fr' ? 'fr-FR' : 'en-US';

  // ── React Query: Airbnb ──
  const {
    data: connectionStatus = null,
    isLoading: connectionLoading,
    error: connectionQueryError,
    refetch: refetchStatus,
  } = useAirbnbConnectionStatus();
  const {
    data: listings = [],
    isLoading: listingsLoading,
    refetch: refetchListings,
  } = useAirbnbListings();
  const { data: properties = [] } = useChannelProperties();

  const connectMutation = useAirbnbConnect();
  const disconnectMutation = useAirbnbDisconnect();
  const toggleSyncMutation = useToggleSync();
  const toggleAutoInterventionsMutation = useToggleAutoInterventions();
  const toggleAutoPushPricingMutation = useToggleAutoPushPricing();
  const linkListingMutation = useLinkListing();
  const unlinkListingMutation = useUnlinkListing();

  // UI state
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [expandedListings, setExpandedListings] = useState(true);

  // OTA channel connections (non-Airbnb)
  const [connectDialogChannel, setConnectDialogChannel] = useState<OtaChannel | null>(null);
  const [disconnectConfirmChannel, setDisconnectConfirmChannel] = useState<OtaChannel | null>(null);
  const [disconnectingChannelId, setDisconnectingChannelId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { isConnected: isOtaConnected, getStatus: getOtaStatus, isLoading: otaConnectionsLoading } = useChannelConnections();
  const disconnectChannelMutation = useDisconnectChannel();

  // Link dialog
  const [linkingPropertyId, setLinkingPropertyId] = useState<number | null>(null);
  const [linkForm, setLinkForm] = useState({ airbnbListingId: '', airbnbListingTitle: '', airbnbListingUrl: '' });

  // ── Handlers ──

  const handleConnect = useCallback(() => {
    connectMutation.mutate(undefined, {
      onSuccess: ({ authorizationUrl }) => {
        window.location.href = authorizationUrl;
      },
      onError: () => {
        setConnectionError(t('channels.airbnb.errorConnecting'));
      },
    });
  }, [connectMutation, t]);

  const handleDisconnect = useCallback(() => {
    disconnectMutation.mutate(undefined, {
      onError: () => {
        setConnectionError(t('channels.airbnb.errorDisconnecting'));
      },
    });
  }, [disconnectMutation, t]);

  const handleToggleSync = useCallback((propertyId: number, enabled: boolean) => {
    toggleSyncMutation.mutate({ propertyId, enabled });
  }, [toggleSyncMutation]);

  const handleToggleAutoInterventions = useCallback((propertyId: number, enabled: boolean) => {
    toggleAutoInterventionsMutation.mutate({ propertyId, enabled });
  }, [toggleAutoInterventionsMutation]);

  const handleToggleAutoPushPricing = useCallback((propertyId: number, enabled: boolean) => {
    toggleAutoPushPricingMutation.mutate({ propertyId, enabled });
  }, [toggleAutoPushPricingMutation]);

  const handleLink = useCallback(() => {
    if (!linkingPropertyId || !linkForm.airbnbListingId) return;
    linkListingMutation.mutate(
      {
        propertyId: linkingPropertyId,
        airbnbListingId: linkForm.airbnbListingId,
        airbnbListingTitle: linkForm.airbnbListingTitle,
        airbnbListingUrl: linkForm.airbnbListingUrl,
      },
      {
        onSuccess: () => {
          setLinkingPropertyId(null);
          setLinkForm({ airbnbListingId: '', airbnbListingTitle: '', airbnbListingUrl: '' });
        },
      },
    );
  }, [linkingPropertyId, linkForm, linkListingMutation]);

  const handleUnlink = useCallback((propertyId: number) => {
    unlinkListingMutation.mutate(propertyId);
  }, [unlinkListingMutation]);

  // ── OTA channel handlers (non-Airbnb) ──
  const handleOtaConnect = useCallback((ota: OtaChannel) => {
    setConnectDialogChannel(ota);
  }, []);

  const handleOtaDisconnectRequest = useCallback((ota: OtaChannel) => {
    setDisconnectConfirmChannel(ota);
  }, []);

  const handleOtaDisconnectConfirm = useCallback(() => {
    if (!disconnectConfirmChannel) return;
    const channelId = disconnectConfirmChannel.id;
    const channelName = disconnectConfirmChannel.name;
    if (channelId in CHANNEL_BACKEND_MAP) {
      setDisconnectingChannelId(channelId);
      disconnectChannelMutation.mutate(channelId as ChannelId, {
        onSuccess: () => setSuccessMessage(t('channels.connect.successDisconnected', { channel: channelName })),
        onError: () => setConnectionError(t('channels.connect.errorDisconnecting', { channel: channelName })),
        onSettled: () => setDisconnectingChannelId(null),
      });
    }
    setDisconnectConfirmChannel(null);
  }, [disconnectConfirmChannel, disconnectChannelMutation, t]);

  const handleOtaConnected = useCallback(() => {
    if (connectDialogChannel) {
      setSuccessMessage(t('channels.connect.successConnected', { channel: connectDialogChannel.name }));
    }
    setConnectDialogChannel(null);
  }, [connectDialogChannel, t]);

  /** Check if a channel shares its backend with another (Vrbo ↔ Abritel → HOMEAWAY) */
  const getSharedChannelWarning = useCallback((channelId: string): string | null => {
    if (channelId === 'vrbo' || channelId === 'abritel') {
      const other = channelId === 'vrbo' ? 'Abritel' : 'Vrbo';
      return t('channels.connect.sharedChannelWarning', { other });
    }
    return null;
  }, [t]);

  // ── Derived ──
  const isConnected = connectionStatus?.connected === true;
  const linkedPropertyIds = new Set(listings.map((l) => l.propertyId));
  const unlinkableProperties = properties.filter((p) => !linkedPropertyIds.has(p.id));

  return (
    <Box sx={{ p: SPACING.PAGE_PADDING }}>
      <PageHeader
        title={t('channels.title')}
        subtitle={t('channels.subtitle')}
        backPath="/settings"
        showBackButton={false}
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<StarIcon sx={{ fontSize: 16 }} />}
              onClick={() => navigate('/channels/reviews')}
              sx={{ textTransform: 'none', fontSize: '0.75rem' }}
            >
              {t('channels.reviews.title')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => { refetchStatus(); refetchListings(); }}
              sx={{ textTransform: 'none', fontSize: '0.75rem' }}
            >
              {t('common.refresh')}
            </Button>
          </Box>
        }
      />

      {(connectionError || connectionQueryError) && (
        <Alert severity="error" sx={{ mb: 1.5, fontSize: '0.8125rem' }} onClose={() => setConnectionError(null)}>
          {connectionError || t('channels.airbnb.errorFetchingStatus')}
        </Alert>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          OTA Channels Grid
          ═══════════════════════════════════════════════════════════════════════ */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' },
        gap: 1.5,
        mb: 1.5,
      }}>
        {OTA_CHANNELS.map((ota) => {
          const isAirbnb = ota.id === 'airbnb';
          const isOtaChannel = (ota.id as string) in CHANNEL_BACKEND_MAP;
          const otaStatus = isOtaChannel ? getOtaStatus(ota.id as ChannelId) : undefined;

          return (
            <OtaChannelCard
              key={ota.id}
              channel={ota}
              isConnected={isAirbnb ? isConnected : isOtaChannel ? isOtaConnected(ota.id as ChannelId) : false}
              connectionStatus={isAirbnb ? connectionStatus : otaStatus ? { status: otaStatus.status } : null}
              connectionLoading={isAirbnb ? connectionLoading : isOtaChannel ? otaConnectionsLoading : false}
              onConnect={isAirbnb ? handleConnect : isOtaChannel ? () => handleOtaConnect(ota) : undefined}
              onDisconnect={isAirbnb ? handleDisconnect : isOtaChannel ? () => handleOtaDisconnectRequest(ota) : undefined}
              connecting={isAirbnb ? connectMutation.isPending : false}
              disconnecting={isAirbnb ? disconnectMutation.isPending : disconnectingChannelId === ota.id}
              t={t}
            />
          );
        })}
      </Box>

      {/* ═══════════════════════════════════════════════════════════════════════
          Airbnb Connection Details (shown when connected)
          ═══════════════════════════════════════════════════════════════════════ */}
      {isConnected && connectionStatus && (
        <Paper sx={{ ...CARD_SX, mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Box
              component="img"
              src={airbnbLogoSmall}
              alt="Airbnb"
              sx={{ height: 18 }}
            />
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 700 }}>
              {t('channels.airbnb.connectedSince')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <DetailItem label={t('channels.airbnb.userId')} value={connectionStatus.airbnbUserId ?? '—'} />
            <DetailItem
              label={t('channels.airbnb.connectedSince')}
              value={connectionStatus.connectedAt ? new Date(connectionStatus.connectedAt).toLocaleDateString(dateLocale) : '—'}
            />
            <DetailItem
              label={t('channels.airbnb.lastSync')}
              value={connectionStatus.lastSyncAt ? new Date(connectionStatus.lastSyncAt).toLocaleString(dateLocale) : '—'}
            />
            <DetailItem
              label={t('channels.airbnb.linkedListings')}
              value={String(connectionStatus.linkedListingsCount)}
            />
            {connectionStatus.errorMessage && (
              <Alert severity="warning" sx={{ fontSize: '0.75rem', py: 0, width: '100%' }}>
                {connectionStatus.errorMessage}
              </Alert>
            )}
          </Box>
        </Paper>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TODO: Panneau de details pour les channels OTA non-Airbnb connectes.
          Quand un channel OTA (Booking, Expedia, etc.) est connecte, afficher un panneau
          similaire a celui d'Airbnb ci-dessus, avec les informations suivantes :
          - connectedSince (date de connexion) → t('channels.connectionDetails.connectedSince')
          - lastSync (derniere synchronisation) → t('channels.connectionDetails.lastSync')
          - externalId (ID externe sur l'OTA) → t('channels.connectionDetails.externalId')
          - status (statut de la connexion) → t('channels.connectionDetails.status')
          Les cles i18n sont deja definies dans fr.json/en.json sous 'channels.connectionDetails.*'.
          Les donnees sont disponibles via getOtaStatus(channelId) qui retourne
          { connectedAt, lastSyncAt, externalPropertyId, status }.
          ═══════════════════════════════════════════════════════════════════════ */}

      {/* ═══════════════════════════════════════════════════════════════════════
          Section 2 : Propriétés liées (Listings)
          ═══════════════════════════════════════════════════════════════════════ */}
      {isConnected && (
        <Paper sx={{ ...CARD_SX, mb: 1.5 }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={() => setExpandedListings((prev) => !prev)}
          >
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 700 }}>
              {t('channels.listings.title')} ({listings.length})
            </Typography>
            <IconButton size="small">
              {expandedListings ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>

          <Collapse in={expandedListings}>
            {listingsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : listings.length === 0 ? (
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 1 }}>
                {t('channels.listings.noListings')}
              </Typography>
            ) : (
              <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {listings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    onToggleSync={handleToggleSync}
                    onToggleAutoInterventions={handleToggleAutoInterventions}
                    onToggleAutoPushPricing={handleToggleAutoPushPricing}
                    onUnlink={handleUnlink}
                    t={t}
                  />
                ))}
              </Box>
            )}

            {/* Link new property */}
            {unlinkableProperties.length > 0 && (
              <Box sx={{ mt: 1.5 }}>
                <Divider sx={{ mb: 1.5 }} />
                {linkingPropertyId === null ? (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<LinkIcon />}
                    onClick={() => setLinkingPropertyId(unlinkableProperties[0]?.id ?? null)}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    {t('channels.listings.linkProperty')}
                  </Button>
                ) : (
                  <LinkPropertyForm
                    properties={unlinkableProperties}
                    selectedPropertyId={linkingPropertyId}
                    form={linkForm}
                    loading={linkListingMutation.isPending}
                    onPropertyChange={setLinkingPropertyId}
                    onFormChange={setLinkForm}
                    onSubmit={handleLink}
                    onCancel={() => { setLinkingPropertyId(null); setLinkForm({ airbnbListingId: '', airbnbListingTitle: '', airbnbListingUrl: '' }); }}
                    t={t}
                  />
                )}
              </Box>
            )}
          </Collapse>
        </Paper>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          Section 3 : Statut sync par propriété (Channel Manager vue hôte)
          ═══════════════════════════════════════════════════════════════════════ */}
      {isConnected && listings.length > 0 && (
        <Paper sx={{ ...CARD_SX }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, mb: 1 }}>
            {t('channels.syncStatus.title')}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 1 }}>
            {listings.map((listing) => {
              const property = properties.find((p) => p.id === listing.propertyId);
              return (
                <SyncStatusCard
                  key={listing.id}
                  listing={listing}
                  propertyName={property?.name ?? `Propriété #${listing.propertyId}`}
                  t={t}
                  dateLocale={dateLocale}
                />
              );
            })}
          </Box>
        </Paper>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          Channel Connect Dialog (non-Airbnb)
          ═══════════════════════════════════════════════════════════════════════ */}
      {connectDialogChannel && (
        <ChannelConnectDialog
          open={!!connectDialogChannel}
          channel={connectDialogChannel}
          onClose={() => setConnectDialogChannel(null)}
          onConnected={handleOtaConnected}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          Disconnect Confirmation Dialog
          ═══════════════════════════════════════════════════════════════════════ */}
      {/* ═══════════════════════════════════════════════════════════════════════
          Success Snackbar
          ═══════════════════════════════════════════════════════════════════════ */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSuccessMessage(null)}
          severity="success"
          variant="filled"
          sx={{ width: '100%', fontSize: '0.8125rem' }}
        >
          {successMessage}
        </Alert>
      </Snackbar>

      {/* ═══════════════════════════════════════════════════════════════════════
          Disconnect Confirmation Dialog
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!disconnectConfirmChannel} onClose={() => setDisconnectConfirmChannel(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>
          {t('channels.connect.disconnectConfirm', { channel: disconnectConfirmChannel?.name ?? '' })}
        </DialogTitle>
        <DialogContent>
          {disconnectConfirmChannel && getSharedChannelWarning(disconnectConfirmChannel.id) && (
            <Alert severity="warning" sx={{ fontSize: '0.8125rem' }}>
              {getSharedChannelWarning(disconnectConfirmChannel.id)}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button size="small" onClick={() => setDisconnectConfirmChannel(null)} sx={{ textTransform: 'none' }}>
            {t('common.cancel')}
          </Button>
          <Button size="small" variant="contained" color="error" onClick={handleOtaDisconnectConfirm} sx={{ textTransform: 'none' }}>
            {t('channels.airbnb.disconnect')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function OtaLogo({ channel }: { channel: OtaChannel }) {
  if (channel.logo) {
    return (
      <Box
        component="img"
        src={channel.logo}
        alt={channel.name}
        sx={{
          height: 30,
          objectFit: 'contain',
          maxWidth: 130,
          position: 'relative',
          zIndex: 2,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3)) brightness(1.05)',
        }}
      />
    );
  }

  return (
    <Typography
      sx={{
        fontSize: '1.25rem',
        fontWeight: 800,
        color: '#fff',
        letterSpacing: '-0.02em',
        lineHeight: 1,
        position: 'relative',
        zIndex: 2,
        textShadow: '0 2px 6px rgba(0,0,0,0.35)',
      }}
    >
      {channel.name}
    </Typography>
  );
}

function OtaChannelCard({
  channel,
  isConnected,
  connectionStatus,
  connectionLoading,
  onConnect,
  onDisconnect,
  connecting,
  disconnecting,
  t,
}: {
  channel: OtaChannel;
  isConnected: boolean;
  connectionStatus: { status?: string | null } | null;
  connectionLoading: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  connecting: boolean;
  disconnecting: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const isAvailable = channel.available;

  return (
    <Box
      sx={{
        ...OTA_CARD_SX,
        opacity: isAvailable ? 1 : 0.7,
        '&:hover': isAvailable
          ? OTA_CARD_SX['&:hover']
          : { borderColor: 'grey.300' },
      }}
    >
      {/* Brand header with logo + status */}
      <Box
        sx={{
          background: channel.brandGradient,
          opacity: isAvailable ? 1 : 0.6,
          px: 2.5,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 56,
        }}
      >
        <OtaLogo channel={channel} />
        {connectionLoading && isAvailable ? (
          <CircularProgress size={14} sx={{ color: 'rgba(255,255,255,0.8)' }} />
        ) : isAvailable && isConnected ? (
          <Chip
            label={connectionStatus?.status ?? 'ACTIVE'}
            size="small"
            sx={{
              fontSize: '0.5625rem',
              height: 20,
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: '#fff',
              fontWeight: 700,
              border: '1px solid rgba(255,255,255,0.3)',
              backdropFilter: 'blur(4px)',
            }}
            icon={<CheckCircleIcon sx={{ fontSize: '0.75rem !important', color: '#fff !important' }} />}
          />
        ) : isAvailable ? (
          <Chip
            label={t('channels.ota.disconnected')}
            size="small"
            sx={{
              fontSize: '0.5625rem',
              height: 20,
              fontWeight: 600,
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.3)',
              backdropFilter: 'blur(4px)',
            }}
          />
        ) : (
          <Chip
            label={t('channels.ota.comingSoon')}
            size="small"
            sx={{
              fontSize: '0.5625rem',
              height: 20,
              fontWeight: 600,
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.3)',
              backdropFilter: 'blur(4px)',
            }}
          />
        )}
      </Box>

      {/* Card content */}
      <Box sx={OTA_CARD_CONTENT_SX}>
        {/* Channel name */}
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: 'text.primary' }}>
          {channel.name}
        </Typography>

        {/* Description */}
        <Typography sx={{
          fontSize: '0.6875rem',
          color: 'text.secondary',
          lineHeight: 1.5,
          flex: 1,
          minHeight: 32,
        }}>
          {t(channel.descriptionKey)}
        </Typography>

        {/* Action button */}
        <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
          {isAvailable && !isConnected && (
            <Button
              size="small"
              variant="contained"
              startIcon={<LinkIcon sx={{ fontSize: '0.8rem' }} />}
              onClick={onConnect}
              disabled={connecting || connectionLoading}
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                px: 2,
                py: 0.5,
                minHeight: 30,
                backgroundColor: channel.brandColor,
                '&:hover': {
                  backgroundColor: channel.brandColor,
                  filter: 'brightness(0.9)',
                },
              }}
            >
              {connecting ? <CircularProgress size={12} color="inherit" /> : t('channels.airbnb.connect')}
            </Button>
          )}
          {isAvailable && isConnected && (
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<LinkOffIcon sx={{ fontSize: '0.8rem' }} />}
              onClick={onDisconnect}
              disabled={disconnecting}
              sx={{ fontSize: '0.6875rem', px: 2, py: 0.5, minHeight: 30 }}
            >
              {disconnecting ? <CircularProgress size={12} /> : t('channels.airbnb.disconnect')}
            </Button>
          )}
          {!isAvailable && (
            <Button
              size="small"
              variant="outlined"
              disabled
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                px: 2,
                py: 0.5,
                minHeight: 30,
                borderColor: 'grey.200',
                color: 'text.disabled',
              }}
            >
              {t('channels.ota.comingSoon')}
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
        {value}
      </Typography>
    </Box>
  );
}

function ListingCard({
  listing,
  onToggleSync,
  onToggleAutoInterventions,
  onToggleAutoPushPricing,
  onUnlink,
  t,
}: {
  listing: AirbnbListingMapping;
  onToggleSync: (propertyId: number, enabled: boolean) => void;
  onToggleAutoInterventions: (propertyId: number, enabled: boolean) => void;
  onToggleAutoPushPricing: (propertyId: number, enabled: boolean) => void;
  onUnlink: (propertyId: number) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        p: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1,
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {listing.airbnbListingTitle || `Listing ${listing.airbnbListingId}`}
          {listing.airbnbListingUrl && (
            <Tooltip title={t('channels.listings.viewOnAirbnb')}>
              <IconButton
                size="small"
                href={listing.airbnbListingUrl}
                target="_blank"
                rel="noopener noreferrer"
                component="a"
                sx={{ p: 0.25 }}
              >
                <OpenInNewIcon sx={{ fontSize: '0.875rem' }} />
              </IconButton>
            </Tooltip>
          )}
        </Typography>
        <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
          ID: {listing.airbnbListingId} · Propriété #{listing.propertyId}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={listing.syncEnabled}
              onChange={(_, checked) => onToggleSync(listing.propertyId, checked)}
            />
          }
          label={<Typography sx={{ fontSize: '0.6875rem' }}>{t('channels.listings.sync')}</Typography>}
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={listing.autoCreateInterventions}
              onChange={(_, checked) => onToggleAutoInterventions(listing.propertyId, checked)}
            />
          }
          label={
            <Typography sx={{ fontSize: '0.6875rem', display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <CleaningIcon sx={{ fontSize: '0.75rem' }} /> {t('channels.listings.autoClean')}
            </Typography>
          }
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={listing.autoPushPricing ?? false}
              onChange={(_, checked) => onToggleAutoPushPricing(listing.propertyId, checked)}
            />
          }
          label={
            <Typography sx={{ fontSize: '0.6875rem', display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <PricingIcon sx={{ fontSize: '0.75rem' }} /> {t('channels.listings.autoPushPricing')}
            </Typography>
          }
        />
        <Tooltip title={t('channels.listings.unlink')}>
          <IconButton size="small" color="error" onClick={() => onUnlink(listing.propertyId)}>
            <LinkOffIcon sx={{ fontSize: '1rem' }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

function LinkPropertyForm({
  properties,
  selectedPropertyId,
  form,
  loading,
  onPropertyChange,
  onFormChange,
  onSubmit,
  onCancel,
  t,
}: {
  properties: Property[];
  selectedPropertyId: number;
  form: { airbnbListingId: string; airbnbListingTitle: string; airbnbListingUrl: string };
  loading: boolean;
  onPropertyChange: (id: number) => void;
  onFormChange: (form: { airbnbListingId: string; airbnbListingTitle: string; airbnbListingUrl: string }) => void;
  onSubmit: () => void;
  onCancel: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
        {t('channels.listings.linkNewProperty')}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Box component="select"
          value={selectedPropertyId}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onPropertyChange(Number(e.target.value))}
          sx={{
            fontSize: '0.8125rem', px: 1, py: 0.75, borderRadius: 1,
            border: '1px solid', borderColor: 'divider', minWidth: 160, bgcolor: 'background.paper',
          }}
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Box>
        <Box
          component="input"
          placeholder="Airbnb Listing ID"
          value={form.airbnbListingId}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFormChange({ ...form, airbnbListingId: e.target.value })}
          sx={{ fontSize: '0.8125rem', px: 1, py: 0.75, borderRadius: 1, border: '1px solid', borderColor: 'divider', minWidth: 140 }}
        />
        <Box
          component="input"
          placeholder={t('channels.listings.listingTitle')}
          value={form.airbnbListingTitle}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFormChange({ ...form, airbnbListingTitle: e.target.value })}
          sx={{ fontSize: '0.8125rem', px: 1, py: 0.75, borderRadius: 1, border: '1px solid', borderColor: 'divider', minWidth: 180, flex: 1 }}
        />
        <Box
          component="input"
          placeholder="URL Airbnb"
          value={form.airbnbListingUrl}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFormChange({ ...form, airbnbListingUrl: e.target.value })}
          sx={{ fontSize: '0.8125rem', px: 1, py: 0.75, borderRadius: 1, border: '1px solid', borderColor: 'divider', minWidth: 200, flex: 1 }}
        />
        <Button
          size="small"
          variant="contained"
          onClick={onSubmit}
          disabled={loading || !form.airbnbListingId}
          sx={{ fontSize: '0.75rem' }}
        >
          {loading ? <CircularProgress size={14} /> : t('channels.listings.link')}
        </Button>
        <Button size="small" variant="outlined" onClick={onCancel} sx={{ fontSize: '0.75rem' }}>
          {t('common.cancel')}
        </Button>
      </Box>
    </Box>
  );
}

function SyncStatusCard({
  listing,
  propertyName,
  t,
  dateLocale,
}: {
  listing: AirbnbListingMapping;
  propertyName: string;
  t: (key: string, options?: Record<string, unknown>) => string;
  dateLocale: string;
}) {
  const syncOk = listing.syncEnabled && listing.lastSyncAt;
  const StatusIcon = syncOk ? CheckCircleIcon : listing.syncEnabled ? WarningIcon : ErrorIcon;
  const statusColor = syncOk ? '#4A9B8E' : listing.syncEnabled ? '#D4A574' : '#9e9e9e';

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        p: 1.25,
        borderLeft: `3px solid ${statusColor}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <StatusIcon sx={{ fontSize: '0.875rem', color: statusColor }} />
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
          {propertyName}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
        {listing.syncEnabled ? t('channels.syncStatus.syncOn') : t('channels.syncStatus.syncOff')}
        {listing.lastSyncAt && ` · ${t('channels.syncStatus.lastSync')}: ${new Date(listing.lastSyncAt).toLocaleString(dateLocale)}`}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
        {listing.syncEnabled && <Chip label={<><SyncIcon sx={{ fontSize: '0.625rem' }} /> Sync</>} size="small" sx={{ fontSize: '0.5625rem', height: 18 }} color="success" variant="outlined" />}
        {listing.autoCreateInterventions && <Chip label={<><CleaningIcon sx={{ fontSize: '0.625rem' }} /> Auto</>} size="small" sx={{ fontSize: '0.5625rem', height: 18 }} color="info" variant="outlined" />}
      </Box>
    </Box>
  );
}

export default ChannelsPage;
