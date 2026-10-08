import { createContext, startTransition, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, X } from 'lucide-react';
import assistantPortrait from '../../public/images/assistant/baitly-assistant.webp';
import { STORAGE_KEYS } from '../../src/services/storageService';
import { useSiteLanguage } from '../lib/siteLanguage';
import { SITE_COOKIES_MESSAGES } from '../lib/messages/siteCookies';
import { readSiteCookieChoice, saveSiteCookieChoice, type SiteCookieChoice, type SiteCookieDecision } from '../lib/siteCookieChoice';

const CookieNoticeContext = createContext<(() => void) | null>(null);

export function SiteCookieSettingsButton() {
  const open = useContext(CookieNoticeContext);
  const { language } = useSiteLanguage();
  if (!open) return null;
  return <button type="button" className="site-cookie-settings" onClick={open}>{SITE_COOKIES_MESSAGES[language].manage}</button>;
}

/** Landing only. Non-modal: visitors may continue browsing without making a choice.
 * This anonymous preference is per browser/origin, never synchronised as a PMS account setting.
 */
export default function SiteCookieNoticeProvider({ children }: { children: ReactNode }) {
  const { language, direction } = useSiteLanguage();
  const m = SITE_COOKIES_MESSAGES[language];
  // Read after hydration: published HTML must not depend on a visitor's storage.
  const [choice, setChoice] = useState<SiteCookieChoice | null>(null);
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<'saved' | 'unavailable' | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const volatile = useRef(false);
  const dismissed = useRef(false);

  useEffect(() => {
    const refresh = (closeSavedNotice = false) => {
      if (volatile.current) return;
      const stored = readSiteCookieChoice();
      setChoice(stored);
      if (!stored && !dismissed.current) setOpen(true);
      else if (stored && closeSavedNotice) setOpen(false);
    };
    const storage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== STORAGE_KEYS.SITE_COOKIE_CHOICE) return;
      volatile.current = false;
      dismissed.current = false;
      refresh(true);
    };
    const visibility = () => { if (!document.hidden) refresh(); };
    startTransition(() => refresh(true));
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  useEffect(() => {
    if (!choice) return;
    let timer: number;
    const check = () => {
      const remaining = choice.expiresAt - Date.now();
      if (remaining <= 0) { readSiteCookieChoice(); setChoice(null); setOpen(true); }
      else timer = window.setTimeout(check, Math.min(remaining, 2_147_483_647));
    };
    check();
    return () => window.clearTimeout(timer);
  }, [choice]);

  const close = () => {
    dismissed.current = true;
    setOpen(false);
    if (dialogRef.current?.contains(document.activeElement)) {
      (returnFocus.current ?? document.getElementById('site-content'))?.focus({ preventScroll: true });
    }
  };
  const save = (decision: SiteCookieDecision) => {
    const result = saveSiteCookieChoice(decision);
    volatile.current = !result.persisted;
    setChoice(result.choice);
    setFeedback(result.persisted ? 'saved' : 'unavailable');
    close();
  };
  const show = useCallback(() => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setFeedback(null);
    setOpen(true);
    // Focus only on an explicit request, never steal focus at initial page load.
    window.requestAnimationFrame(() => dialogRef.current?.focus());
  }, []);

  return (
    <CookieNoticeContext.Provider value={show}>
      {children}
      {feedback && <p className={feedback === 'saved' ? 'sr-only' : 'site-cookie-feedback'} role="status">{m[feedback]}</p>}
      {open && (
        <section ref={dialogRef} className="site-cookie-notice" role="dialog" tabIndex={-1}
          dir={direction} aria-labelledby="site-cookie-title" aria-describedby="site-cookie-description"
          onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
          <button type="button" className="site-cookie-close" onClick={close} aria-label={m.close}><X size={18} /></button>
          <header className="site-cookie-heading">
            <img src={assistantPortrait} alt="" width={72} height={72} decoding="async" draggable={false} />
            <div><span>{m.assistant}</span><h2 id="site-cookie-title">{m.title}</h2></div>
          </header>
          <p id="site-cookie-description">{m.description}</p>
          <details className="site-cookie-details">
            <summary>{m.details}</summary>
            <dl>{m.inventory.map(([title, text]) => <div key={title}><dt>{title}</dt><dd>{text}</dd></div>)}</dl>
            <p>{m.scope}</p>
          </details>
          <p className="site-cookie-note">{m.note}</p>
          {choice && <p className="site-cookie-current">{choice.decision === 'accepted' ? m.accepted : m.refused}</p>}
          <div className="site-cookie-actions">
            <button type="button" onClick={() => save('refused')}>{m.refuse}</button>
            <button type="button" onClick={() => save('accepted')}>{m.accept}</button>
          </div>
          <footer>
            <span><ShieldCheck size={16} aria-hidden="true" />{m.necessary}</span>
            <p>{m.duration}</p>
            <Link to={`/legal/confidentialite?lang=${language}#cookies`} onClick={close}>{m.policy}</Link>
          </footer>
        </section>
      )}
    </CookieNoticeContext.Provider>
  );
}
