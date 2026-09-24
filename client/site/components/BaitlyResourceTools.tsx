import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  Search,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { BAITLY_RESOURCE_MESSAGES } from '../lib/messages/baitlyResources';
import type { SiteLanguage } from '../lib/siteLanguage';
import {
  calculateRevenue,
  DEFAULT_REVENUE_INPUTS,
  GUIDE_SOURCES,
  MARKET_CITIES,
  MARKET_SOURCE,
  normalizeResourceSearch,
  REVENUE_LIMITS,
  type RevenueInputs,
} from '../data/baitlyResources';
import { RESOURCE_GLOSSARY } from '../data/baitlyResourceGlossary';
import terrace from '../assets/photos/terrace.jpg';
import food from '../assets/photos/food.jpg';
import cleaning from '../assets/services/menage.jpg';

type Props = { language: SiteLanguage };
const INPUT_KEYS = Object.keys(
  DEFAULT_REVENUE_INPUTS,
) as (keyof RevenueInputs)[];
const LOCALES = { fr: 'fr-FR', en: 'en-GB', ar: 'ar-MA' };
const amount = (n: number, language: SiteLanguage, digits = 0) =>
  new Intl.NumberFormat(LOCALES[language], {
    maximumFractionDigits: digits,
  }).format(n);

