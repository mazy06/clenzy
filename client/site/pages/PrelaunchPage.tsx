import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { readAcquisitionContext } from '../../src/services/publicAcquisitionContext';
import AcquisitionSummary from '../components/AcquisitionSummary';
import { ArrowRightIcon, CheckIcon, MailIcon } from 'lucide-react';
import { runtimeEnvOr } from '../../src/config/runtimeConfig';
import {
  LaunchApiError,
  publicLaunchApi,
  type WaitlistResult,
} from '../../src/services/publicLaunchApi';
import { useSiteLanguage } from '../lib/siteLanguage';
import { useSiteLaunch } from '../lib/siteLaunch';
import { PRELAUNCH_MESSAGES } from '../lib/messages/prelaunch';
import LaunchCountdown from '../components/LaunchCountdown';
import BaitlyProductProofs from '../components/BaitlyProductProofs';
import { BAITLY_READINESS_MESSAGES } from '../lib/messages/baitlyReadiness';
import '../prelaunch.css';
import { SITE_PHOTOS, sitePhotoAlt } from '../data/baitlyPhotography';

const { prelaunchReception: terracePhoto } = SITE_PHOTOS;

function WaitlistForm({ applicationEntry }: { applicationEntry: boolean }) {
  const { language } = useSiteLanguage();
  const { search } = useLocation();
  const context = readAcquisitionContext(search);
  const m = PRELAUNCH_MESSAGES[language];
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<
    'invalidEmail' | 'consentRequired' | 'rateLimit' | 'error' | null
  >(null);
  const [result, setResult] = useState<WaitlistResult | null>(null);
  const inFlight = useRef(false);
  const successRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (result) successRef.current?.focus();
  }, [result]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    if (
      !/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(email.trim())
    ) {
      setError('invalidEmail');
      return;
    }
    if (!consent) {
      setError('consentRequired');
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      setResult(
        await publicLaunchApi.subscribe(email.trim(), language, context),
      );
    } catch (failure) {
      setError(
        failure instanceof LaunchApiError && failure.status === 429
          ? 'rateLimit'
          : 'error',
      );
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  if (result)
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        className="prelaunch-success"
        role="status"
      >
        <CheckIcon aria-hidden="true" />
        <h2>{result.alreadyRegistered ? m.duplicate : m.success}</h2>
        <p>{result.alreadyRegistered ? m.duplicateBody : m.successBody}</p>
        <bdi>{email.trim()}</bdi>
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setEmail('');
            setConsent(false);
          }}
        >
          {m.otherEmail}
        </button>
      </div>
    );

  return (
    <form
      className="prelaunch-form"
      noValidate
      onSubmit={submit}
      aria-busy={submitting}
    >
      <h2>{m.formTitle}</h2>
      <AcquisitionSummary context={context} />
      <label htmlFor="prelaunch-email">{m.email}</label>
      <div className="prelaunch-email-row">
        <div className="prelaunch-input-wrap">
          <MailIcon aria-hidden="true" />
          <input
            id="prelaunch-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            dir="ltr"
            required
            maxLength={254}
            placeholder={m.placeholder}
            value={email}
            disabled={submitting}
            aria-invalid={error === 'invalidEmail'}
            aria-describedby={error ? 'prelaunch-form-error' : undefined}
            onChange={(event) => {
              setEmail(event.target.value);
              setError(null);
            }}
          />
        </div>
        <button className="baitly-button" type="submit" disabled={submitting}>
          {submitting ? m.submitting : m.submit}
          <ArrowRightIcon aria-hidden="true" />
        </button>
      </div>
      <label className="prelaunch-consent">
        <input
          type="checkbox"
          checked={consent}
          required
          disabled={submitting}
          aria-invalid={error === 'consentRequired'}
          aria-describedby={
            error === 'consentRequired' ? 'prelaunch-form-error' : undefined
          }
          onChange={(event) => {
            setConsent(event.target.checked);
            setError(null);
          }}
        />
        <span>
          {m.consent}{' '}
          <Link to={applicationEntry ? '/privacy' : '/legal/confidentialite'}>
            {m.privacy}
          </Link>
        </span>
      </label>
      {error && (
        <p id="prelaunch-form-error" role="alert" className="prelaunch-error">
          {m[error]}
        </p>
      )}
      <p className="prelaunch-form-note">{m.note}</p>
    </form>
  );
}

