import { useId, useState } from 'react';
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleHelpIcon,
  DownloadIcon,
  FileCheck2Icon,
  MinusIcon,
  XIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  EXIT_CRITERIA,
  PMS_PORTABILITY,
  PMS_RESEARCH_DATE,
  exitLevel,
  type ExitSignal,
  type PmsPortability,
} from '../data/pmsPortability';
import { PMS_PORTABILITY_MESSAGES } from '../lib/messages/pmsPortability';
import type { SiteLanguage } from '../lib/siteLanguage';
import { downloadText } from '../lib/downloadText';
import type { PortabilityMessages } from '../lib/messages/pmsPortability';

const SIGNAL_ICONS: Record<ExitSignal, typeof CheckIcon> = {
  yes: CheckIcon,
  partial: MinusIcon,
  no: XIcon,
  unknown: CircleHelpIcon,
};

function ExitComparison({
  provider,
  language,
  m,
}: {
  provider: PmsPortability;
  language: SiteLanguage;
  m: PortabilityMessages;
}) {
  const level = exitLevel(provider.exit);
  return (
    <div className="bm-pms-exit">
      <div className="bm-pms-exit-heading">
        <span className="bm-label">{m.exitTitle}</span>
        <p>
          <strong className={`bm-exit-level bm-exit-${level}`}>
            {m.exitLevels[level]}
          </strong>{' '}
          {m.exitHints[level]}
        </p>
      </div>
      <table className="bm-exit-table">
        <thead>
          <tr>
            <td />
            <th scope="col">
              <bdi>{provider.name}</bdi>
            </th>
            <th scope="col">{m.baitly}</th>
          </tr>
        </thead>
        <tbody>
          {EXIT_CRITERIA.map((criterion) => {
            const signal = provider.exit[criterion];
            const Icon = SIGNAL_ICONS[signal];
            return (
              <tr key={criterion}>
                <th scope="row">{m.criteria[criterion]}</th>
                <td>
                  <span className={`bm-signal bm-signal-${signal}`}>
                    <Icon aria-hidden="true" />
                    {m.signals[signal]}
                  </span>
                </td>
                <td>
                  <span className="bm-signal bm-signal-yes">
                    <CheckIcon aria-hidden="true" />
                    {m.baitlyValues[criterion]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <dl className="bm-pms-facts bm-pms-exit-facts">
        <div>
          <dt>{m.exitTerms}</dt>
          <dd>{provider.exitTerms[language]}</dd>
        </div>
        <div>
          <dt>{m.baitlyImport}</dt>
          <dd>{m.baitlyImportModes[provider.baitlyImport]}</dd>
        </div>
        {provider.feedback ? (
          <div>
            <dt>{m.feedback}</dt>
            <dd>
              {provider.feedback[language]}
              <small>{m.feedbackNote}</small>
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

export function BaitlyPmsPortability({ language }: { language: SiteLanguage }) {
  const id = useId();
  // Temporary exploration on a public page, not an account preference.
  const [providerId, setProviderId] = useState('');
  const provider = PMS_PORTABILITY.find((item) => item.id === providerId);
  const m = PMS_PORTABILITY_MESSAGES[language];
  const reviewed = new Intl.DateTimeFormat(language, {
    dateStyle: 'long',
    timeZone: 'UTC',
    calendar: 'gregory',
    numberingSystem: language === 'ar' ? 'arab' : 'latn',
  }).format(new Date(`${PMS_RESEARCH_DATE}T12:00:00Z`));

  return (
    <div className="bm-portability">
      <div className="bm-pms-picker">
        <div>
          <label htmlFor={id}>{m.label}</label>
          <p>{m.intro}</p>
        </div>
        <div className="bm-select-wrap">
          <select
            id={id}
            value={providerId}
            onChange={(event) => setProviderId(event.target.value)}
            aria-controls={`${id}-details`}
          >
            <option value="">{m.placeholder}</option>
            {PMS_PORTABILITY.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
            <option value="other">{m.other}</option>
          </select>
          <ChevronDownIcon aria-hidden="true" />
        </div>
      </div>
      <p className="sr-only" role="status">
        {provider
          ? `${provider.name} : ${m.evidence[provider.evidence]}`
          : providerId
            ? m.unknownTitle
            : ''}
      </p>
      <div id={`${id}-details`} className="bm-pms-result">
        {provider ? (
          <>
            <header className="bm-pms-heading">
              <div>
                <span className="bm-label">
                  {m.evidence[provider.evidence]}
                </span>
                <h3>
                  <bdi>{provider.name}</bdi>
                </h3>
              </div>
              <span className="bm-pms-formats">
                <bdi>{provider.formats}</bdi>
              </span>
            </header>
            <dl className="bm-pms-facts">
              <div>
                <dt>{m.coverage}</dt>
                <dd>{provider.coverage[language]}</dd>
              </div>
              <div>
                <dt>{m.caution}</dt>
                <dd>{provider.caution[language]}</dd>
              </div>
              <div>
                <dt>{m.timing}</dt>
                <dd>{provider.timing[language]}</dd>
              </div>
            </dl>
            <ExitComparison provider={provider} language={language} m={m} />
            <div className="bm-pms-evidence">
              <nav aria-label={`${m.sources} : ${provider.name}`}>
                {provider.sources.map((source, index) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {m.sourceKinds[source.kind]}
                    <span className="sr-only">
                      {' '}
                      {provider.name} ({index + 1})
                    </span>
                    <ArrowUpRightIcon aria-hidden="true" />
                  </a>
                ))}
              </nav>
              <button
                type="button"
                className="bm-text-link"
                onClick={() =>
                  downloadText(
                    `baitly-migration-${provider.id}-${language}.txt`,
                    [
                      `Baitly · ${provider.name}`,
                      `${m.checked} ${reviewed}`,
                      `${m.coverage}\n${provider.coverage[language]}\n${provider.formats}`,
                      `${m.caution}\n${provider.caution[language]}`,
                      `${m.timing}\n${provider.timing[language]}`,
                      `${m.exitTitle} : ${m.exitLevels[exitLevel(provider.exit)]}\n${EXIT_CRITERIA.map((criterion) => `- ${m.criteria[criterion]} : ${m.signals[provider.exit[criterion]]}`).join('\n')}`,
                      `${m.exitTerms}\n${provider.exitTerms[language]}`,
                      `${m.baitlyImport}\n${m.baitlyImportModes[provider.baitlyImport]}`,
                      ...(provider.feedback
                        ? [
                            `${m.feedback}\n${provider.feedback[language]}\n${m.feedbackNote}`,
                          ]
                        : []),
                      m.checklist.map((item) => `[ ] ${item}`).join('\n'),
                      m.methodology,
                      ...provider.sources.map(
                        (source) =>
                          `${m.sourceKinds[source.kind]} : ${source.url}`,
                      ),
                    ].join('\n\n'),
                  )
                }
              >
                <DownloadIcon aria-hidden="true" />
                {m.download}
              </button>
            </div>
          </>
        ) : (
          <div className="bm-pms-empty">
            <FileCheck2Icon aria-hidden="true" />
            <div>
              <h3>{providerId ? m.unknownTitle : m.emptyTitle}</h3>
              <p>{providerId ? m.unknown : m.empty}</p>
            </div>
          </div>
        )}
      </div>
      <p className="bm-pms-methodology">
        {m.checked} <time dateTime={PMS_RESEARCH_DATE}>{reviewed}</time>.{' '}
        {m.methodology}
      </p>
    </div>
  );
}

export function BaitlyPortabilityCommitment({
  language,
}: {
  language: SiteLanguage;
}) {
  const m = PMS_PORTABILITY_MESSAGES[language];
  return (
    <section
      className="bm-portability-promise site-shell"
      aria-labelledby="baitly-portability-title"
    >
      <div>
        <span className="bm-label">{m.promiseTag}</span>
        <h2 id="baitly-portability-title">{m.promiseTitle}</h2>
        <p>{m.promise}</p>
      </div>
      <div>
        <dl>
          {m.promiseItems.map(([title, copy]) => (
            <div key={title}>
              <dt>{title}</dt>
              <dd>{copy}</dd>
            </div>
          ))}
        </dl>
        <p className="bm-promise-status">{m.promiseStatus}</p>
      </div>
    </section>
  );
}

/** Home page entry point: the same sourced picker, framed for visitors who already run a PMS. */
export function BaitlyPmsHomeSection({ language }: { language: SiteLanguage }) {
  const m = PMS_PORTABILITY_MESSAGES[language];
  return (
    <div className="bm-page bm-home-portability">
      <section
        className="site-shell bm-home-portability-guide"
        aria-labelledby="home-portability-title"
      >
        <div className="bm-section-heading">
          <span className="bm-label">{m.homeTag}</span>
          <h2 id="home-portability-title">{m.homeTitle}</h2>
          <p>{m.homeIntro}</p>
        </div>
        <BaitlyPmsPortability language={language} />
        <ul className="bm-home-portability-context">
          <li>{m.airbnbNote}</li>
          <li>{m.dataAct}</li>
        </ul>
        <Link
          to={`/migration?lang=${language}`}
          className="bm-button bm-home-portability-link"
        >
          {m.homeLink}
          <ArrowRightIcon aria-hidden="true" />
        </Link>
      </section>
      <BaitlyPortabilityCommitment language={language} />
    </div>
  );
}