function downloadText(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob(['\uFEFF', text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function RevenueCalculator({ language }: Props) {
  const m = BAITLY_RESOURCE_MESSAGES[language];
  const c = m.calc;
  // The scenario belongs to this visit, not to a saved business account.
  const [raw, setRaw] = useState(() =>
    Object.fromEntries(
      INPUT_KEYS.map((key) => [key, String(DEFAULT_REVENUE_INPUTS[key])]),
    ),
  );
  const [currency, setCurrency] = useState('MAD');
  const inputs = Object.fromEntries(
    INPUT_KEYS.map((key) => [key, Number(raw[key])]),
  ) as unknown as RevenueInputs;
  const validField = (key: keyof RevenueInputs) => {
    const value = inputs[key];
    const [min, max] = REVENUE_LIMITS[key];
    return (
      raw[key].trim() !== '' &&
      Number.isFinite(value) &&
      value >= min &&
      value <= max &&
      (!['properties', 'nights'].includes(key) || Number.isInteger(value))
    );
  };
  const valid = INPUT_KEYS.every(validField);
  const result = calculateRevenue(inputs);
  const values = [
    result.accommodation,
    result.extras,
    result.fees,
    result.operatingCosts,
    result.net,
  ];
  const money = (n: number) => `${amount(n, language, 2)} ${currency}`;
  const exportScenario = () => {
    const rows = [
      [c.currency, currency],
      ...INPUT_KEYS.map((key, index) => [c.fields[index], inputs[key]]),
      ...c.labels.map((label, index) => [label, values[index].toFixed(2)]),
      [c.note],
    ];
    downloadText(
      'baitly-scenario.csv',
      rows
        .map((row) =>
          row
            .map((value) => `"${String(value).replace(/"/g, '""')}"`)
            .join(';'),
        )
        .join('\r\n'),
      'text/csv;charset=utf-8',
    );
  };
  return (
    <div className="brs-calculator">
      <section className="brs-inputs" aria-labelledby="brs-input-title">
        <div className="brs-row">
          <h2 id="brs-input-title">{c.inputs}</h2>
          <button
            className="brs-icon-button"
            aria-label={m.reset}
            onClick={() =>
              setRaw(
                Object.fromEntries(
                  INPUT_KEYS.map((key) => [
                    key,
                    String(DEFAULT_REVENUE_INPUTS[key]),
                  ]),
                ),
              )
            }
          >
            <RotateCcw size={18} />
          </button>
        </div>
        <p className="brs-small">{c.example}</p>
        <label className="brs-field brs-currency">
          {c.currency}
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          >
            <option>MAD</option>
            <option>SAR</option>
            <option>EUR</option>
          </select>
        </label>
        <div className="brs-fields">
          {INPUT_KEYS.map((key, index) => (
            <label className="brs-field" key={key}>
              <span>{c.fields[index]}</span>
              <input
                type="number"
                inputMode="decimal"
                min={REVENUE_LIMITS[key][0]}
                max={REVENUE_LIMITS[key][1]}
                step={['properties', 'nights'].includes(key) ? 1 : '0.01'}
                value={raw[key]}
                aria-invalid={!validField(key)}
                aria-describedby={`brs-limit-${key}`}
                onChange={(event) =>
                  setRaw((previous) => ({
                    ...previous,
                    [key]: event.target.value,
                  }))
                }
              />
              <small id={`brs-limit-${key}`} dir="ltr">
                {REVENUE_LIMITS[key].join(' – ')}
              </small>
            </label>
          ))}
        </div>
        <p className="brs-small">{c.costHint}</p>
      </section>
      <div className="brs-results-column">
        <section className="brs-result" aria-labelledby="brs-result-title">
          <span className="brs-eyebrow" id="brs-result-title">
            {c.output}
          </span>
          {valid ? (
            <>
              <div
                className="brs-result-total"
                aria-live="polite"
                aria-atomic="true"
              >
                <span>{c.labels[4]}</span>
                <strong>
                  <bdi>{money(result.net)}</bdi>
                </strong>
                <small>{c.period}</small>
              </div>
              <div className="brs-result-bars" aria-hidden="true">
                {[
                  result.accommodation,
                  result.extras,
                  result.fees,
                  result.operatingCosts,
                ].map((value, index) => (
                  <i
                    key={index}
                    style={
                      {
                        '--brs-bar': Math.min(
                          1,
                          value / Math.max(...values.slice(0, 4), 1),
                        ),
                        '--brs-delay': `${index * 90}ms`,
                      } as CSSProperties
                    }
                  />
                ))}
              </div>
              <dl className="brs-breakdown">
                {c.labels.slice(0, 4).map((label, index) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      <bdi>
                        {index > 1 ? '−' : ''}
                        {money(values[index])}
                      </bdi>
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="brs-equilibrium">
                <strong>{c.breakEven}</strong>
                <span>
                  {result.breakEven !== null && result.breakEven <= 100
                    ? `${amount(result.breakEven, language, 1)} %`
                    : c.unreachable}
                </span>
              </div>
              <p className="brs-small">
                {amount(result.bookedNights, language, 1)} {c.nights}.{' '}
                {c.netHint}
              </p>
            </>
          ) : (
            <p role="status" className="brs-invalid">
              {c.invalid}
            </p>
          )}
          <button
            className="brs-button brs-button-light"
            disabled={!valid}
            onClick={exportScenario}
          >
            <Download size={17} />
            {c.download}
          </button>
        </section>
        <details className="brs-method">
          <summary>
            {c.method}
            <ChevronDown size={18} />
          </summary>
          <ol>
            {c.formulas.map((formula) => (
              <li key={formula}>{formula}</li>
            ))}
          </ol>
        </details>
        <p className="brs-small brs-note">{c.note}</p>
      </div>
    </div>
  );
}

export function MarketBarometer({ language }: Props) {
  const m = BAITLY_RESOURCE_MESSAGES[language];
  const c = m.market;
  const [cityId, setCityId] = useState(MARKET_CITIES[0].id);
  const city = MARKET_CITIES.find((item) => item.id === cityId)!;
  const name = (item: typeof city) => (language === 'ar' ? item.ar : item.name);
  return (
    <>
      <div className="brs-market">
        <section className="brs-market-summary">
          <span className="brs-eyebrow">{c.scope}</span>
          <label className="brs-field">
            {c.city}
            <select
              value={cityId}
              onChange={(event) => setCityId(event.target.value)}
            >
              {MARKET_CITIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {name(item)}
                </option>
              ))}
            </select>
          </label>
          <div className="brs-market-number" aria-live="polite">
            <span>
              {c.growth} · {name(city)}
            </span>
            <strong>
              <bdi>+{city.growth} %</bdi>
            </strong>
            <small>
              <bdi>
                {city.growth > 9 ? '+' : ''}
                {city.growth - 9}
              </bdi>{' '}
              {c.points}
            </small>
          </div>
          <p>{c.period}</p>
          <span className="brs-small">{c.published}</span>
          <a
            className="brs-text-link"
            href={MARKET_SOURCE}
            target="_blank"
            rel="noreferrer"
          >
            {c.sourceName}
            <ExternalLink size={15} />
          </a>
        </section>
        <section
          className="brs-market-chart"
          aria-labelledby="brs-market-heading"
        >
          <h2 id="brs-market-heading">{c.comparison}</h2>
          <p className="brs-small">
            {c.growth} · {c.period}
          </p>
          <div className="brs-chart-rows">
            {[
              ...MARKET_CITIES.map((item) => ({
                id: item.id,
                label: name(item),
                growth: item.growth,
              })),
              { id: 'national', label: c.national, growth: 9 },
            ].map((item) => (
              <div
                className={`brs-chart-row ${
                  cityId === item.id ? 'is-selected' : ''
                }`}
                key={item.id}
              >
                <span>{item.label}</span>
                <div aria-hidden="true">
                  <i
                    style={{ '--brs-bar': item.growth / 25 } as CSSProperties}
                  />
                </div>
                <strong>
                  <bdi>+{item.growth} %</bdi>
                </strong>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="brs-explainer">
        <div>
          <h2>{c.methodology}</h2>
          <p>{c.methodCopy}</p>
          <p className="brs-small">{c.unavailable}</p>
        </div>
        <div>
          <h2>{c.use}</h2>
          <p>{c.useCopy}</p>
          <Link
            className="brs-text-link"
            to={`/ressources/calculateur?lang=${language}`}
          >
            {m.hero.secondary}
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </>
  );
}

export function ObligationsGuide({ language }: Props) {
  const m = BAITLY_RESOURCE_MESSAGES[language];
  const g = m.guide;
  const [country, setCountry] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const done = g.steps[country].filter((_, index) =>
    checked.has(`${country}-${index}`),
  ).length;
  const exportChecklist = () =>
    downloadText(
      'baitly-checklist.txt',
      [
        g.countries[country],
        g.verified,
        g.intro,
        ...g.steps[country].map(
          (step, index) =>
            `${checked.has(`${country}-${index}`) ? '[x]' : '[ ]'} ${
              step.title
            }\n${step.copy}\n${step.action}\n${
              GUIDE_SOURCES[country][index].url
            }`,
        ),
      ].join('\n\n'),
      'text/plain;charset=utf-8',
    );
  return (
    <>
      <div
        className="brs-filter"
        role="group"
        aria-label={m.modules.obligations.name}
      >
        {g.countries.map((name, index) => (
          <button
            key={name}
            aria-pressed={country === index}
            onClick={() => setCountry(index)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="brs-guide">
        <section className="brs-checklist" aria-label={g.countries[country]}>
          {g.steps[country].map((step, index) => {
            const key = `${country}-${index}`;
            return (
              <article
                key={key}
                className={checked.has(key) ? 'is-checked' : ''}
              >
                <div className="brs-step-number" aria-hidden="true">
                  0{index + 1}
                </div>
                <div>
                  <h2>{step.title}</h2>
                  <p>{step.copy}</p>
                  <label className="brs-check">
                    <input
                      type="checkbox"
                      checked={checked.has(key)}
                      onChange={(event) =>
                        setChecked((previous) => {
                          const next = new Set(previous);
                          if (event.target.checked) next.add(key);
                          else next.delete(key);
                          return next;
                        })
                      }
                    />
                    <span>{step.action}</span>
                  </label>
                  <a
                    href={GUIDE_SOURCES[country][index].url}
                    target="_blank"
                    rel="noreferrer"
                    className="brs-source"
                  >
                    {GUIDE_SOURCES[country][index].label}
                    <ExternalLink size={14} />
                  </a>
                </div>
              </article>
            );
          })}
        </section>
        <aside className="brs-guide-aside">
          <CheckCircle2 size={30} />
          <h2>{g.progress}</h2>
          <strong aria-live="polite">{done} / 3</strong>
          <span>{g.checked}</span>
          <progress aria-label={g.progress} value={done} max={3} />
          <p className="brs-small">{g.session}</p>
          <button className="brs-button" onClick={exportChecklist}>
            <Download size={16} />
            {g.download}
          </button>
          <p className="brs-small">{g.intro}</p>
          <small>{g.verified}</small>
        </aside>
      </div>
    </>
  );
}

export function BaitlyAcademy({ language }: Props) {
  const m = BAITLY_RESOURCE_MESSAGES[language];
  const a = m.academy;
  const [lesson, setLesson] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(
    null,
  );
  const [completed, setCompleted] = useState<Set<number>>(() => new Set());
  const lessonHeading = useRef<HTMLHeadingElement>(null);
  const focusNextLesson = useRef(false);
  const current = a.lessons[lesson];
  useEffect(() => {
    if (!focusNextLesson.current) return;
    focusNextLesson.current = false;
    // Focus brings the beginning of the new lesson into view, including from
    // the quiz at the bottom, and announces its title to screen readers.
    lessonHeading.current?.focus({ preventScroll: true });
    lessonHeading.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
  }, [lesson]);
  const changeLesson = (index: number) => {
    if (index === lesson) return;
    focusNextLesson.current = true;
    setLesson(index);
    setAnswer(null);
    setFeedback(null);
  };
  const submit = () => {
    const correct = answer === current.correct;
    setFeedback(correct ? 'correct' : 'incorrect');
    if (correct) setCompleted((previous) => new Set([...previous, lesson]));
  };
  return (
    <div className="brs-academy">
      <aside className="brs-course-nav">
        <span className="brs-eyebrow">{a.select}</span>
        {a.lessons.map((item, index) => (
          <button
            key={item.title}
            aria-pressed={index === lesson}
            onClick={() => changeLesson(index)}
          >
            <span className="brs-course-index">
              {completed.has(index) ? (
                <Check size={17} aria-label={a.success} />
              ) : (
                `0${index + 1}`
              )}
            </span>
            <span>
              <small>{item.category}</small>
              <strong>{item.title}</strong>
            </span>
          </button>
        ))}
        <p aria-live="polite">
          {completed.size} / 3 {a.completed}
        </p>
        <progress aria-label={a.completed} value={completed.size} max={3} />
        <p className="brs-small">{a.session}</p>
      </aside>
      <article className="brs-lesson" key={lesson}>
        <span className="brs-eyebrow">
          {a.lesson} 0{lesson + 1} · {current.category}
        </span>
        <h2 ref={lessonHeading} tabIndex={-1}>
          {current.title}
        </h2>
        <p className="brs-lead">{current.intro}</p>
        {current.sections.map((section, index) => (
          <section className="brs-lesson-section" key={section.title}>
            <span aria-hidden="true">{index + 1}</span>
            <div>
              <h3>{section.title}</h3>
              <p>{section.copy}</p>
            </div>
          </section>
        ))}
        <div className="brs-takeaway">
          <CheckCircle2 size={21} />
          <p>{current.takeaway}</p>
        </div>
        <form
          className="brs-quiz"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <span className="brs-eyebrow">{a.quiz}</span>
          <fieldset>
            <legend>{current.question}</legend>
            {current.answers.map((item, index) => (
              <label key={item} className="brs-radio">
                <input
                  type="radio"
                  name={`quiz-${lesson}`}
                  checked={answer === index}
                  onChange={() => {
                    setAnswer(index);
                    setFeedback(null);
                  }}
                />
                {item}
              </label>
            ))}
          </fieldset>
          <button
            className="brs-button"
            disabled={answer === null}
            type="submit"
          >
            {a.check}
            <ArrowRight size={16} />
          </button>
          {feedback && (
            <div className={`brs-feedback ${feedback}`} role="status">
              <strong>{feedback === 'correct' ? a.success : a.retry}</strong>
              <p>{current.explanation}</p>
            </div>
          )}
          {feedback === 'correct' && lesson < a.lessons.length - 1 && (
            <button
              className="brs-text-link"
              type="button"
              onClick={() => changeLesson(lesson + 1)}
            >
              {a.next}
              <ArrowRight size={16} />
            </button>
          )}
        </form>
      </article>
    </div>
  );
}

export function BaitlyJournal({ language }: Props) {
  const m = BAITLY_RESOURCE_MESSAGES[language];
  const [category, setCategory] = useState(-1);
  const photos = [terrace, food, cleaning];
  return (
    <>
      <div className="brs-filter" role="group" aria-label={m.modules.blog.name}>
        <button aria-pressed={category === -1} onClick={() => setCategory(-1)}>
          {m.all}
        </button>
        {m.blog.articles.map((article, index) => (
          <button
            key={article.category}
            aria-pressed={category === index}
            onClick={() => setCategory(index)}
          >
            {article.category}
          </button>
        ))}
      </div>
      <div className="brs-journal">
        {m.blog.articles.map((article, index) =>
          category !== -1 && category !== index ? null : (
            <details
              key={article.title}
              className="brs-article"
              id={`article-${index + 1}`}
            >
              <summary>
                <img src={photos[index]} alt="" loading="lazy" />
                <div>
                  <span className="brs-eyebrow">{article.category}</span>
                  <h2>{article.title}</h2>
                  <p>{article.intro}</p>
                  <span className="brs-text-link brs-read-label">
                    {m.blog.read}
                    <ArrowRight size={18} />
                  </span>
                  <span className="brs-text-link brs-close-label">
                    {m.blog.close}
                    <ChevronDown size={18} />
                  </span>
                </div>
              </summary>
              <div className="brs-article-body">
                <p className="brs-small">{m.blog.byline}</p>
                {article.sections.map((section) => (
                  <section key={section.title}>
                    <h3>{section.title}</h3>
                    <p>{section.copy}</p>
                  </section>
                ))}
                <div className="brs-takeaway">
                  <CheckCircle2 size={22} />
                  <div>
                    <strong>{m.blog.takeaway}</strong>
                    <p>{article.takeaway}</p>
                  </div>
                </div>
              </div>
            </details>
          ),
        )}
      </div>
    </>
  );
}

export function ResourceGlossary({ language }: Props) {
  const m = BAITLY_RESOURCE_MESSAGES[language];
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(0);
  const search = normalizeResourceSearch(query);
  const entries = RESOURCE_GLOSSARY.filter(
    (entry) =>
      (!category || category === entry.category) &&
      normalizeResourceSearch(
        [
          entry.id,
          ...(['fr', 'en', 'ar'] as const).flatMap((lang) => [
            entry[lang].term,
            entry[lang].definition,
          ]),
        ].join(' '),
      ).includes(search),
  );
  return (
    <>
      <div className="brs-search">
        <Search size={20} />
        <input
          type="search"
          aria-label={m.glossary.search}
          placeholder={m.glossary.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div
        className="brs-filter"
        role="group"
        aria-label={m.modules.glossaire.name}
      >
        {m.glossary.categories.map((name, index) => (
          <button
            key={name}
            aria-pressed={category === index}
            onClick={() => setCategory(index)}
          >
            {name}
          </button>
        ))}
      </div>
      <p className="brs-small" role="status">
        {m.results} : {entries.length}
      </p>
      <div className="brs-glossary">
        {entries.map((entry) => (
          <article key={entry.id} id={entry.id}>
            <div>
              <span className="brs-eyebrow">
                {m.glossary.categories[entry.category]}
              </span>
              <h2>{entry[language].term}</h2>
              <div
                className="brs-translations"
                aria-label={m.glossary.translations}
              >
                {(['fr', 'en', 'ar'] as const)
                  .filter((lang) => lang !== language)
                  .map((lang) => (
                    <span
                      key={lang}
                      lang={lang}
                      dir={lang === 'ar' ? 'rtl' : 'ltr'}
                    >
                      <small>{lang.toUpperCase()}</small>
                      {entry[lang].term}
                    </span>
                  ))}
              </div>
            </div>
            <p>{entry[language].definition}</p>
          </article>
        ))}
      </div>
      {!entries.length && (
        <div className="brs-empty">
          <Search size={28} />
          <p>{m.empty}</p>
          <button
            className="brs-button"
            onClick={() => {
              setQuery('');
              setCategory(0);
            }}
          >
            {m.reset}
          </button>
        </div>
      )}
    </>
  );
}
