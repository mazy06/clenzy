import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Link as LinkIcon,
  Refresh as RefreshIcon,
} from '../../icons';
import { useNavigate } from 'react-router-dom';
import { Star as StarIcon } from '../../icons';
import PageHeader from '../../components/PageHeader';
import FilterSearchBar from '../../components/FilterSearchBar';
import EmptyState from '../../components/EmptyState';
import { useTranslation } from '../../hooks/useTranslation';
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
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
import { CHANNEL_BACKEND_MAP } from '../../services/api/channelConnectionApi';
import type { ChannelId } from '../../services/api/channelConnectionApi';
import { OTA_CHANNELS, type OtaChannel } from '../../services/channels/otaChannels';
import ChannelConnectDialog from './ChannelConnectDialog';
import ChannelsListView from './ChannelsListView';
import ChannelsGridView from './ChannelsGridView';
import AirbnbConnectionDetails from './AirbnbConnectionDetails';
import AirbnbListingsSection from './AirbnbListingsSection';
import AirbnbSyncStatusSection from './AirbnbSyncStatusSection';
import ChannelDisconnectDialog from './ChannelDisconnectDialog';

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

  // View mode: grid (default) ou list — persiste par utilisateur via
  // usePersistedViewMode (scope sub Keycloak + screen "channels").
  const VIEW_MODES = ['list', 'grid'] as const;
  const [viewMode, setViewMode] = usePersistedViewMode<'list' | 'grid'>(
    'channels',
    'grid',
    VIEW_MODES,
  );

  // Recherche + filtre par segment (B2C / B2B) sur le catalogue d'intégrations.
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('all');
  const filteredChannels = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return OTA_CHANNELS.filter((c) => {
      const matchesSearch = !q || c.name.toLowerCase().includes(q);
      const matchesSegment = selectedSegment === 'all' || c.segment === selectedSegment;
      return matchesSearch && matchesSegment;
    });
  }, [searchTerm, selectedSegment]);

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

  // ── Derived ──
  const isConnected = connectionStatus?.connected === true;
  const linkedPropertyIds = new Set(listings.map((l) => l.propertyId));
  const unlinkableProperties = properties.filter((p) => !linkedPropertyIds.has(p.id));

  const filterBar = (
    <FilterSearchBar
      bare
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder={t('channels.searchPlaceholder', 'Rechercher une intégration…')}
      filters={{
        category: {
          value: selectedSegment,
          options: [
            { value: 'all', label: t('common.all', 'Tous') },
            { value: 'B2C', label: 'B2C' },
            { value: 'B2B', label: 'B2B' },
          ],
          onChange: setSelectedSegment,
          label: t('channels.segment', 'Segment'),
        },
      }}
      counter={{ label: t('channels.counterLabel', 'intégration'), count: filteredChannels.length, singular: '', plural: 's' }}
      viewToggle={{ mode: viewMode, onChange: (m) => setViewMode(m as 'list' | 'grid'), modes: ['grid', 'list'] }}
    />
  );

  return (
    <Box>
      <PageHeader
        title={t('channels.title')}
        subtitle={t('channels.subtitle')}
        iconBadge={<LinkIcon />}
        backPath="/settings"
        showBackButton={false}
        filters={filterBar}
        actions={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<StarIcon size={16} strokeWidth={1.75} />}
              onClick={() => navigate('/channels/reviews')}
            >
              {t('channels.reviews.title')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => { refetchStatus(); refetchListings(); }}
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
          OTA Channels — List or Grid
          ═══════════════════════════════════════════════════════════════════════ */}
      {filteredChannels.length === 0 ? (
        <EmptyState
          icon={<LinkIcon />}
          title={t('channels.empty.title', 'Aucune intégration trouvée')}
          description={t('channels.empty.description', 'Ajuste ta recherche ou le filtre de segment.')}
        />
      ) : viewMode === 'list' ? (
        <ChannelsListView
          channels={filteredChannels}
          isConnected={isConnected}
          connectionStatus={connectionStatus}
          connectionLoading={connectionLoading}
          otaConnectionsLoading={otaConnectionsLoading}
          isOtaConnected={isOtaConnected}
          getOtaStatus={getOtaStatus}
          connectPending={connectMutation.isPending}
          disconnectPending={disconnectMutation.isPending}
          disconnectingChannelId={disconnectingChannelId}
          onAirbnbConnect={handleConnect}
          onAirbnbDisconnect={handleDisconnect}
          onOtaConnect={handleOtaConnect}
          onOtaDisconnectRequest={handleOtaDisconnectRequest}
          t={t}
        />
      ) : (
        <ChannelsGridView
          channels={filteredChannels}
          isConnected={isConnected}
          connectionStatus={connectionStatus}
          connectionLoading={connectionLoading}
          otaConnectionsLoading={otaConnectionsLoading}
          isOtaConnected={isOtaConnected}
          getOtaStatus={getOtaStatus}
          connectPending={connectMutation.isPending}
          disconnectPending={disconnectMutation.isPending}
          disconnectingChannelId={disconnectingChannelId}
          onAirbnbConnect={handleConnect}
          onAirbnbDisconnect={handleDisconnect}
          onOtaConnect={handleOtaConnect}
          onOtaDisconnectRequest={handleOtaDisconnectRequest}
          t={t}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          Airbnb Connection Details (shown when connected)
          ═══════════════════════════════════════════════════════════════════════ */}
      {isConnected && connectionStatus && (
        <AirbnbConnectionDetails
          connectionStatus={connectionStatus}
          dateLocale={dateLocale}
          t={t}
        />
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
        <AirbnbListingsSection
          listings={listings}
          listingsLoading={listingsLoading}
          expanded={expandedListings}
          onToggleExpand={() => setExpandedListings((prev) => !prev)}
          onToggleSync={handleToggleSync}
          onToggleAutoInterventions={handleToggleAutoInterventions}
          onToggleAutoPushPricing={handleToggleAutoPushPricing}
          onUnlink={handleUnlink}
          unlinkableProperties={unlinkableProperties}
          linkingPropertyId={linkingPropertyId}
          linkForm={linkForm}
          linkPending={linkListingMutation.isPending}
          onStartLink={() => setLinkingPropertyId(unlinkableProperties[0]?.id ?? null)}
          onPropertyChange={setLinkingPropertyId}
          onFormChange={setLinkForm}
          onSubmitLink={handleLink}
          onCancelLink={() => { setLinkingPropertyId(null); setLinkForm({ airbnbListingId: '', airbnbListingTitle: '', airbnbListingUrl: '' }); }}
          t={t}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          Section 3 : Statut sync par propriété (Channel Manager vue hôte)
          ═══════════════════════════════════════════════════════════════════════ */}
      {isConnected && listings.length > 0 && (
        <AirbnbSyncStatusSection
          listings={listings}
          properties={properties}
          dateLocale={dateLocale}
          t={t}
        />
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
      <ChannelDisconnectDialog
        channel={disconnectConfirmChannel}
        onClose={() => setDisconnectConfirmChannel(null)}
        onConfirm={handleOtaDisconnectConfirm}
        t={t}
      />
    </Box>
  );
};

export default ChannelsPage;
