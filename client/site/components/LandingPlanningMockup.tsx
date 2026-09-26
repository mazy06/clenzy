import {
  CalendarCheckIcon,
  CheckIcon,
  CircleIcon,
  CreditCardIcon,
  GlobeIcon,
} from 'lucide-react';
import { useSiteLanguage } from '../lib/siteLanguage';
import { BAITLY_PLANNING_STATUS } from '../data/baitlyPlanningAppearance';
import { MOCKUP_MESSAGES } from '../lib/messages/mockups';
import stayApartment from '../assets/photos/bedroom.jpg';
import stayVilla from '../assets/photos/pool.jpg';
import stayHouse from '../assets/photos/guesthouse.jpg';
import guest1 from '../assets/guests/g1.jpg';
import guest2 from '../assets/guests/g3.jpg';
import guest3 from '../assets/guests/g5.jpg';
import airbnbLogo from '../assets/brands/airbnb.svg';
import bookingLogo from '../assets/brands/bookingdotcom.svg';

/**
 * Apercu du planning, dans le visuel d'accueil.
 *
 * <p>La brique reprend la composition de `PlanningBar` : un avatar rond de
 * 26 px, deux lignes — le nombre de nuits puis le nom du voyageur —, puis une
 * pilule de PRIX dont l'icone dit l'etat du reglement, et le logo du canal.
 * Le STATUT du sejour n'est pas ecrit : il est porte par la teinte, comme sur
 * l'ecran. Les trois etats montres sont un depart, une arrivee et une
 * reservation confirmee.</p>
 */

/** Vignette du logement et avatar du voyageur, dans l'ordre du dictionnaire. */
const ROW_MEDIA = [
  { stay: stayApartment, guest: guest1 },
  { stay: stayVilla, guest: guest2 },
  { stay: stayHouse, guest: guest3 },
];

/**
 * Teintes de statut actuelles : taupe au départ, brun au check-in,
 * terre cuite pour une réservation confirmée. `paid`
 * decide de l'icone de la pilule de prix — carte bancaire ou coche.
 */
const STAYS = [
  {
    ...BAITLY_PLANNING_STATUS.checked_out,
    range: '2 / span 3',
    nights: 3,
    paid: true,
    channel: airbnbLogo,
  },
  {
    ...BAITLY_PLANNING_STATUS.checked_in,
    range: '3 / span 3',
    nights: 3,
    paid: false,
    channel: bookingLogo,
  },
  {
    ...BAITLY_PLANNING_STATUS.confirmed,
    range: '2 / span 2',
    nights: 2,
    paid: true,
    channel: null,
  },
] as const;

export default function LandingPlanningMockup() {
  const { language } = useSiteLanguage();
  const m = MOCKUP_MESSAGES[language].planning;
  return (
    <div className="landing-planning" role="img" aria-label={m.label}>
      <div className="landing-planning-topbar">
        <div className="landing-planning-heading">
          <span className="landing-planning-kicker">
            <CalendarCheckIcon /> {m.kicker}
          </span>
          <strong>{m.title}</strong>
        </div>
        <span className="landing-planning-month">{m.month}</span>
      </div>

      <div className="landing-planning-board">
        <div className="landing-planning-row landing-planning-head">
          <span>{m.propertiesColumn}</span>
          <div className="landing-planning-days">
            {m.days.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
        </div>

        {m.rows.map((row, index) => {
          const stay = STAYS[index];
          return (
            <div className="landing-planning-row" key={row.name}>
              <div className="landing-planning-property">
                {/* La colonne de gauche de l'ecran porte la vignette du
                    logement : un nom seul ne se reconnait pas d'un coup d'oeil. */}
                <img
                  className="landing-planning-thumb"
                  src={ROW_MEDIA[index].stay}
                  alt=""
                  width="34"
                  height="34"
                  loading="lazy"
                />
                <span className="landing-planning-property-text">
                  <strong>{row.name}</strong>
                  <span>{row.detail}</span>
                </span>
              </div>
              <div className="landing-planning-days landing-planning-stays">
                {m.days.map((day) => (
                  <span key={day} aria-hidden="true" />
                ))}
                <div
                  className="landing-planning-stay"
                  style={{
                    gridColumn: stay.range,
                    background: stay.background,
                    borderColor: stay.background,
                    color: stay.foreground,
                  }}
                >
                  <img
                    className="landing-planning-stay-avatar"
                    src={ROW_MEDIA[index].guest}
                    alt=""
                    width="26"
                    height="26"
                    loading="lazy"
                  />
                  <span className="landing-planning-stay-copy">
                    <small>{m.nights(stay.nights)}</small>
                    <strong>{row.guest}</strong>
                  </span>
                  {/* Pilule de prix : l'icone dit l'etat du reglement — une
                      carte tant que le sejour n'est pas paye, une coche une
                      fois encaisse. */}
                  <span
                    className="landing-planning-stay-price"
                    data-unpaid={stay.paid ? undefined : ''}
                    style={
                      stay.paid
                        ? {
                            background:
                              stay.foreground === '#2B211A'
                                ? 'rgba(252,250,247,.4)'
                                : 'rgba(38,24,12,.2)',
                            color: stay.foreground,
                          }
                        : undefined
                    }
                  >
                    {stay.paid ? <CheckIcon /> : <CreditCardIcon />}
                    {row.price}
                  </span>
                  <span className="landing-planning-stay-channel">
                    {stay.channel ? (
                      <img src={stay.channel} alt="" width="14" height="14" />
                    ) : (
                      <GlobeIcon />
                    )}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="landing-planning-footer">
        <span className="landing-planning-sync">
          <CheckIcon /> {m.sync}
        </span>
        <span className="landing-planning-channels">
          <CircleIcon /> Airbnb <CircleIcon /> Booking <CircleIcon /> {m.direct}
        </span>
      </div>
    </div>
  );
}
