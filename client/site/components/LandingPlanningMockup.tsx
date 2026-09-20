import { CalendarCheckIcon, CheckIcon, CircleIcon } from 'lucide-react';

const DAYS = ['Lun 14', 'Mar 15', 'Mer 16', 'Jeu 17', 'Ven 18'];
const PLANNING_LABEL =
  'Aperçu animé du planning Baitly avec trois logements et des réservations synchronisées';

const ROWS = [
  {
    name: 'Riad Azur',
    detail: 'Riyad · Al-Olaya',
    guest: 'Sophie L.',
    channel: 'Airbnb',
    tone: 'coral',
    range: '2 / span 3',
  },
  {
    name: 'Villa des Oliviers',
    detail: 'Essaouira · Centre',
    guest: 'Thomas M.',
    channel: 'Booking',
    tone: 'blue',
    range: '3 / span 3',
  },
  {
    name: 'Appartement Atlas',
    detail: 'Djeddah · Al-Hamra',
    guest: 'Lina B.',
    channel: 'En direct',
    tone: 'green',
    range: '2 / span 2',
  },
] as const;

export default function LandingPlanningMockup() {
  return (
    <div className="landing-planning" role="img" aria-label={PLANNING_LABEL}>
      <div className="landing-planning-topbar">
        <div className="landing-planning-heading">
          <span className="landing-planning-kicker">
            <CalendarCheckIcon /> Planning partagé
          </span>
          <strong>Votre planning</strong>
        </div>
        <span className="landing-planning-month">Septembre 2026</span>
      </div>

      <div className="landing-planning-board">
        <div className="landing-planning-row landing-planning-head">
          <span>Logements</span>
          <div className="landing-planning-days">
            {DAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
        </div>

        {ROWS.map((row, index) => (
          <div className="landing-planning-row" key={row.name}>
            <div className="landing-planning-property">
              <strong>{row.name}</strong>
              <span>{row.detail}</span>
            </div>
            <div className="landing-planning-days landing-planning-stays">
              {DAYS.map((day) => (
                <span key={day} aria-hidden="true" />
              ))}
              <div
                className={`landing-planning-stay landing-planning-stay-${
                  row.tone
                }`}
                style={{ gridColumn: row.range }}
              >
                <span
                  className="landing-planning-stay-dot"
                  aria-hidden="true"
                />
                <span className="landing-planning-stay-copy">
                  <strong>{row.guest}</strong>
                  <small>{row.channel}</small>
                </span>
                {index === 0 && (
                  <span
                    className="landing-planning-stay-pulse"
                    aria-hidden="true"
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="landing-planning-footer">
        <span className="landing-planning-sync">
          <CheckIcon /> Disponibilités synchronisées
        </span>
        <span className="landing-planning-channels">
          <CircleIcon /> Airbnb <CircleIcon /> Booking <CircleIcon /> Direct
        </span>
      </div>
    </div>
  );
}
