import React from 'react';
import { Spinner } from '../../components/ui';
import {
  Button,
  Collapsible,
  CollapsibleContent,
  Field,
  FieldLabel,
  Input,
  NativeSelect,
  NativeSelectOption,
  Separator,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
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

/** Gabarit de la carte de section : hairline sur surface de panneau. */
const CARD_CLS = 'border border-border bg-card rounded-xl p-3 mb-[9px]';

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
  <div className={CARD_CLS}>
    <div className="flex items-center justify-between cursor-pointer" onClick={onToggleExpand}>
      <p className="text-sm font-semibold tracking-tight">
        {t('channels.listings.title')} ({listings.length})
      </p>
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        aria-label={expanded
          ? t('common.collapse', { defaultValue: 'Réduire' })
          : t('common.expand', { defaultValue: 'Développer' })}
      >
        {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </Button>
    </div>

    <Collapsible open={expanded}>
      <CollapsibleContent>
      {listingsLoading ? (
        <div className="flex justify-center py-3">
          <Spinner className="size-6" />
        </div>
      ) : listings.length === 0 ? (
        <p className="text-xs text-muted-foreground mt-1.5">
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
        <div className="mt-3">
          <Separator className="mb-[9px]" />
          {linkingPropertyId === null ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onStartLink}
              className="text-[0.75rem]"
            >
              <LinkIcon />
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
      </CollapsibleContent>
    </Collapsible>
  </div>
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
    <div className="border border-border rounded-md p-2 flex items-center justify-between flex-wrap gap-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold flex items-center gap-0.5">
          {listing.airbnbListingTitle || `Listing ${listing.airbnbListingId}`}
          {listing.airbnbListingUrl && (
            <Tooltip>
              {/* Le declencheur est un <span> natif : les primitives du kit sont des
                  fonctions sans forwardRef, le tooltip n'aurait pas d'ancre (React 18). */}
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button variant="ghost" size="icon-xs" asChild aria-label={t('channels.listings.viewOnAirbnb')}>
                    <a
                      href={listing.airbnbListingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <OpenInNewIcon size={'0.875rem'} strokeWidth={1.75} />
                    </a>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{t('channels.listings.viewOnAirbnb')}</TooltipContent>
            </Tooltip>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          ID: {listing.airbnbListingId} · Propriété #{listing.propertyId}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Field orientation="horizontal" className="w-auto gap-1.5">
          <Switch
            size="sm"
            id={`airbnb-sync-${listing.propertyId}`}
            checked={listing.syncEnabled}
            onCheckedChange={(checked) => onToggleSync(listing.propertyId, checked)}
          />
          <FieldLabel htmlFor={`airbnb-sync-${listing.propertyId}`} className="text-[0.6875rem] font-normal">
            {t('channels.listings.sync')}
          </FieldLabel>
        </Field>
        <Field orientation="horizontal" className="w-auto gap-1.5">
          <Switch
            size="sm"
            id={`airbnb-autoclean-${listing.propertyId}`}
            checked={listing.autoCreateInterventions}
            onCheckedChange={(checked) => onToggleAutoInterventions(listing.propertyId, checked)}
          />
          <FieldLabel
            htmlFor={`airbnb-autoclean-${listing.propertyId}`}
            className="flex items-center gap-0.5 text-[0.6875rem] font-normal"
          >
            <CleaningIcon size={'0.75rem'} strokeWidth={1.75} /> {t('channels.listings.autoClean')}
          </FieldLabel>
        </Field>
        <Field orientation="horizontal" className="w-auto gap-1.5">
          <Switch
            size="sm"
            id={`airbnb-autopricing-${listing.propertyId}`}
            checked={listing.autoPushPricing ?? false}
            onCheckedChange={(checked) => onToggleAutoPushPricing(listing.propertyId, checked)}
          />
          <FieldLabel
            htmlFor={`airbnb-autopricing-${listing.propertyId}`}
            className="flex items-center gap-0.5 text-[0.6875rem] font-normal"
          >
            <PricingIcon size={'0.75rem'} strokeWidth={1.75} /> {t('channels.listings.autoPushPricing')}
          </FieldLabel>
        </Field>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                aria-label={t('channels.listings.unlink')}
                className="text-destructive hover:bg-destructive-soft hover:text-destructive"
                onClick={() => onUnlink(listing.propertyId)}
              >
                <LinkOffIcon size={'1rem'} strokeWidth={1.75} />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{t('channels.listings.unlink')}</TooltipContent>
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
      <p className="text-xs font-semibold">
        {t('channels.listings.linkNewProperty')}
      </p>
      <div className="flex gap-1.5 flex-wrap items-end">
        <NativeSelect
          size="sm"
          value={selectedPropertyId}
          onChange={(e) => onPropertyChange(Number(e.target.value))}
          className="min-w-[160px]"
        >
          {properties.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>{p.name}</NativeSelectOption>
          ))}
        </NativeSelect>
        <Input
          placeholder="Airbnb Listing ID"
          value={form.airbnbListingId}
          onChange={(e) => onFormChange({ ...form, airbnbListingId: e.target.value })}
          className="min-w-[140px] w-auto"
        />
        <Input
          placeholder={t('channels.listings.listingTitle')}
          value={form.airbnbListingTitle}
          onChange={(e) => onFormChange({ ...form, airbnbListingTitle: e.target.value })}
          className="min-w-[180px] w-auto flex-1"
        />
        <Input
          placeholder="URL Airbnb"
          value={form.airbnbListingUrl}
          onChange={(e) => onFormChange({ ...form, airbnbListingUrl: e.target.value })}
          className="min-w-[200px] w-auto flex-1"
        />
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={loading || !form.airbnbListingId}
          className="text-[0.75rem]"
        >
          {loading ? <Spinner className="size-3.5" /> : t('channels.listings.link')}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="text-[0.75rem]">
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
