import React from 'react';
import { Spinner } from '../../components/ui';
import { Box, Paper, Button, Switch, FormControlLabel, Divider, IconButton, Tooltip, Collapse } from '@mui/material';
import {
  LinkOff as LinkOffIcon,
  Link as LinkIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CleaningServices as CleaningIcon,
  OpenInNew as OpenInNewIcon,
  TrendingUp as PricingIcon,
} from '../../icons';
import type { AirbnbListingMapping } from '../../services/api/airbnbApi';
import type { Property } from '../../services/api/propertiesApi';
import { CARD_SX } from './channelsPageConstants';

interface LinkFormState {
  airbnbListingId: string;
  airbnbListingTitle: string;
  airbnbListingUrl: string;
}

interface AirbnbListingsSectionProps {
  listings: AirbnbListingMapping[];
  listingsLoading: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleSync: (propertyId: number, enabled: boolean) => void;
  onToggleAutoInterventions: (propertyId: number, enabled: boolean) => void;
  onToggleAutoPushPricing: (propertyId: number, enabled: boolean) => void;
  onUnlink: (propertyId: number) => void;
  unlinkableProperties: Property[];
  linkingPropertyId: number | null;
  linkForm: LinkFormState;
  linkPending: boolean;
  onStartLink: () => void;
  onPropertyChange: (id: number) => void;
  onFormChange: (form: LinkFormState) => void;
  onSubmitLink: () => void;
  onCancelLink: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

/** Section 2 : Propriétés liées (listings Airbnb) + ajout de lien. */
const AirbnbListingsSection: React.FC<AirbnbListingsSectionProps> = ({
  listings,
  listingsLoading,
  expanded,
  onToggleExpand,
  onToggleSync,
  onToggleAutoInterventions,
  onToggleAutoPushPricing,
  onUnlink,
  unlinkableProperties,
  linkingPropertyId,
  linkForm,
  linkPending,
  onStartLink,
  onPropertyChange,
  onFormChange,
  onSubmitLink,
  onCancelLink,
  t,
}) => (
  <Paper sx={{ ...CARD_SX, mb: 1.5 }}>
    <div className="flex items-center justify-between cursor-pointer" onClick={onToggleExpand}>
      <p className="cn-text-body1 text-[0.875rem] font-bold">
        {t('channels.listings.title')} ({listings.length})
      </p>
      <IconButton size="small">
        {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </IconButton>
    </div>

    <Collapse in={expanded}>
      {listingsLoading ? (
        <div className="flex justify-center py-3">
          <Spinner className="size-6" />
        </div>
      ) : listings.length === 0 ? (
        <p className="cn-text-body1 text-[0.75rem] text-muted-foreground mt-1.5">
          {t('channels.listings.noListings')}
        </p>
      ) : (
        <div className="mt-1.5 flex flex-col gap-1.5">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onToggleSync={onToggleSync}
              onToggleAutoInterventions={onToggleAutoInterventions}
              onToggleAutoPushPricing={onToggleAutoPushPricing}
              onUnlink={onUnlink}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Link new property */}
      {unlinkableProperties.length > 0 && (
        <div className="mt-2">
          <Divider sx={{ mb: 1.5 }} />
          {linkingPropertyId === null ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<LinkIcon />}
              onClick={onStartLink}
              sx={{ fontSize: '0.75rem' }}
            >
              {t('channels.listings.linkProperty')}
            </Button>
          ) : (
            <LinkPropertyForm
              properties={unlinkableProperties}
              selectedPropertyId={linkingPropertyId}
              form={linkForm}
              loading={linkPending}
              onPropertyChange={onPropertyChange}
              onFormChange={onFormChange}
              onSubmit={onSubmitLink}
              onCancel={onCancelLink}
              t={t}
            />
          )}
        </div>
      )}
    </Collapse>
  </Paper>
);

export default AirbnbListingsSection;

// ─── Sub-components ──────────────────────────────────────────────────────────

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
    <div className="border border-[var(--line)] rounded-[1px] p-2 flex items-center justify-between flex-wrap gap-1.5">
      <div className="min-w-0 flex-1">
        <p className="cn-text-body1 text-[0.8125rem] font-semibold flex items-center gap-0.5">
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
                <OpenInNewIcon size={'0.875rem'} strokeWidth={1.75} />
              </IconButton>
            </Tooltip>
          )}
        </p>
        <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground">
          ID: {listing.airbnbListingId} · Propriété #{listing.propertyId}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={listing.syncEnabled}
              onChange={(_, checked) => onToggleSync(listing.propertyId, checked)}
            />
          }
          label={<p className="cn-text-body1 text-[0.6875rem]">{t('channels.listings.sync')}</p>}
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
            <p className="cn-text-body1 text-[0.6875rem] flex items-center gap-0.5">
              <CleaningIcon size={'0.75rem'} strokeWidth={1.75} /> {t('channels.listings.autoClean')}
            </p>
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
            <p className="cn-text-body1 text-[0.6875rem] flex items-center gap-0.5">
              <PricingIcon size={'0.75rem'} strokeWidth={1.75} /> {t('channels.listings.autoPushPricing')}
            </p>
          }
        />
        <Tooltip title={t('channels.listings.unlink')}>
          <IconButton size="small" color="error" onClick={() => onUnlink(listing.propertyId)}>
            <LinkOffIcon size={'1rem'} strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
      </div>
    </div>
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
    <div className="flex flex-col gap-1.5">
      <p className="cn-text-body1 text-[0.75rem] font-semibold">
        {t('channels.listings.linkNewProperty')}
      </p>
      <div className="flex gap-1.5 flex-wrap items-end">
        <Box component="select"
          value={selectedPropertyId}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onPropertyChange(Number(e.target.value))}
          sx={{
            fontSize: '0.8125rem', px: 1, py: 0.75, borderRadius: '11px',
            border: '1px solid', borderColor: 'var(--field-line)', minWidth: 160, bgcolor: 'var(--field)',
            color: 'var(--body)',
            '&:focus': { outline: 'none', borderColor: 'var(--accent)' },
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
          sx={{ fontSize: '0.8125rem', px: 1, py: 0.75, borderRadius: '11px', border: '1px solid', borderColor: 'var(--field-line)', bgcolor: 'var(--field)', color: 'var(--body)', '&:focus': { outline: 'none', borderColor: 'var(--accent)' }, minWidth: 140 }}
        />
        <Box
          component="input"
          placeholder={t('channels.listings.listingTitle')}
          value={form.airbnbListingTitle}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFormChange({ ...form, airbnbListingTitle: e.target.value })}
          sx={{ fontSize: '0.8125rem', px: 1, py: 0.75, borderRadius: '11px', border: '1px solid', borderColor: 'var(--field-line)', bgcolor: 'var(--field)', color: 'var(--body)', '&:focus': { outline: 'none', borderColor: 'var(--accent)' }, minWidth: 180, flex: 1 }}
        />
        <Box
          component="input"
          placeholder="URL Airbnb"
          value={form.airbnbListingUrl}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFormChange({ ...form, airbnbListingUrl: e.target.value })}
          sx={{ fontSize: '0.8125rem', px: 1, py: 0.75, borderRadius: '11px', border: '1px solid', borderColor: 'var(--field-line)', bgcolor: 'var(--field)', color: 'var(--body)', '&:focus': { outline: 'none', borderColor: 'var(--accent)' }, minWidth: 200, flex: 1 }}
        />
        <Button
          size="small"
          variant="contained"
          onClick={onSubmit}
          disabled={loading || !form.airbnbListingId}
          sx={{ fontSize: '0.75rem' }}
        >
          {loading ? <Spinner className="size-3.5" /> : t('channels.listings.link')}
        </Button>
        <Button size="small" variant="outlined" onClick={onCancel} sx={{ fontSize: '0.75rem' }}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
