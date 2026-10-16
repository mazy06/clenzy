import type { ReactNode } from 'react';
import { Card } from '../../components/ui';
import StatusChip from '../../components/baitly/StatusChip';
import { LocationOn, Language, Star } from '../../icons';
import ProviderMedia from './ProviderMedia';
import { providerSectorImage } from './providerSectorImages';
import { useMarketplacePresentation } from './useMarketplacePresentation';
import type { ProviderOfferDto } from '../../services/api/marketplaceProvidersApi';
import './baitlyProviderProfile.css';

export function BaitlyProfileSection({ title, aside, children, className = '' }: {
  title: string; aside?: ReactNode; children: ReactNode; className?: string;
}) {
  return <Card className={`baitly-profile-section ${className}`}>
    <header><h2>{title}</h2>{aside}</header><div className="baitly-profile-section__body">{children}</div>
  </Card>;
}

export function BaitlyProviderIdentity({ name, headline, bio, url, categoryCodes, badges, location, languages = [],
  rating, ratingCount = 0, completedMissions, children }: {
  name: string; headline?: string; bio?: string; url?: string; categoryCodes: string[]; badges?: ReactNode;
  location?: string; languages?: string[]; rating?: number | null; ratingCount?: number; completedMissions?: number;
  children?: ReactNode;
}) {
  const { t, languageName } = useMarketplacePresentation();
  return <Card className="baitly-profile-identity">
    <ProviderMedia name={name} url={url} categoryCodes={categoryCodes} />
    <div className="baitly-profile-identity__content">
      <div className="baitly-profile-identity__badges">{badges}</div>
      <h2>{name}</h2>{headline && <p className="baitly-profile-identity__headline">{headline}</p>}
      <div className="baitly-profile-identity__facts">
        {location && <span><LocationOn size={16} />{location}</span>}
        {languages.length > 0 && <span><Language size={16} />{languages.map(languageName).join(' · ')}</span>}
        <span>{rating != null ? <><Star size={16} /><b>{rating.toFixed(1)}</b> {t('marketplaceAdmin.reviews', { count: ratingCount })}</> : t('marketplaceAdmin.unrated')}</span>
        {!!completedMissions && <span><b>{completedMissions}</b> {t('marketplaceAdmin.completed')}</span>}
      </div>
      {bio && <p className="baitly-profile-identity__bio">{bio}</p>}
      {children && <div className="baitly-profile-identity__contacts">{children}</div>}
    </div>
  </Card>;
}

/** Une seule présentation des prestations dans la gestion et le catalogue. */
export function BaitlyProviderOffers({ offers }: { offers: ProviderOfferDto[] }) {
  const { t, catalogLabel, formatOfferPrice, RECURRENCE_LABELS, PAYER_LABELS } = useMarketplacePresentation();
  const groups = new Map<string, ProviderOfferDto[]>();
  offers.forEach(offer => groups.set(offer.categoryCode, [...(groups.get(offer.categoryCode) ?? []), offer]));
  if (!offers.length) return <p className="text-sm text-muted-foreground">{t('marketplaceAdmin.noServices')}</p>;
  return <div className="baitly-profile-offers">
    {[...groups].map(([code, services]) => <section key={code} className="baitly-profile-offers__group">
      <header><h3>{catalogLabel({ labelFr: services[0].categoryLabelFr, labelEn: services[0].categoryLabelEn })}</h3></header>
      <ul>{services.map(offer => <li key={offer.id} data-active={offer.active}>
        <img className="baitly-profile-offers__image" src={providerSectorImage([offer.categoryCode])} alt="" decoding="async" />
        <div><h4>{offer.label}</h4>{offer.description && <p>{offer.description}</p>}
          <div className="baitly-profile-offers__conditions">
            {!offer.active && <StatusChip size="sm" tone="neutral" label={t('providerProfile.inactive')} />}
            {offer.recurrence && <StatusChip size="sm" tone="neutral" label={RECURRENCE_LABELS[offer.recurrence]} />}
            {offer.payer && <StatusChip size="sm" tone="neutral" label={t('marketplaceAdmin.paidBy', { payer: PAYER_LABELS[offer.payer] })} />}
            {offer.regulated && <StatusChip size="sm" tone="warn" label={t('marketplaceAdmin.regulated')} />}
            {offer.minDurationMinutes != null && <span>{t('marketplaceAdmin.minimumDuration', { count: offer.minDurationMinutes })}</span>}
          </div>
        </div>
        <strong>{formatOfferPrice(offer.amount,offer.currency,offer.pricingModel,offer.unitLabel)}</strong>
      </li>)}</ul>
    </section>)}
  </div>;
}
