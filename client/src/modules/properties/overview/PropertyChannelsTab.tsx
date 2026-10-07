import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link2 } from 'lucide-react';
import { Button } from '../../../components/ui';
import StatusChip from '../../../components/StatusChip';
import IllustratedHeading from '../../../components/IllustratedHeading';
import { useTranslation } from '../../../hooks/useTranslation';
import { airbnbApi } from '../../../services/api/airbnbApi';
import { activeIntlLocale } from '../../../utils/activeLocale';
import { PROPERTY_ART } from '../propertyArtwork';
import airbnbLogo from '../../../assets/logo/airbnb-logo-small.svg';
import bookingLogo from '../../../assets/logo/booking-logo-small.svg';
import hotelsComLogo from '../../../assets/logo/hotels-com-logo-small.svg';
import agodaLogo from '../../../assets/logo/agoda-logo-small.svg';
import vrboLogo from '../../../assets/logo/vrbo-logo-small.svg';
import abritelLogo from '../../../assets/logo/abritel-logo-small.svg';
import expediaLogo from '../../../assets/logo/expedia-logo.png';
import './propertyOverview.css';

type AirbnbStatus = { linked: boolean; syncEnabled: boolean; lastSyncAt: string | null; status: string };

// Seul Airbnb remonte un état par logement ; les autres canaux se raccordent
// depuis l'écran Distribution.
const OTHER_CHANNELS = [
  { name: 'Booking.com', logo: bookingLogo },
  { name: 'Expedia', logo: expediaLogo },
  { name: 'Hotels.com', logo: hotelsComLogo },
  { name: 'Agoda', logo: agodaLogo },
  { name: 'Vrbo', logo: vrboLogo },
  { name: 'Abritel', logo: abritelLogo },
];

/** Où le logement est diffusé : une ligne par canal, son état et l'action pour le raccorder. */
export default function PropertyChannelsTab({ propertyId }: { propertyId: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [airbnb, setAirbnb] = useState<AirbnbStatus | null>(null);

  useEffect(() => {
    let active = true;
    airbnbApi.getPropertyChannelStatus(propertyId)
      .then((status) => { if (active) setAirbnb(status?.airbnb ?? null); })
      .catch(() => { /* Pas encore de donnée de canal pour ce logement. */ });
    return () => { active = false; };
  }, [propertyId]);

  const linkButton = (
    <Button size="sm" variant="outline" onClick={() => navigate('/channels')}>
      <Link2 size={14} />
      {t('channels.listings.linkProperty')}
    </Button>
  );
  const airbnbDetail = airbnb?.linked
    ? [
        airbnb.syncEnabled ? t('channels.syncStatus.syncOn') : t('channels.syncStatus.syncOff'),
        airbnb.lastSyncAt ? `${t('channels.syncStatus.lastSync')} : ${new Date(airbnb.lastSyncAt).toLocaleString(activeIntlLocale())}` : '',
      ].filter(Boolean).join(' · ')
    : '';

  return (
    <div className="pdo">
      <div className="pdo-column">
        <section className="pdo-section">
          <IllustratedHeading
            art={PROPERTY_ART.channels}
            title={t('propertyWorkspace.channels.title')}
            hint={t('propertyWorkspace.channels.hint')}
          />
          <ul className="pdo-channels">
            <li>
              <img src={airbnbLogo} alt="" width={28} height={28} />
              <div>
                <strong>Airbnb</strong>
                {airbnbDetail && <span>{airbnbDetail}</span>}
              </div>
              <StatusChip tone={airbnb?.linked ? 'ok' : 'neutral'} label={airbnb?.linked ? t('channels.connected') : t('channels.notConnected')} />
              {!airbnb?.linked && linkButton}
            </li>
            {OTHER_CHANNELS.map((channel) => (
              <li key={channel.name}>
                <img src={channel.logo} alt="" width={28} height={28} />
                <div><strong>{channel.name}</strong></div>
                <StatusChip tone="neutral" label={t('channels.notConnected')} />
                {linkButton}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
