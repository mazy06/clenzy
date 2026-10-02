import {
  ArrowDownIcon,
  ArrowRightIcon,
  CalendarCheckIcon,
  CheckIcon,
  DownloadIcon,
  FileCheck2Icon,
  FolderOpenIcon,
  HeadphonesIcon,
  Link2Icon,
  MessageSquareIcon,
  MoveRightIcon,
  StarIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SiteAcquisitionLink from '../components/SiteAcquisitionLink';
import Reveal from '../components/Reveal';
import {
  BaitlyMigrationSources,
  BaitlyMigrationVisual,
  MigrationChannelMarks,
} from '../components/BaitlyMigrationVisuals';
import { useSiteLanguage } from '../lib/siteLanguage';
import { BAITLY_MIGRATION_MESSAGES } from '../lib/messages/baitlyMigration';
import { downloadText } from '../lib/downloadText';
import { SITE_PHOTOS, sitePhotoAlt } from '../data/baitlyPhotography';

const { migrationProperty: riad } = SITE_PHOTOS;

const STEP_ICONS = [
  FolderOpenIcon,
  FileCheck2Icon,
  Link2Icon,
  CalendarCheckIcon,
];

export default function MigrationPage() {
  const { language } = useSiteLanguage();
  const m = BAITLY_MIGRATION_MESSAGES[language];
  return (
    <div className="bm-page">
      <section className="bm-hero">
        <div className="site-shell bm-hero-layout">
          <div className="bm-hero-copy">
            <p className="bm-eyebrow">
              <MoveRightIcon aria-hidden="true" />
              {m.eyebrow}
            </p>
            <h1>
              {m.title}
              <span>{m.titleAccent}</span>
            </h1>
            <p className="bm-intro">{m.intro}</p>
            <div className="bm-actions">
              <SiteAcquisitionLink
                to={`/demo?lang=${language}`}
                className="bm-button"
              >
                {m.cta}
                <ArrowRightIcon aria-hidden="true" />
              </SiteAcquisitionLink>
              <a href="#migration-sources" className="bm-text-link">
                {m.explore}
                <ArrowDownIcon aria-hidden="true" />
              </a>
            </div>
          </div>
          <BaitlyMigrationVisual m={m} />
          <ul className="bm-trust">
            {m.trust.map((item) => (
              <li key={item}>
                <CheckIcon aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <BaitlyMigrationSources m={m} />

      <section className="bm-journey" aria-labelledby="migration-journey-title">
        <div className="site-shell">
          <Reveal className="bm-section-heading">
            <h2 id="migration-journey-title">{m.stepsTitle}</h2>
            <p>{m.stepsIntro}</p>
          </Reveal>
          <ol className="bm-steps">
            {m.steps.map((step, index) => {
              const Icon = STEP_ICONS[index];
              return (
                <Reveal
                  as="li"
                  key={step.title}
                  delay={(index + 1) as 1 | 2 | 3 | 4}
                >
                  <div className="bm-step-line">
                    <span>0{index + 1}</span>
                    <Icon aria-hidden="true" />
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                  <span className="bm-step-tag">{step.tag}</span>
                </Reveal>
              );
            })}
          </ol>
        </div>
      </section>

      <section
        className="bm-data site-shell"
        aria-labelledby="migration-data-title"
      >
        <Reveal className="bm-section-heading">
          <h2 id="migration-data-title">{m.dataTitle}</h2>
          <p>{m.dataIntro}</p>
        </Reveal>
        <div className="bm-data-layout">
          <Reveal className="bm-property-story">
            <img
              src={riad}
              alt={sitePhotoAlt('migrationProperty', language)}
              width="960"
              height="720"
              loading="lazy"
            />
            <div className="bm-property-caption">
              <span>{m.visual.property}</span>
              <span>{m.visual.example}</span>
            </div>
            <div className="bm-data-copy">
              <span className="bm-status">
                <CheckIcon aria-hidden="true" />
                {m.data[0].status}
              </span>
              <h3>{m.data[0].title}</h3>
              <p>{m.data[0].copy}</p>
            </div>
          </Reveal>
          <Reveal className="bm-history-story" delay={1}>
            <div className="bm-stay-illustration" aria-hidden="true">
              <div className="bm-guest-portraits">
                {['AL', 'NK', 'SM'].map((initials) => (
                  <span key={initials}>{initials}</span>
                ))}
              </div>
              <div className="bm-stay-path">
                <span />
                <span />
                <span />
                <CheckIcon />
              </div>
              <CalendarCheckIcon />
            </div>
            <div className="bm-data-copy">
              <span className="bm-status">
                <CheckIcon aria-hidden="true" />
                {m.data[1].status}
              </span>
              <h3>{m.data[1].title}</h3>
              <p>{m.data[1].copy}</p>
            </div>
          </Reveal>
          <Reveal className="bm-reviews-story" delay={2}>
            <div className="bm-review-illustration">
              <MigrationChannelMarks />
              <Link2Icon aria-hidden="true" />
              <StarIcon aria-hidden="true" />
            </div>
            <div className="bm-data-copy">
              <span className="bm-status bm-status-neutral">
                <Link2Icon aria-hidden="true" />
                {m.data[2].status}
              </span>
              <h3>{m.data[2].title}</h3>
              <p>{m.data[2].copy}</p>
            </div>
          </Reveal>
        </div>
        <div className="bm-messages-note">
          <MessageSquareIcon aria-hidden="true" />
          <div>
            <h3>{m.limitsTitle}</h3>
            <p>{m.limitsCopy}</p>
          </div>
        </div>
      </section>

      <section
        className="bm-safety site-shell"
        aria-labelledby="migration-safety-title"
      >
        <h2 id="migration-safety-title">{m.guaranteesTitle}</h2>
        <ul>
          {m.guarantees.map((item) => (
            <li key={item}>
              <CheckIcon aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="bm-support" aria-labelledby="migration-support-title">
        <div className="site-shell bm-support-layout">
          <div>
            <span className="bm-support-intro">
              <HeadphonesIcon aria-hidden="true" />
              {m.supportLanguages}
            </span>
            <h2 id="migration-support-title">{m.supportTitle}</h2>
            <p>{m.supportCopy}</p>
            <div className="bm-actions">
              <SiteAcquisitionLink
                to={`/demo?lang=${language}`}
                className="bm-button"
              >
                {m.cta}
                <ArrowRightIcon aria-hidden="true" />
              </SiteAcquisitionLink>
              <Link to={`/tarifs?lang=${language}`} className="bm-text-link">
                {m.pricing}
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </div>
          </div>
          <aside className="bm-checklist">
            <h3>{m.checklistTitle}</h3>
            <ol>
              {m.checklist.map((item, index) => (
                <li key={item}>
                  <span>0{index + 1}</span>
                  {item}
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="bm-text-link mt-6"
              onClick={() =>
                downloadText(
                  `baitly-migration-${language}.txt`,
                  [
                    `Baitly · ${m.checklistTitle}`,
                    m.sourceNote,
                    ...m.checklist.map((item) => `[ ] ${item}`),
                    ...m.channels.map(
                      (channel) =>
                        `${channel.name}\n${channel.points.map((point) => `[ ] ${point}`).join('\n')}`,
                    ),
                    m.limitsTitle,
                    m.limitsCopy,
                    'https://baitly.fr/migration',
                  ].join('\n\n'),
                )
              }
            >
              <DownloadIcon size={18} aria-hidden="true" />
              {m.downloadChecklist}
            </button>
            <span className="bm-checklist-fold" aria-hidden="true" />
          </aside>
        </div>
      </section>
    </div>
  );
}
