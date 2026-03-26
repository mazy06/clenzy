import type { StateManager } from '../state';
import type { WidgetState, GuestFormData } from '../types';
import { arrowLeft } from './icons';

interface I18n {
  t: (key: string) => string;
}

export function createGuestForm(state: StateManager, i18n: I18n, onSubmit: () => void): HTMLElement {
  const container = document.createElement('div');
  container.className = 'cb-page';

  // Back button
  const back = document.createElement('button');
  back.className = 'cb-back';
  back.setAttribute('type', 'button');
  back.appendChild(arrowLeft());
  const backText = document.createTextNode(` ${i18n.t('common.back')}`);
  back.appendChild(backText);
  back.addEventListener('click', () => {
    state.set({ page: 'search' }, 'pageChange');
  });
  container.appendChild(back);

  // Title
  const title = document.createElement('h3');
  title.className = 'cb-text-lg cb-text-semibold';
  title.style.marginBottom = 'var(--cb-space-5)';
  title.textContent = i18n.t('identification.yourInfo');
  container.appendChild(title);

  // Form
  const form = document.createElement('form');
  form.className = 'cb-form';
  form.setAttribute('novalidate', '');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (validateForm(state, i18n)) onSubmit();
  });

  // Name row
  const nameRow = document.createElement('div');
  nameRow.className = 'cb-form-row';

  const firstName = createInputGroup(
    'firstName',
    i18n.t('identification.firstName'),
    i18n.t('identification.firstNamePlaceholder'),
    'text',
    state,
  );
  const lastName = createInputGroup(
    'lastName',
    i18n.t('identification.lastName'),
    i18n.t('identification.lastNamePlaceholder'),
    'text',
    state,
  );

  nameRow.appendChild(firstName.el);
  nameRow.appendChild(lastName.el);
  form.appendChild(nameRow);

  // Email
  const email = createInputGroup(
    'email',
    i18n.t('identification.email'),
    i18n.t('identification.emailPlaceholder'),
    'email',
    state,
  );
  form.appendChild(email.el);

  // Phone
  const phone = createInputGroup(
    'phone',
    i18n.t('identification.phone'),
    i18n.t('identification.phonePlaceholder'),
    'tel',
    state,
  );
  form.appendChild(phone.el);

  // Message
  const message = createTextareaGroup(
    'message',
    i18n.t('identification.message'),
    i18n.t('identification.messagePlaceholder'),
    state,
  );
  form.appendChild(message.el);

  // Submit button
  const submitBtn = document.createElement('button');
  submitBtn.className = 'cb-cta';
  submitBtn.setAttribute('type', 'submit');
  submitBtn.textContent = i18n.t('common.continueToPayment');
  form.appendChild(submitBtn);

  container.appendChild(form);

  // Sync errors
  state.on('*', (s: WidgetState) => {
    firstName.setError(s.guestFormErrors.firstName);
    lastName.setError(s.guestFormErrors.lastName);
    email.setError(s.guestFormErrors.email);
    phone.setError(s.guestFormErrors.phone);
  });

  return container;
}

interface InputGroupRef {
  el: HTMLElement;
  setError: (msg?: string) => void;
}

function createInputGroup(
  field: keyof GuestFormData,
  label: string,
  placeholder: string,
  type: string,
  state: StateManager,
): InputGroupRef {
  const group = document.createElement('div');
  group.className = 'cb-input-group';

  const labelEl = document.createElement('label');
  labelEl.className = 'cb-input-label';
  labelEl.textContent = label;
  labelEl.setAttribute('for', `cb-${field}`);

  const input = document.createElement('input');
  input.className = 'cb-input';
  input.id = `cb-${field}`;
  input.type = type;
  input.placeholder = placeholder;
  input.autocomplete = field === 'firstName' ? 'given-name'
    : field === 'lastName' ? 'family-name'
    : field === 'email' ? 'email'
    : field === 'phone' ? 'tel'
    : 'off';

  input.addEventListener('input', () => {
    const formData = { ...state.get().guestForm, [field]: input.value };
    const errors = { ...state.get().guestFormErrors };
    delete errors[field];
    state.set({ guestForm: formData, guestFormErrors: errors });
  });

  const errorEl = document.createElement('span');
  errorEl.className = 'cb-input-error';
  errorEl.hidden = true;

  group.appendChild(labelEl);
  group.appendChild(input);
  group.appendChild(errorEl);

  return {
    el: group,
    setError: (msg?: string) => {
      errorEl.textContent = msg || '';
      errorEl.hidden = !msg;
      input.classList.toggle('cb-error', !!msg);
    },
  };
}

function createTextareaGroup(
  field: keyof GuestFormData,
  label: string,
  placeholder: string,
  state: StateManager,
): InputGroupRef {
  const group = document.createElement('div');
  group.className = 'cb-input-group';

  const labelEl = document.createElement('label');
  labelEl.className = 'cb-input-label';
  labelEl.textContent = label;
  labelEl.setAttribute('for', `cb-${field}`);

  const textarea = document.createElement('textarea');
  textarea.className = 'cb-input cb-textarea';
  textarea.id = `cb-${field}`;
  textarea.placeholder = placeholder;

  textarea.addEventListener('input', () => {
    const formData = { ...state.get().guestForm, [field]: textarea.value };
    state.set({ guestForm: formData });
  });

  group.appendChild(labelEl);
  group.appendChild(textarea);

  return {
    el: group,
    setError: () => {}, // message field doesn't validate
  };
}

function validateForm(state: StateManager, i18n: I18n): boolean {
  const s = state.get();
  const errors: Partial<Record<keyof GuestFormData, string>> = {};
  const required = i18n.t('common.required');

  if (!s.guestForm.firstName.trim()) errors.firstName = required;
  if (!s.guestForm.lastName.trim()) errors.lastName = required;
  if (!s.guestForm.email.trim()) {
    errors.email = required;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.guestForm.email)) {
    errors.email = i18n.t('common.invalidEmail');
  }
  if (!s.guestForm.phone.trim()) errors.phone = required;

  if (Object.keys(errors).length > 0) {
    state.set({ guestFormErrors: errors });
    return false;
  }

  return true;
}
