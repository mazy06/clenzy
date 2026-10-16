import { Button, Switch } from '../../components/ui';
import { Money } from '../../components/Money';
import { Edit } from '../../icons';
import { ArrowLeft, Eye } from '../../icons/glyphs';
import { useTranslation } from '../../hooks/useTranslation';
import type { UpsellOffer } from '../../services/api/upsellApi';
import UpsellFulfillmentPanel from './UpsellFulfillmentPanel';
import './baitlyPaidServiceDetail.css';

/** L'offre reste visible pendant que le gestionnaire compare les professionnels. */
export default function BaitlyPaidServiceDetail({ offer, image, category, property, performance,
  busy, onBack, onEdit, onPreview, onChannel }: {
  offer: UpsellOffer; image: string; category: string; property: string;
  performance: { count: number; revenue: number }; busy: boolean;
  onBack: () => void; onEdit: () => void; onPreview: () => void;
  onChannel: (channel: 'livret' | 'booking', enabled: boolean) => void;
}) {
  const { t } = useTranslation();
  return <div className="baitly-service-detail">
    <button type="button" className="baitly-service-detail__back" onClick={onBack}>
      <ArrowLeft size={16} />{t('upsells.detail.back', 'Services payants')}
    </button>
    <header className="baitly-service-detail__header">
      <div><p>{category} · {t('upsells.detail.internal', 'Service interne')}</p><h1>{offer.title}</h1></div>
      <div className="baitly-service-detail__actions">
        <Button variant="outline" onClick={onPreview}><Eye size={16} />{t('upsells.detail.preview', 'Aperçu')}</Button>
        <Button onClick={onEdit}><Edit size={16} />{t('upsells.detail.edit', 'Modifier')}</Button>
      </div>
    </header>
    <div className="baitly-service-detail__layout">
      <aside className="baitly-service-detail__overview" aria-label={t('upsells.detail.description', 'Description')}>
        <div className="baitly-service-detail__visual" data-photo={!!offer.imageUrl}>
          <img src={image} alt={category} />
          <span className="baitly-service-detail__status" data-active={offer.active}>
            {t(offer.active ? 'upsells.active' : 'upsells.inactive', offer.active ? 'Actif' : 'Inactif')}
          </span>
        </div>
        <div className="baitly-service-detail__summary">
          <p className="baitly-service-detail__description">{offer.description || t('upsells.detail.noDescription', 'Aucune description.')}</p>
          <div className="baitly-service-detail__price"><strong><Money value={offer.price} from={offer.currency} /></strong>
            <span>{t('upsells.detail.perReservationUnit', 'par réservation')}</span></div>
          <div className="baitly-service-detail__scope"><span>{t('upsells.detail.scope', 'Appliqué à')}</span><strong>{property}</strong></div>
          <details className="baitly-service-detail__settings">
          <summary>{t('upsellFulfillment.serviceSettings', 'Diffusion, conditions et résultats')}</summary>
          <section className="baitly-service-detail__channels">
            <h2>{t('upsells.detail.distribution', 'Distribution')}</h2>
            {(['livret', 'booking'] as const).map(channel => {
              const enabled = channel === 'livret' ? offer.diffuseOnLivret : offer.diffuseOnBooking;
              const label = t(channel === 'livret' ? 'upsells.detail.guideChannel' : 'upsells.detail.bookingChannel');
              return <div className="baitly-service-detail__channel" key={channel}><span>{label}</span>
                <Switch aria-label={label} checked={enabled} disabled={busy}
                  onCheckedChange={value => onChannel(channel, value)} /></div>;
            })}
          </section>
          <details className="baitly-service-detail__conditions">
            <summary>{t('upsells.detail.pricing', 'Tarification')} · {t('upsells.detail.details', 'Détails')}</summary>
            <dl>
              <div><dt>{t('upsells.fields.minNights', 'Séjour min.')}</dt><dd>{offer.minNights ? `${offer.minNights} ${t('upsells.detail.nights', 'nuits')}` : t('upsells.detail.none', 'Aucun')}</dd></div>
              <div><dt>{t('upsells.detail.leadTime', 'Délai de commande')}</dt><dd>{offer.leadTimeHours ? `${offer.leadTimeHours} h` : t('upsells.detail.none', 'Aucun')}</dd></div>
              <div><dt>{t('upsells.fields.currency', 'Devise')}</dt><dd>{offer.currency}</dd></div>
            </dl>
          </details>
          <section className="baitly-service-detail__performance">
            <h2>{t('upsells.detail.perf', 'Performance · 30 jours')}</h2>
            <dl><div><dt>{t('upsells.detail.bookings', 'Réservations')}</dt><dd>{performance.count}</dd></div>
              <div><dt>{t('upsells.detail.revenue', 'Revenu généré')}</dt><dd><Money value={performance.revenue} decimals={0} /></dd></div>
              <div><dt>{t('upsells.detail.aov', 'Panier moyen')}</dt><dd>{performance.count ? <Money value={performance.revenue / performance.count} decimals={0} /> : '–'}</dd></div></dl>
          </section>
          </details>
        </div>
      </aside>
      <UpsellFulfillmentPanel key={`${offer.id}:${offer.type}:${offer.propertyId}`} offer={offer} />
    </div>
  </div>;
}
