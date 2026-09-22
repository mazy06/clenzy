import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | undefined;
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
      if (error) { script.remove(); reject(error); } else resolve();
    };
    const timeout = setTimeout(() => finish(new Error('Turnstile timeout')), 15000);
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => finish(window.turnstile ? undefined : new Error('Turnstile unavailable'));
    script.onerror = () => finish(new Error('Turnstile unavailable'));
    document.head.appendChild(script);
  }).catch((error) => { scriptPromise = undefined; throw error; });
  return scriptPromise;
}

const messages = {
  fr: { loading: 'Vérification de sécurité…', error: 'La vérification a expiré ou a échoué. Réessayez avant l’envoi.', retry: 'Relancer la vérification' },
  en: { loading: 'Security verification…', error: 'Verification expired or failed. Please try again before submitting.', retry: 'Retry verification' },
  ar: { loading: 'جارٍ التحقق الأمني…', error: 'انتهت صلاحية التحقق أو فشل. حاول مرة أخرى قبل الإرسال.', retry: 'إعادة التحقق' },
};

/** Tokens remain in memory and are invalidated on expiry, failure and every remount. */
export default function BaitlyTurnstile({ siteKey, action, language = 'fr', resetKey = 0, onToken }: {
  siteKey: string;
  action: 'login' | 'marketplace-application';
  language?: string;
  resetKey?: number;
  onToken: (token: string | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  callback.current = onToken;
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const locale = language.split('-')[0];
  const text = messages[locale as keyof typeof messages] ?? messages.fr;

  useEffect(() => {
    let active = true;
    let widget: string | undefined;
    callback.current(null);
    setStatus('loading');
    const fail = () => {
      if (!active) return;
      callback.current(null);
      setStatus('error');
    };
    if (!siteKey) fail();
    else loadTurnstile().then(() => {
      if (!active || !container.current || !window.turnstile) return;
      widget = window.turnstile.render(container.current, {
        sitekey: siteKey, action, language: locale, theme: 'auto', size: 'flexible',
        'response-field': false,
        callback: (token: string) => {
          if (!active) return;
          callback.current(token);
          setStatus('ready');
        },
        'error-callback': fail, 'expired-callback': fail, 'timeout-callback': fail,
      });
    }).catch(fail);
    return () => {
      active = false;
      if (widget !== undefined) window.turnstile?.remove(widget);
    };
  }, [siteKey, action, locale, resetKey, retry]);

  return <div className="min-w-0 w-full">
    <div ref={container} />
    {status === 'loading' && <p role="status" className="text-sm text-muted-foreground">{text.loading}</p>}
    {status === 'error' && <div role="alert" className="text-sm text-muted-foreground">
      <p>{text.error}</p>
      <button type="button" onClick={() => setRetry(value => value + 1)}
        className="cursor-pointer underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
        {text.retry}
      </button>
    </div>}
  </div>;
}
