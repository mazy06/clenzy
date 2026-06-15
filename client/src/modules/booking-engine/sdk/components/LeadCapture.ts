import type { BookingApi } from '../api';
import type { BookingI18n } from '../i18n';

/**
 * Capture de lead par exit-intent (2.12) — form embarquable affiché UNE fois par session quand le
 * visiteur s'apprête à quitter la page (souris vers le haut hors viewport, desktop). Consentement
 * RGPD obligatoire. POST /leads (source EXIT_INTENT) ; si l'org a désactivé la capture (403), on
 * ferme sans insister. Vit dans le Shadow DOM du widget (styles `.cb-*` scopés).
 */

export interface LeadCaptureOptions {
  root: ShadowRoot;
  api: BookingApi;
  i18n: BookingI18n;
  locale: string;
  enabled: boolean;
  storageKey: string;
}

export function mountLeadCapture(opts: LeadCaptureOptions): () => void {
  const { root, api, i18n, locale, enabled, storageKey } = opts;
  const noop = () => {};
  if (!enabled) return noop;
  let alreadyShown = false;
  try { alreadyShown = sessionStorage.getItem(storageKey) === '1'; } catch { /* sessionStorage indispo */ }
  if (alreadyShown) return noop;

  const overlay = document.createElement('div');
  overlay.className = 'cb-lead-overlay';
  overlay.hidden = true;

  const card = document.createElement('div');
  card.className = 'cb-lead-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'cb-lead-card__close';
  closeBtn.setAttribute('aria-label', i18n.t('lead.close'));
  closeBtn.textContent = '×';
  card.appendChild(closeBtn);

  const title = document.createElement('div');
  title.className = 'cb-lead-card__title';
  title.textContent = i18n.t('lead.title');
  card.appendChild(title);

  const subtitle = document.createElement('div');
  subtitle.className = 'cb-lead-card__subtitle';
  subtitle.textContent = i18n.t('lead.subtitle');
  card.appendChild(subtitle);

  const form = document.createElement('form');
  form.className = 'cb-lead-form';

  const input = document.createElement('input');
  input.type = 'email';
  input.required = true;
  input.className = 'cb-input cb-lead-input';
  input.placeholder = i18n.t('lead.emailPlaceholder');
  form.appendChild(input);

  const consentLabel = document.createElement('label');
  consentLabel.className = 'cb-lead-consent';
  const consent = document.createElement('input');
  consent.type = 'checkbox';
  const consentText = document.createElement('span');
  consentText.textContent = i18n.t('lead.consent');
  consentLabel.appendChild(consent);
  consentLabel.appendChild(consentText);
  form.appendChild(consentLabel);

  const error = document.createElement('div');
  error.className = 'cb-lead-error';
  error.hidden = true;
  form.appendChild(error);

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'cb-cta cb-lead-submit';
  submit.textContent = i18n.t('lead.submit');
  form.appendChild(submit);

  card.appendChild(form);

  const success = document.createElement('div');
  success.className = 'cb-lead-success';
  success.hidden = true;
  success.textContent = i18n.t('lead.success');
  card.appendChild(success);

  overlay.appendChild(card);
  root.appendChild(overlay);

  const markShown = () => { try { sessionStorage.setItem(storageKey, '1'); } catch { /* ignore */ } };
  const close = () => { overlay.hidden = true; };
  const open = () => {
    if (!overlay.hidden) return;
    overlay.hidden = false;
    markShown();
    input.focus();
  };

  const showError = (msg: string) => { error.textContent = msg; error.hidden = false; };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = input.value.trim();
    if (!email || !consent.checked) { showError(i18n.t('lead.required')); return; }
    error.hidden = true;
    submit.disabled = true;
    api.postLead({ email, source: 'EXIT_INTENT', locale, consent: true })
      .then(() => {
        form.hidden = true;
        success.hidden = false;
        window.setTimeout(close, 2500);
      })
      .catch((err: unknown) => {
        submit.disabled = false;
        if (String(err).includes('403')) {
          close(); // capture désactivée côté org : on n'insiste pas
        } else {
          showError(i18n.t('lead.error'));
        }
      });
  });

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  // Exit-intent desktop : la souris quitte le viewport par le haut.
  const onMouseOut = (e: MouseEvent) => {
    if (!e.relatedTarget && e.clientY <= 0) {
      open();
      document.removeEventListener('mouseout', onMouseOut);
    }
  };
  document.addEventListener('mouseout', onMouseOut);

  return () => {
    document.removeEventListener('mouseout', onMouseOut);
    overlay.remove();
  };
}
