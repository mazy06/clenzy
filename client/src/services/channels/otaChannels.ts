/**
 * Catalogue des OTAs / canaux de reservation supportes par Baitly.
 *
 * <p>Source de verite partagee entre ChannelsPage (gestion des connexions) et
 * IntegrationsSection (vitrine visuelle dans l'onglet Integrations). Importer
 * d'ici plutot que dupliquer evite la divergence d'information.</p>
 */
import airbnbLogo from '../../assets/logo/airbnb-logo-small.svg';
import bookingLogo from '../../assets/logo/booking-logo-small.svg';
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

export type ChannelSegment = 'B2C' | 'B2B';

export interface OtaChannel {
  id: string;
  name: string;
  brandColor: string;
  brandGradient: string;
  logo: string | null;
  available: boolean;
  descriptionKey: string;
  segment: ChannelSegment;
}

export const OTA_CHANNELS: OtaChannel[] = [
  {
    id: 'airbnb',
    name: 'Airbnb',
    brandColor: '#FF5A5F',
    brandGradient: 'linear-gradient(135deg, #FF5A5F 0%, #FF8A8D 100%)',
    logo: airbnbLogo,
    available: true,
    descriptionKey: 'channels.airbnb.connectDescription',
    segment: 'B2C',
  },
  {
    id: 'booking',
    name: 'Booking.com',
    brandColor: '#003580',
    brandGradient: 'linear-gradient(135deg, #003580 0%, #0050B5 100%)',
    logo: bookingLogo,
    available: true,
    descriptionKey: 'channels.ota.booking.description',
    segment: 'B2C',
  },
  {
    id: 'expedia',
    name: 'Expedia',
    brandColor: '#00355F',
    brandGradient: 'linear-gradient(135deg, #00355F 0%, #1A6199 100%)',
    logo: expediaLogo,
    available: true,
    descriptionKey: 'channels.ota.expedia.description',
    segment: 'B2C',
  },
  {
    id: 'hotels',
    name: 'Hotels.com',
    brandColor: '#191E3B',
    brandGradient: 'linear-gradient(135deg, #191E3B 0%, #3A4070 100%)',
    logo: hotelsComLogo,
    available: true,
    descriptionKey: 'channels.ota.hotels.description',
    segment: 'B2C',
  },
  {
    id: 'agoda',
    name: 'Agoda',
    brandColor: '#2067DA',
    brandGradient: 'linear-gradient(135deg, #2067DA 0%, #4D8AE8 100%)',
    logo: agodaLogo,
    available: true,
    descriptionKey: 'channels.ota.agoda.description',
    segment: 'B2C',
  },
  {
    id: 'tripcom',
    name: 'Trip.com',
    brandColor: '#3264FF',
    brandGradient: 'linear-gradient(135deg, #3264FF 0%, #6590FF 100%)',
    logo: null,
    available: true,
    descriptionKey: 'channels.ota.tripcom.description',
    segment: 'B2C',
  },
  {
    id: 'vrbo',
    name: 'Vrbo',
    brandColor: '#1A2B49',
    brandGradient: 'linear-gradient(135deg, #1A2B49 0%, #3A5070 100%)',
    logo: vrboLogo,
    available: true,
    descriptionKey: 'channels.ota.vrbo.description',
    segment: 'B2C',
  },
  {
    id: 'abritel',
    name: 'Abritel',
    brandColor: '#1668E3',
    brandGradient: 'linear-gradient(135deg, #1668E3 0%, #4A8EF0 100%)',
    logo: abritelLogo,
    available: true,
    descriptionKey: 'channels.ota.abritel.description',
    segment: 'B2C',
  },
  {
    id: 'hometogo',
    name: 'HomeToGo',
    brandColor: '#4D21B7',
    brandGradient: 'linear-gradient(135deg, #4D21B7 28.84%, #FF8080 102.45%)',
    logo: hometogoLogo,
    available: true,
    descriptionKey: 'channels.ota.hometogo.description',
    segment: 'B2C',
  },
  {
    id: 'gathern',
    name: 'Gathern',
    brandColor: '#4F2396',
    brandGradient: 'linear-gradient(135deg, #4F2396 0%, #7A4FC4 100%)',
    logo: gathernLogo,
    available: true,
    descriptionKey: 'channels.ota.gathern.description',
    segment: 'B2B',
  },
  {
    id: 'rentelly',
    name: 'Rentelly',
    brandColor: '#118B7D',
    brandGradient: 'linear-gradient(135deg, #118B7D 0%, #3AAF9F 100%)',
    logo: rentellyLogo,
    available: true,
    descriptionKey: 'channels.ota.rentelly.description',
    segment: 'B2B',
  },
  {
    id: 'kease',
    name: 'Kease',
    brandColor: '#1A1A1A',
    brandGradient: 'linear-gradient(135deg, #1A1A1A 0%, #444444 100%)',
    logo: keaseLogo,
    available: true,
    descriptionKey: 'channels.ota.kease.description',
    segment: 'B2B',
  },
  {
    id: 'stay',
    name: 'Stay.sa',
    brandColor: '#2D5F8A',
    brandGradient: 'linear-gradient(135deg, #2D5F8A 0%, #4A8ABF 100%)',
    logo: null,
    available: true,
    descriptionKey: 'channels.ota.stay.description',
    segment: 'B2B',
  },
  {
    id: 'mabeet',
    name: 'Mabeet',
    brandColor: '#099EAC',
    brandGradient: 'linear-gradient(135deg, #099EAC 0%, #3BBAC6 100%)',
    logo: mabeetLogo,
    available: true,
    descriptionKey: 'channels.ota.mabeet.description',
    segment: 'B2B',
  },
  // ─── OTAs MENA (Seera Group + Wego) ─────────────────────────────────
  // Differenciants pour le marche saoudien. Aucun PMS occidental ne les
  // integre nativement. Necessite des contrats partenaires pour activer.
  {
    id: 'almosafer',
    name: 'Almosafer',
    brandColor: '#7B2CBF',
    brandGradient: 'linear-gradient(135deg, #7B2CBF 0%, #A06CD5 100%)',
    logo: null,
    available: false,
    descriptionKey: 'channels.ota.almosafer.description',
    segment: 'B2C',
  },
  {
    id: 'tajawal',
    name: 'Tajawal',
    brandColor: '#F26522',
    brandGradient: 'linear-gradient(135deg, #F26522 0%, #FF8E53 100%)',
    logo: null,
    available: false,
    descriptionKey: 'channels.ota.tajawal.description',
    segment: 'B2C',
  },
  {
    id: 'wego',
    name: 'Wego',
    brandColor: '#0D7AAA',
    brandGradient: 'linear-gradient(135deg, #0D7AAA 0%, #2A9FD8 100%)',
    logo: null,
    available: false,
    descriptionKey: 'channels.ota.wego.description',
    segment: 'B2C',
  },
];
