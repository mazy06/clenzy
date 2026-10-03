import { useState } from 'react';
import {
  ArrowRightIcon,
  Building2Icon,
  CalendarDaysIcon,
  CheckIcon,
  FileSpreadsheetIcon,
  FolderInputIcon,
  Link2Icon,
  PlugIcon,
  UsersIcon,
} from 'lucide-react';
import BaitlyMarkLogo from '../../src/components/BaitlyMarkLogo';
import type { BaitlyMigrationMessages } from '../lib/messages/baitlyMigration';
import airbnb from '../assets/brands/airbnb.svg';
import booking from '../assets/brands/bookingdotcom.svg';
import { SITE_PHOTOS } from '../data/baitlyPhotography';
import { BaitlyPmsPortability } from './BaitlyPmsPortability';
import type { SiteLanguage } from '../lib/siteLanguage';

const { migrationProperty: riad } = SITE_PHOTOS;

type Props = { m: BaitlyMigrationMessages };
const RECORD_ICONS = [Building2Icon, CalendarDaysIcon, UsersIcon];
const SOURCE_ICONS = [
  Link2Icon,
  FolderInputIcon,
  FileSpreadsheetIcon,
  PlugIcon,
];

export function MigrationChannelMarks() {
  return (
    <span className="bm-channel-marks" aria-label="Airbnb, Booking.com">
      <img src={airbnb} alt="Airbnb" width="28" height="28" />
      <img src={booking} alt="Booking.com" width="28" height="28" />
    </span>
  );
}

export function BaitlyMigrationVisual({ m }: Props) {
  return (
    <figure className="bm-transfer">
      <div className="bm-transfer-labels" aria-hidden="true">
        <span>{m.visual.before}</span>
        <span>{m.visual.after}</span>
      </div>
      <div className="bm-transfer-scene">
        <div className="bm-source-stack">
          <div className="bm-source-tile">
            <img src={airbnb} alt="" width="32" height="32" />
            <span>Airbnb</span>
          </div>
          <div className="bm-source-tile">
            <img src={booking} alt="" width="32" height="32" />
            <span>Booking.com</span>
          </div>
          <div className="bm-source-tile">
            <FileSpreadsheetIcon aria-hidden="true" />
            <span>{m.visual.spreadsheet}</span>
          </div>
        </div>
        <div className="bm-transfer-link" aria-hidden="true">
          <span />
          <ArrowRightIcon />
        </div>
        <div className="bm-workspace">
          <div className="bm-workspace-bar">
            <BaitlyMarkLogo size={25} disableAnimation colorMode="inherit" />
            <span>
              <CheckIcon aria-hidden="true" />
              {m.visual.ready}
            </span>
          </div>
          <div className="bm-workspace-property">
            <img src={riad} alt="" width="68" height="76" />
            <div>
              <strong>{m.visual.property}</strong>
              <span>{m.visual.location}</span>
            </div>
          </div>
          <ul className="bm-records">
            {m.visual.items.map((item, index) => {
              const Icon = RECORD_ICONS[index];
              return (
                <li key={item}>
                  <Icon aria-hidden="true" />
                  <span>{item}</span>
                  <CheckIcon aria-hidden="true" />
                </li>
              );
            })}
          </ul>
          <div className="bm-import-track" aria-hidden="true">
            <span />
          </div>
        </div>
      </div>
      <figcaption>
        <span className="bm-example-dot" />
        {m.visual.example}
      </figcaption>
    </figure>
  );
}

export function BaitlyMigrationSources({
  m,
  language,
}: Props & { language: SiteLanguage }) {
  // Choix d'exploration temporaire, sans préférence de compte à sauvegarder.
  const [source, setSource] = useState(0);
  const selected = m.channels[source];
  return (
    <section
      className="bm-sources site-shell"
      id="migration-sources"
      aria-labelledby="migration-sources-title"
    >
      <div className="bm-section-heading">
        <h2 id="migration-sources-title">{m.channelsTitle}</h2>
        <p>{m.channelsIntro}</p>
      </div>
      <div
        className="bm-source-options"
        role="group"
        aria-label={m.sourceLabel}
      >
        {m.channels.map((channel, index) => {
          const Icon = SOURCE_ICONS[index];
          return (
            <button
              key={channel.name}
              id={`migration-source-${index}`}
              type="button"
              aria-label={channel.name}
              aria-pressed={source === index}
              aria-controls="migration-source-detail"
              onClick={() => setSource(index)}
            >
              {index === 0 ? (
                <MigrationChannelMarks />
              ) : (
                <Icon aria-hidden="true" />
              )}
              <span>{channel.name}</span>
              <ArrowRightIcon className="bm-direction" aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <div
        id="migration-source-detail"
        className={`bm-source-detail${source === 1 ? ' bm-source-detail-pms' : ''}`}
        role="region"
        aria-labelledby={`migration-source-${source}`}
      >
        {source === 1 ? (
          <BaitlyPmsPortability language={language} />
        ) : (
          <>
            <div key={source} className="bm-source-copy">
              <span className="bm-label">{selected.tag}</span>
              <h3>{selected.title}</h3>
              <p>{selected.copy}</p>
              <ul>
                {selected.points.map((point) => (
                  <li key={point}>
                    <CheckIcon aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bm-mapping">
              <div className="bm-file-heading">
                <FileSpreadsheetIcon aria-hidden="true" />
                <span dir="ltr">{selected.file}</span>
                <span>{selected.format}</span>
              </div>
              <p className="bm-mapping-caption">{m.preview}</p>
              <table>
                <thead>
                  <tr>
                    <th scope="col">{m.original}</th>
                    <th scope="col">{m.destination}</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.columns.map((column, index) => (
                    <tr key={index}>
                      <td>
                        <bdi>{column}</bdi>
                        <ArrowRightIcon aria-hidden="true" />
                      </td>
                      <td>
                        <CheckIcon aria-hidden="true" />
                        {m.fields[index]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bm-mapped">
                <Link2Icon aria-hidden="true" />
                {m.mapped}
              </div>
            </div>
          </>
        )}
      </div>
      <p className="bm-source-note">{m.sourceNote}</p>
    </section>
  );
}
