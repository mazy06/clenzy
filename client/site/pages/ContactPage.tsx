import { useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { readAcquisitionContext } from '../../src/services/publicAcquisitionContext';
import AcquisitionSummary from '../components/AcquisitionSummary';
import {
  ArrowRightIcon,
  CheckIcon,
  LifeBuoyIcon,
  MailIcon,
  MapPinIcon,
} from '../../src/icons/glyphs';
import { useSiteLanguage } from '../lib/siteLanguage';
import { BAITLY_CONTACT_MESSAGES } from '../lib/messages/baitlyContact';
import {
  ContactApiError,
  submitContact,
  type ContactSubject,
} from '../lib/publicContactApi';

const SUBJECTS: ContactSubject[] = ['contact', 'demo', 'migration', 'privacy'];

export default function ContactPage({
  intent = 'contact',
  disabled = false,
}: {
  intent?: ContactSubject;
  disabled?: boolean;
}) {
  const { language } = useSiteLanguage();
  const { search } = useLocation();
  const context = readAcquisitionContext(search);
  const m = BAITLY_CONTACT_MESSAGES[language];
  const [state, setState] = useState<'idle' | 'sending' | 'success' | 'error'>(
    'idle',
  );
  const [error, setError] = useState<'invalid' | 'limited' | 'error' | null>(
    null,
  );
  const pending = useRef(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || pending.current) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const field = (name: string) => String(data.get(name) ?? '').trim();
    if (!field('name') || !field('message')) {
      setError('invalid');
      setState('error');
      return;
    }
    pending.current = true;
    setState('sending');
    setError(null);
    try {
      await submitContact({
        plan: context.plan,
        market: context.market,
        name: field('name'),
        email: field('email'),
        subject: field('subject') as ContactSubject,
        message: field('message'),
        properties: field('properties'),
        tool: field('tool'),
        website: field('website'),
        language,
      });
      setState('success');
      window.requestAnimationFrame(() => statusRef.current?.focus());
    } catch (failure) {
      setError(
        failure instanceof ContactApiError && failure.status === 429
          ? 'limited'
          : 'error',
      );
      setState('error');
    } finally {
      pending.current = false;
    }
  };
  return (
    <section className="bct-page site-shell">
      <div className="bct-copy">
        <p className="bct-eyebrow">{m.eyebrow}</p>
        <h1>{intent === 'demo' ? m.demoTitle : m.title}</h1>
        <p className="bct-lead">{intent === 'demo' ? m.demoIntro : m.intro}</p>
        <ol className="bct-process">
          {m.steps.map((step, i) => (
            <li key={step}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              {step}
            </li>
          ))}
        </ol>
        <div className="bct-publisher">
          <span>{m.company}</span>
          <strong>Sinatech</strong>
          <p>
            <MapPinIcon size={16} aria-hidden="true" />
            {m.location}
          </p>
          <p>
            <MailIcon size={16} aria-hidden="true" />
            <span>
              {m.writeUs}{' '}
              <a href="mailto:contact@baitly.fr" dir="ltr">
                contact@baitly.fr
              </a>
            </span>
          </p>
          <p>
            <LifeBuoyIcon size={16} aria-hidden="true" />
            <span>
              {m.supportMail}{' '}
              <a href="mailto:support@baitly.fr" dir="ltr">
                support@baitly.fr
              </a>
            </span>
          </p>
        </div>
        <Link
          className="bct-explore"
          to={`/produit/pms-channel-manager?lang=${language}`}
        >
          {m.explore}
          <ArrowRightIcon size={17} aria-hidden="true" />
        </Link>
      </div>
      <div className="bct-form-surface">
        {state === 'success' ? (
          <div
            className="bct-success"
            role="status"
            tabIndex={-1}
            ref={statusRef}
          >
            <CheckIcon size={30} aria-hidden="true" />
            <h2>{m.success}</h2>
            <p>{m.successCopy}</p>
            <p>{m.noAppointment}</p>
            <button
              className="baitly-button"
              type="button"
              onClick={() => setState('idle')}
            >
              {m.again}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} aria-busy={disabled || state === 'sending'}>
            <h2>{m.formTitle}</h2>
            <AcquisitionSummary
              context={{ ...context, properties: undefined }}
            />
            <fieldset disabled={disabled || state === 'sending'}>
              <div className="bct-fields">
                <label htmlFor="contact-name">
                  {m.name}
                  <input
                    name="name"
                    id="contact-name"
                    autoComplete="name"
                    required
                    maxLength={120}
                  />
                </label>
                <label htmlFor="contact-email">
                  {m.email}
                  <input
                    name="email"
                    id="contact-email"
                    autoComplete="email"
                    type="email"
                    dir="ltr"
                    required
                    maxLength={254}
                  />
                </label>
              </div>
              <label htmlFor="contact-subject">
                {m.subject}
                <select
                  name="subject"
                  id="contact-subject"
                  defaultValue={intent}
                >
                  {SUBJECTS.map((subject, i) => (
                    <option value={subject} key={subject}>
                      {m.subjects[i]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="bct-fields">
                <label htmlFor="contact-properties">
                  {m.properties}
                  <input
                    name="properties"
                    defaultValue={context.properties}
                    id="contact-properties"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="100000"
                    step="1"
                  />
                </label>
                <label htmlFor="contact-tool">
                  {m.tool}
                  <input name="tool" id="contact-tool" maxLength={120} />
                </label>
              </div>
              <label htmlFor="contact-message">
                {m.message}
                <textarea
                  name="message"
                  id="contact-message"
                  rows={5}
                  required
                  maxLength={5000}
                  aria-describedby="contact-hint"
                />
              </label>
              <p id="contact-hint" className="bct-hint">
                {m.messageHint}
              </p>
              <label className="bct-trap" aria-hidden="true">
                {m.honeypot}
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
              {error && (
                <p className="bct-error" role="alert">
                  {m[error]}
                </p>
              )}
              <button className="baitly-button bct-submit" type="submit">
                {state === 'sending' ? m.sending : m.send}
                <ArrowRightIcon size={18} aria-hidden="true" />
              </button>
              <p className="bct-privacy">
                {m.privacy}{' '}
                <Link to={`/legal/confidentialite?lang=${language}`}>
                  {m.privacyLink}
                </Link>
              </p>
            </fieldset>
          </form>
        )}
      </div>
    </section>
  );
}
