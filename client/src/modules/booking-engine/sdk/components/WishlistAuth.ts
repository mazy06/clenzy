import type { BookingApi, GuestAuthResult } from '../api';
import type { BookingI18n } from '../i18n';
import type { StateManager } from '../state';

/**
 * Compte voyageur (2.11) — modal login/inscription du widget embarquable.
 *
 * Porte `useGuestAuth` (React) dans le SDK vanilla : ouvre une modale login/register quand une
 * action protégée (ajout d'un favori) est tentée sans session. Le token reste EN MÉMOIRE
 * (`state.guestToken`, jamais en localStorage — règle sécurité #7). Vit dans le Shadow DOM du
 * widget (classes `.cb-*` scopées) et réutilise les styles `.cb-lead-overlay / .cb-lead-card`.
 */

export interface WishlistAuthOptions {
  root: ShadowRoot;
  api: BookingApi;
  i18n: BookingI18n;
  state: StateManager;
  organizationId: number;
}

export interface WishlistAuthController {
  /** Lance `then` si la session guest existe, sinon ouvre le login puis enchaîne après succès. */
  requireAuth: (then: () => void) => void;
  destroy: () => void;
}

type Mode = 'login' | 'register';

export function mountWishlistAuth(opts: WishlistAuthOptions): WishlistAuthController {
  const { root, api, i18n, state, organizationId } = opts;

  let mode: Mode = 'login';
  let pendingAction: (() => void) | null = null;

  const overlay = document.createElement('div');
  overlay.className = 'cb-lead-overlay';
  overlay.hidden = true;

  const card = document.createElement('div');
  card.className = 'cb-lead-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  overlay.appendChild(card);
  root.appendChild(overlay);

  const close = () => {
    overlay.hidden = true;
    pendingAction = null;
  };

  const onSuccess = (result: GuestAuthResult, fallbackEmail: string) => {
    const token = result.accessToken;
    state.set({ guestToken: token, guestEmail: result.profile?.email ?? fallbackEmail }, 'stateChange');
    // Hydrate les favoris du compte (échec non bloquant : la modale est déjà validée).
    api.wishlistList(organizationId, token)
      .then((ids) => state.set({ wishlist: ids }, 'stateChange'))
      .catch(() => { /* favoris indisponibles : on garde la liste locale */ });
    const action = pendingAction;
    close();
    if (action) action();
  };

  // Rendu reconstruit à chaque bascule login ↔ register.
  const render = () => {
    card.textContent = '';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'cb-lead-card__close';
    closeBtn.setAttribute('aria-label', i18n.t('common.close'));
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', close);
    card.appendChild(closeBtn);

    const title = document.createElement('div');
    title.className = 'cb-lead-card__title';
    title.textContent = i18n.t(mode === 'login' ? 'identification.login' : 'identification.register');
    card.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.className = 'cb-lead-card__subtitle';
    subtitle.textContent = i18n.t('wishlist.loginPrompt');
    card.appendChild(subtitle);

    const form = document.createElement('form');
    form.className = 'cb-lead-form';

    const field = (type: string, key: string, required: boolean): HTMLInputElement => {
      const input = document.createElement('input');
      input.type = type;
      input.required = required;
      input.className = 'cb-input';
      input.placeholder = i18n.t(key);
      input.setAttribute('aria-label', i18n.t(key));
      return input;
    };

    let firstName: HTMLInputElement | null = null;
    let lastName: HTMLInputElement | null = null;
    let phone: HTMLInputElement | null = null;

    if (mode === 'register') {
      const nameRow = document.createElement('div');
      nameRow.className = 'cb-auth-row';
      firstName = field('text', 'identification.firstName', true);
      lastName = field('text', 'identification.lastName', true);
      nameRow.appendChild(firstName);
      nameRow.appendChild(lastName);
      form.appendChild(nameRow);
    }

    const email = field('email', 'identification.email', true);
    form.appendChild(email);

    const password = field('password', 'identification.password', true);
    form.appendChild(password);

    if (mode === 'register') {
      phone = field('tel', 'identification.phone', false);
      form.appendChild(phone);
    }

    const error = document.createElement('div');
    error.className = 'cb-lead-error';
    error.hidden = true;
    form.appendChild(error);

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'cb-cta';
    submit.textContent = i18n.t(mode === 'login' ? 'identification.loginButton' : 'identification.registerButton');
    form.appendChild(submit);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailValue = email.value.trim();
      const passwordValue = password.value;
      if (!emailValue || !passwordValue) { error.textContent = i18n.t('wishlist.authError'); error.hidden = false; return; }
      error.hidden = true;
      submit.disabled = true;

      const onError = () => {
        submit.disabled = false;
        error.textContent = i18n.t('wishlist.authError');
        error.hidden = false;
      };

      const request = mode === 'login'
        ? api.guestLogin(organizationId, emailValue, passwordValue)
        : api.guestRegister(organizationId, {
            email: emailValue,
            password: passwordValue,
            firstName: firstName?.value.trim() || undefined,
            lastName: lastName?.value.trim() || undefined,
            phone: phone?.value.trim() || undefined,
          });

      request.then((result) => onSuccess(result, emailValue)).catch(onError);
    });

    card.appendChild(form);

    const switchRow = document.createElement('div');
    switchRow.className = 'cb-auth-switch';
    const switchBtn = document.createElement('button');
    switchBtn.type = 'button';
    switchBtn.textContent = i18n.t(mode === 'login' ? 'identification.noAccount' : 'identification.hasAccount');
    switchBtn.addEventListener('click', () => {
      mode = mode === 'login' ? 'register' : 'login';
      render();
    });
    switchRow.appendChild(switchBtn);
    card.appendChild(switchRow);
  };

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  return {
    requireAuth(then: () => void) {
      if (state.get().guestToken) { then(); return; }
      pendingAction = then;
      mode = 'login';
      render();
      overlay.hidden = false;
    },
    destroy() {
      overlay.remove();
    },
  };
}
