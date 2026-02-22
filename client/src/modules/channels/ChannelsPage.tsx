import React, { useState, useEffect, useCallback } from 'react';
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
import { airbnbApi } from '../../services/api/airbnbApi';
import type { AirbnbConnectionStatus, AirbnbListingMapping } from '../../services/api/airbnbApi';
import { propertiesApi } from '../../services/api/propertiesApi';
import type { Property } from '../../services/api/propertiesApi';

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

// ─── Component ──────────────────────────────────────────────────────────────

const ChannelsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<AirbnbConnectionStatus | null>(null);
  const [connectionLoading, setConnectionLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Listings state
  const [listings, setListings] = useState<AirbnbListingMapping[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [expandedListings, setExpandedListings] = useState(true);

  // Properties for linking
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);

  // Link dialog
  const [linkingPropertyId, setLinkingPropertyId] = useState<number | null>(null);
  const [linkForm, setLinkForm] = useState({ airbnbListingId: '', airbnbListingTitle: '', airbnbListingUrl: '' });
  const [linkLoading, setLinkLoading] = useState(false);

  // ── Fetch connection status ──
  const fetchStatus = useCallback(async () => {
    setConnectionLoading(true);
    setConnectionError(null);
    try {
      const status = await airbnbApi.getConnectionStatus();
      setConnectionStatus(status);
    } catch {
      setConnectionError(t('channels.airbnb.errorFetchingStatus'));
    } finally {
      setConnectionLoading(false);
    }
  }, [t]);

  // ── Fetch listings ──
  const fetchListings = useCallback(async () => {
    setListingsLoading(true);
    try {
      const data = await airbnbApi.getListings();
      setListings(data);
    } catch {
      // Silently fail — listings section shows empty
    } finally {
      setListingsLoading(false);
    }
  }, []);

  // ── Fetch properties ──
  const fetchProperties = useCallback(async () => {
    setPropertiesLoading(true);
    try {
      const data = await propertiesApi.getAll();
      setProperties(data);
    } catch {
      // Silently fail
    } finally {
      setPropertiesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchListings();
    fetchProperties();
  }, [fetchStatus, fetchListings, fetchProperties]);

  // ── Connect ──
  const handleConnect = useCallback(async () => {
    setConnecting(true);
    try {
      const { authorizationUrl } = await airbnbApi.connect();
      window.location.href = authorizationUrl;
    } catch {
      setConnectionError(t('channels.airbnb.errorConnecting'));
      setConnecting(false);
    }
  }, [t]);

  // ── Disconnect ──
  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      await airbnbApi.disconnect();
      setConnectionStatus(null);
      setListings([]);
      await fetchStatus();
    } catch {
      setConnectionError(t('channels.airbnb.errorDisconnecting'));
    } finally {
      setDisconnecting(false);
    }
  }, [fetchStatus, t]);

  // ── Toggle sync ──
  const handleToggleSync = useCallback(async (propertyId: number, enabled: boolean) => {
    try {
      const updated = await airbnbApi.toggleSync(propertyId, enabled);
      setListings((prev) => prev.map((l) => (l.propertyId === propertyId ? { ...l, ...updated } : l)));
    } catch {
      // Revert will happen on next fetch
    }
  }, []);

  // ── Toggle auto-interventions ──
  const handleToggleAutoInterventions = useCallback(async (propertyId: number, enabled: boolean) => {
    try {
      const updated = await airbnbApi.toggleAutoInterventions(propertyId, enabled);
      setListings((prev) => prev.map((l) => (l.propertyId === propertyId ? { ...l, ...updated } : l)));
    } catch {
      // Revert will happen on next fetch
    }
  }, []);

  // ── Toggle auto-push pricing ──
  const handleToggleAutoPushPricing = useCallback(async (propertyId: number, enabled: boolean) => {
    try {
      const updated = await airbnbApi.toggleAutoPushPricing(propertyId, enabled);
      setListings((prev) => prev.map((l) => (l.propertyId === propertyId ? { ...l, ...updated } : l)));
    } catch {
      // Revert will happen on next fetch
    }
  }, []);

  // ── Link property ──
  const handleLink = useCallback(async () => {
    if (!linkingPropertyId || !linkForm.airbnbListingId) return;
    setLinkLoading(true);
    try {
      const mapping = await airbnbApi.linkListing({
        propertyId: linkingPropertyId,
        airbnbListingId: linkForm.airbnbListingId,
        airbnbListingTitle: linkForm.airbnbListingTitle,
        airbnbListingUrl: linkForm.airbnbListingUrl,
      });
      setListings((prev) => [...prev, mapping]);
      setLinkingPropertyId(null);
      setLinkForm({ airbnbListingId: '', airbnbListingTitle: '', airbnbListingUrl: '' });
    } catch {
      // Error handling
    } finally {
      setLinkLoading(false);
    }
  }, [linkingPropertyId, linkForm]);

  // ── Unlink property ──
  const handleUnlink = useCallback(async (propertyId: number) => {
    try {
      await airbnbApi.unlinkListing(propertyId);
      setListings((prev) => prev.filter((l) => l.propertyId !== propertyId));
    } catch {
      // Error handling
    }
  }, []);

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
              onClick={() => { fetchStatus(); fetchListings(); }}
              sx={{ textTransform: 'none', fontSize: '0.75rem' }}
            >
              {t('common.refresh')}
            </Button>
          </Box>
        }
      />

      {connectionError && (
        <Alert severity="error" sx={{ mb: 1.5, fontSize: '0.8125rem' }} onClose={() => setConnectionError(null)}>
          {connectionError}
        </Alert>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          Section 1 : Connexion Airbnb
          ═══════════════════════════════════════════════════════════════════════ */}
      <Paper sx={{ ...CARD_SX, mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              component="img"
              src="https://upload.wikimedia.org/wikipedia/commons/6/69/Airbnb_Logo_B%C3%A9lo.svg"
              alt="Airbnb"
              sx={{ height: 20, opacity: isConnected ? 1 : 0.4 }}
            />
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 700 }}>
              Airbnb
            </Typography>
            {connectionLoading ? (
              <CircularProgress size={14} />
            ) : isConnected ? (
              <Chip
                label={connectionStatus?.status ?? 'ACTIVE'}
                size="small"
                sx={{
                  fontSize: '0.625rem',
                  height: 20,
                  backgroundColor: `${STATUS_COLORS[connectionStatus?.status ?? 'ACTIVE']}20`,
                  color: STATUS_COLORS[connectionStatus?.status ?? 'ACTIVE'],
                  fontWeight: 600,
                }}
                icon={<CheckCircleIcon sx={{ fontSize: '0.75rem !important' }} />}
              />
            ) : (
              <Chip
                label={t('channels.airbnb.disconnected')}
                size="small"
                sx={{ fontSize: '0.625rem', height: 20 }}
                color="default"
              />
            )}
          </Box>

          {connectionLoading ? null : isConnected ? (
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<LinkOffIcon />}
              onClick={handleDisconnect}
              disabled={disconnecting}
              sx={{ fontSize: '0.75rem' }}
            >
              {disconnecting ? <CircularProgress size={14} /> : t('channels.airbnb.disconnect')}
            </Button>
          ) : (
            <Button
              size="small"
              variant="contained"
              startIcon={<LinkIcon />}
              onClick={handleConnect}
              disabled={connecting}
              sx={{ fontSize: '0.75rem' }}
            >
              {connecting ? <CircularProgress size={14} /> : t('channels.airbnb.connect')}
            </Button>
          )}
        </Box>

        {/* Connection details */}
        {isConnected && connectionStatus && (
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <DetailItem label={t('channels.airbnb.userId')} value={connectionStatus.airbnbUserId ?? '—'} />
            <DetailItem
              label={t('channels.airbnb.connectedSince')}
              value={connectionStatus.connectedAt ? new Date(connectionStatus.connectedAt).toLocaleDateString('fr-FR') : '—'}
            />
            <DetailItem
              label={t('channels.airbnb.lastSync')}
              value={connectionStatus.lastSyncAt ? new Date(connectionStatus.lastSyncAt).toLocaleString('fr-FR') : '—'}
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
        )}

        {!isConnected && !connectionLoading && (
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
            {t('channels.airbnb.connectDescription')}
          </Typography>
        )}
      </Paper>

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
                    loading={linkLoading}
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
                />
              );
            })}
          </Box>
        </Paper>
      )}
    </Box>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────────────

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
  t: (key: string) => string;
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
  t: (key: string) => string;
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
}: {
  listing: AirbnbListingMapping;
  propertyName: string;
  t: (key: string) => string;
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
        {listing.lastSyncAt && ` · ${t('channels.syncStatus.lastSync')}: ${new Date(listing.lastSyncAt).toLocaleString('fr-FR')}`}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
        {listing.syncEnabled && <Chip label={<><SyncIcon sx={{ fontSize: '0.625rem' }} /> Sync</>} size="small" sx={{ fontSize: '0.5625rem', height: 18 }} color="success" variant="outlined" />}
        {listing.autoCreateInterventions && <Chip label={<><CleaningIcon sx={{ fontSize: '0.625rem' }} /> Auto</>} size="small" sx={{ fontSize: '0.5625rem', height: 18 }} color="info" variant="outlined" />}
      </Box>
    </Box>
  );
}

export default ChannelsPage;
