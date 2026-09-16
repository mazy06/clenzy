import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangleIcon, CheckIcon, Loader2Icon } from 'lucide-react';
import {
  Badge,
  Button,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
} from '../../src/components/ui';
import Reveal from '../components/Reveal';
import { providerActivationMessages } from '../lib/providerActivationMessages';
import { ProviderLanguagePicker, useProviderLanguage } from '../lib/providerLanguage';
import { ApiError, marketplaceApi } from '../lib/marketplaceApi';

const APP_URL = import.meta.env.VITE_APP_URL || 'http://localhost:3000';
const MIN_LENGTH = 8;

/**
 * Le prestataire accepté définit son mot de passe.
 *
 * <p>Sur NOS pages, et non sur l'écran Keycloak : le parcours s'est fait
 * entièrement sur le site Baitly — candidature, dépôt de pièces, confirmation
 * d'adresse — et un saut vers une autre identité visuelle sur une autre adresse
 * ressemble, pour qui vient de candidater, à une tentative d'hameçonnage.</p>
 *
 * <p>Le jeton arrive par l'URL du courriel — un lien cliquable n'a pas d'autre
 * véhicule. Il est retiré de la barre d'adresse dès sa lecture, pour qu'il ne
 * suive pas l'historique ni les en-têtes `Referer`.</p>
 */
export default function ProviderActivationPage() {
  const { language, changeLanguage, direction } = useProviderLanguage();
  const copy = providerActivationMessages[language];
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token'));
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<'incomplete' | 'invalid' | 'limited' | null>(null);

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');
  const [errorKey, setErrorKey] = useState<'failed' | 'rejected' | 'limited'>('failed');

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const lang = params.get('lang');
    window.history.replaceState(window.history.state, '', window.location.pathname
      + (lang && ['fr', 'en', 'ar'].includes(lang) ? '?lang=' + lang : ''));
    if (!token) {
      setLoadError('incomplete');
      return;
    }
    marketplaceApi.getActivationTarget(token)
      .then(name => { if (active) setDisplayName(name); })
      .catch(error => { if (active) setLoadError(error instanceof ApiError && error.status === 429 ? 'limited' : 'invalid'); });
    return () => { active = false; };
  }, [token]);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirmation.length > 0 && confirmation !== password;
  const canSubmit = !!token && !!displayName && !loadError && password.length >= MIN_LENGTH
    && confirmation === password && status !== 'loading';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !token) return;
    setStatus('loading');
    try {
      await marketplaceApi.activate(token, password);
      setStatus('done');
      // Le mot de passe ne reste pas en mémoire du composant plus longtemps
      // que nécessaire.
      setPassword('');
      setConfirmation('');
    } catch (error) {
      setStatus('error');
      setErrorKey(error instanceof ApiError && error.status === 429 ? 'limited'
        : error instanceof ApiError && error.status >= 400 && error.status < 500 ? 'rejected' : 'failed');
    }
  };

  return (
    <section className="site-shell flex justify-center py-16" lang={language} dir={direction}>
      <div className="w-full max-w-[520px]">
        <ProviderLanguagePicker language={language} onChange={changeLanguage} />
        {status === 'done' ? (
          <Reveal>
            <div className="rounded-2xl border border-success/40 bg-success/[0.08] p-8 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/15">
                <CheckIcon className="size-6 text-success" />
              </div>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight">{copy.ready}</h1>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{copy.success}</p>
              <Button size="lg" className="mt-6" asChild>
                <a href={APP_URL}>{copy.login}</a>
              </Button>
            </div>
          </Reveal>
        ) : loadError ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <AlertTriangleIcon className="mx-auto size-6 text-primary" />
            <p role="alert" className="mt-3 text-base">{copy[loadError]}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {copy.linkHelp}
            </p>
          </div>
        ) : (
          <Reveal>
            <Badge variant="outline">{copy.activation}</Badge>
            <h1 className="mt-4 text-3xl leading-tight font-semibold tracking-tight text-balance">
              {copy.title}
            </h1>
            <p className="mt-3 text-base text-muted-foreground">
              {displayName
                ? <>{copy.lastStep} <strong className="text-foreground"><bdi>{displayName}</bdi></strong>.</>
                : copy.checking}
            </p>

            <form onSubmit={handleSubmit}
              className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-brand">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="pa-password">{copy.password}</FieldLabel>
                  <Input id="pa-password" type="password" value={password} required
                    autoComplete="new-password" disabled={!displayName || status === 'loading'}
                    onChange={(e) => setPassword(e.target.value)} />
                  <p className={`text-xs ${tooShort ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {copy.minimum}
                  </p>
                </Field>
                <Field>
                  <FieldLabel htmlFor="pa-confirm">{copy.confirmation}</FieldLabel>
                  <Input id="pa-confirm" type="password" value={confirmation} required
                    autoComplete="new-password" disabled={!displayName || status === 'loading'}
                    onChange={(e) => setConfirmation(e.target.value)} />
                  {mismatch && (
                    <p className="text-xs text-destructive">{copy.mismatch}</p>
                  )}
                </Field>

                {status === 'error' && (
                  <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-sm">
                    {copy[errorKey]}
                  </p>
                )}

                <Button type="submit" size="lg" disabled={!canSubmit}>
                  {status === 'loading' && <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" />}
                  {status === 'loading' ? copy.pending : copy.submit}
                </Button>
              </FieldGroup>
            </form>
          </Reveal>
        )}
      </div>
    </section>
  );
}
