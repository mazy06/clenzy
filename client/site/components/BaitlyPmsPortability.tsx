import { useId, useState } from 'react';
import {
  ArrowUpRightIcon,
  ChevronDownIcon,
  DownloadIcon,
  FileCheck2Icon,
} from 'lucide-react';
import { PMS_PORTABILITY, PMS_RESEARCH_DATE } from '../data/pmsPortability';
import { PMS_PORTABILITY_MESSAGES } from '../lib/messages/pmsPortability';
import type { SiteLanguage } from '../lib/siteLanguage';
import { downloadText } from '../lib/downloadText';

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
