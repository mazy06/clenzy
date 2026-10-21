import { useId, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, ExternalLink, Globe, Mail, MapPin, Phone, X } from '../../icons/glyphs';
import { useMediaQuery } from '../../hooks/use-media-query';
import { Button } from '../ui';
import { useTranslation } from '../../hooks/useTranslation';
import { fetchMapPlaceDetails, type MapPlace } from '../../services/mapPlaceDetailsApi';
import { MAP_PLACE_CATEGORIES } from './baitlyMapPlaceCategories';
import './baitlyMapPlace.css';

export default function BaitlyMapPlaceCard({ place, onClose }: { place: MapPlace; onClose: () => void }) {
  const { t } = useTranslation();
  const [failedPhoto, setFailedPhoto] = useState(false);
  const [activeTab, setActiveTab] = useState<'contact' | 'practical'>('contact');
  const small = useMediaQuery('(max-width: 767px)');
  const panelId = useId();
  const query = useQuery({
    queryKey: ['baitly-map-place', place.name, place.lat, place.lng],
    queryFn: ({ signal }) => fetchMapPlaceDetails(place, signal),
    staleTime: 24 * 60 * 60_000, gcTime: 60 * 60_000, retry: false, refetchOnWindowFocus: false,
  });
  const details = query.data;
  const category = MAP_PLACE_CATEGORIES.find(c => (c.kinds as readonly string[]).includes(place.kind));
  const missing = t('baitlyMap.place.missing', 'Non renseigné');
  return <section className="baitly-map-place" role="dialog" aria-label={place.name}>
    <header className="baitly-map-place__header">
      {details?.photo && !failedPhoto && <figure className="baitly-map-place__photo">
        <img src={details.photo.url} alt={place.name} onError={() => setFailedPhoto(true)} referrerPolicy="no-referrer" />
        <figcaption><a href={details.photo.sourceUrl} target="_blank" rel="noopener noreferrer">{t('baitlyMap.place.photoCredit', 'Photo Wikimedia Commons · crédit et licence')}</a></figcaption>
      </figure>}
      <div className="baitly-map-place__identity">
        <p>{category ? t(`baitlyMap.places.${category.id}`, category.label) : t('baitlyMap.place.title', 'Lieu utile')}</p>
        <h3>{place.name}</h3>
        {details?.address && <div className="baitly-map-place__address"><MapPin size={14} aria-hidden /><span>{details.address}</span></div>}
      </div>
      <Button size="icon-sm" variant="ghost" aria-label={t('common.close', 'Fermer')} onClick={onClose}><X size={18} aria-hidden /></Button>
    </header>
    <div className="baitly-map-place__body">
      {query.isPending ? <div role="status" aria-label={t('baitlyMap.place.loading', 'Chargement des informations…')} className="space-y-3 py-3">
        {[80, 100, 65].map(width => <div key={width} className="h-5 rounded bg-muted motion-safe:animate-pulse" style={{ width: `${width}%` }} />)}
      </div> : query.isError ? <div role="status" className="baitly-map-place__notice">
        <p>{t('baitlyMap.place.error', 'Les informations du lieu sont momentanément indisponibles.')}</p>
        <Button variant="outline" size="sm" onClick={() => query.refetch()}>{t('common.retry', 'Réessayer')}</Button>
      </div> : <>
        {!details && <p className="baitly-map-place__notice">{t('baitlyMap.place.noMatch', 'Aucune fiche détaillée correspondante n’a été trouvée pour ce lieu.')}</p>}
        {small && <div className="baitly-map-place__tabs" role="tablist" aria-label={t('baitlyMap.place.title', 'Lieu utile')}>
          {(['contact', 'practical'] as const).map(tab => <button type="button" key={tab} role="tab" id={`${panelId}-${tab}-tab`}
            aria-selected={activeTab === tab} aria-controls={`${panelId}-${tab}`} tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => setActiveTab(tab)} onKeyDown={event => {
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const next = event.key === 'Home' ? 'contact' : event.key === 'End' ? 'practical' : tab === 'contact' ? 'practical' : 'contact';
                setActiveTab(next);
                event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[id="${panelId}-${next}-tab"]`)?.focus();
              }
            }}>{tab === 'contact' ? t('baitlyMap.place.contactTab', 'Coordonnées') : t('baitlyMap.place.practicalTab', 'Horaires et détails')}</button>)}
        </div>}
        <div className="baitly-map-place__columns">
        <section hidden={small && activeTab !== 'contact'} id={`${panelId}-contact`} role={small ? 'tabpanel' : undefined} aria-labelledby={small ? `${panelId}-contact-tab` : undefined}>
          {!small && <h4>{t('baitlyMap.place.contactTab', 'Coordonnées')}</h4>}
          <dl className="baitly-map-place__fields">
          <Detail icon={<Phone size={16} />} label={t('baitlyMap.place.phone', 'Téléphone')}>
            {details?.phone ? <a href={`tel:${details.phone.split(';')[0].replace(/[^+\d]/g, '')}`}>{details.phone}</a> : missing}
          </Detail>
          <Detail icon={<Globe size={16} />} label={t('baitlyMap.place.website', 'Site internet')}>
            {details?.website ? <a href={details.website} target="_blank" rel="noopener noreferrer">{new URL(details.website).hostname}<ExternalLink size={12} aria-hidden /></a> : missing}
          </Detail>
          {details?.email && <Detail icon={<Mail size={16} />} label={t('baitlyMap.place.email', 'E-mail')}><a href={`mailto:${encodeURIComponent(details.email)}`}>{details.email}</a></Detail>}
          </dl>
        </section>
        <section hidden={small && activeTab !== 'practical'} id={`${panelId}-practical`} role={small ? 'tabpanel' : undefined} aria-labelledby={small ? `${panelId}-practical-tab` : undefined}>
          {!small && <h4>{t('baitlyMap.place.practicalTab', 'Horaires et détails')}</h4>}
          <dl className="baitly-map-place__fields">
          <Detail icon={<Clock size={16} />} label={t('baitlyMap.place.hours', 'Horaires d’ouverture')}>
            <span className="whitespace-pre-wrap">{details?.openingHours?.replace(/;\s*/g, ';\n') || missing}</span>
          </Detail>
          {details?.cuisine && <Detail label={t('baitlyMap.place.cuisine', 'Cuisine')}>{details.cuisine.replace(/;/g, ', ')}</Detail>}
          {details?.wheelchair && <Detail label={t('baitlyMap.place.accessibility', 'Accès fauteuil roulant')}>{t(`baitlyMap.place.wheelchair.${details.wheelchair}`, ({ yes: 'Accessible', no: 'Non accessible', limited: 'Accès limité' } as Record<string, string>)[details.wheelchair] ?? details.wheelchair)}</Detail>}
          </dl>
        </section>
        </div>
      </>}
    </div>
  </section>;
}

function Detail({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return <div><dt><span aria-hidden>{icon}</span>{label}</dt><dd>{children}</dd></div>;
}