export default function PrelaunchPage({
  applicationEntry = false,
}: {
  applicationEntry?: boolean;
}) {
  const { language, direction } = useSiteLanguage();
  const { status, loading, error, refresh, paused } = useSiteLaunch();
  const m = PRELAUNCH_MESSAGES[language];
  const next = BAITLY_READINESS_MESSAGES[language].next;
  const appUrl = runtimeEnvOr('VITE_APP_URL', 'http://localhost:3000').replace(
    /\/+$/,
    '',
  );
  return (
    <section
      className="prelaunch"
      dir={direction}
      aria-labelledby="prelaunch-title"
    >
      <div className="prelaunch-shell">
        <div className="prelaunch-topline">
          <span className="prelaunch-eyebrow">
            <span aria-hidden="true" />
            {m.eyebrow}
          </span>
        </div>
        <div className="prelaunch-layout">
          <div className="prelaunch-copy">
            <h1 id="prelaunch-title">
              {paused ? (
                <>
                  {m.heading}
                  <br />
                  <span>{m.headingAccent}</span>
                </>
              ) : (
                m.openTitle
              )}
            </h1>
            <p className="prelaunch-intro">{paused ? m.intro : m.openBody}</p>
            {paused ? (
              <>
                <div className="prelaunch-date">
                  {loading ? (
                    <p role="status">{m.loading}</p>
                  ) : error ? (
                    <div className="prelaunch-date-note">
                      <p>{m.unavailable}</p>
                      <button onClick={refresh}>{m.retry}</button>
                    </div>
                  ) : status?.launchAt ? (
                    <>
                      <p className="prelaunch-date-label">
                        {m.countdown}{' '}
                        <time dateTime={status.launchAt}>
                          {new Intl.DateTimeFormat(language, {
                            dateStyle: 'long',
                            timeStyle: 'short',
                            timeZone: status.launchTimeZone,
                          }).format(new Date(status.launchAt))}
                        </time>
                        <span className="prelaunch-timezone">
                          {status.launchTimeZone}
                        </span>
                      </p>
                      <LaunchCountdown
                        launchAt={status.launchAt}
                        language={language}
                        messages={m}
                      />
                    </>
                  ) : (
                    <div className="prelaunch-date-note">
                      <strong>{m.dateSoon}</strong>
                      <p>{m.dateSoonHint}</p>
                    </div>
                  )}
                </div>
                <WaitlistForm applicationEntry={applicationEntry} />
                <p className="prelaunch-paused">{m.paused}</p>
              </>
            ) : (
              <a
                className="baitly-button prelaunch-open"
                href={`${appUrl}/inscription?lang=${language}`}
              >
                {m.register}
                <ArrowRightIcon />
              </a>
            )}
            <a
              className="prelaunch-login"
              href={
                applicationEntry ? '/login' : `${appUrl}/login?lang=${language}`
              }
            >
              {m.login}
              <ArrowRightIcon aria-hidden="true" />
            </a>
          </div>
          <figure className="prelaunch-visual">
            <img
              src={terracePhoto}
              alt={sitePhotoAlt('prelaunchReception', language)}
              width={640}
              height={424}
            />
            <figcaption>
              <span>Baitly</span>
              <strong>{m.imageCaption}</strong>
              <p>{m.imageSub}</p>
            </figcaption>
          </figure>
        </div>
        {!applicationEntry && (
          <>
            {paused && (
              <section
                className="prelaunch-next"
                aria-labelledby="prelaunch-next-title"
              >
                <div>
                  <h2 id="prelaunch-next-title">{next.title}</h2>
                  <p>{next.note}</p>
                </div>
                <ol>
                  {next.steps.map((step, index) => (
                    <li key={step.title}>
                      <span aria-hidden="true">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <h3>{step.title}</h3>
                        <p>{step.copy}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            <BaitlyProductProofs />
            <Link className="prelaunch-back" to={`/?lang=${language}`}>
              {m.back}
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
