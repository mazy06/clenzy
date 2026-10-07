import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, StateManager } from '../state';
import { createGuestForm } from './GuestForm';

const i18n = { t: (key: string) => key };

function mountForm() {
  const state = new StateManager(createInitialState({ page: 'form' }));
  const submit = vi.fn(() => state.set({ loading: true }));
  const root = createGuestForm(state, i18n, submit);
  document.body.appendChild(root);
  const values = {
    firstName: 'Test', lastName: 'Baitly', email: 'test@example.com', phone: '+33000000000',
  };
  Object.entries(values).forEach(([field, value]) => {
    const input = root.querySelector<HTMLInputElement>(`#cb-${field}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const send = () => root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  return { state, submit, root, send };
}

afterEach(() => document.body.replaceChildren());

describe('Baitly guest checkout form', () => {
  it('replaces technical server failures with localized guidance', () => {
    const { state, root } = mountForm();
    state.set({ error: 'API error 500: {"error":"Erreur interne du serveur"}' });
    expect(root.querySelector('[role="alert"]')!.textContent).toBe('common.checkoutUnavailable');
  });

  it('prevents repeated submissions while checkout is pending', () => {
    const { root, submit, send } = mountForm();
    send();
    send();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(root.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('.cb-back')!.disabled).toBe(true);
    expect(root.querySelector('form')!.getAttribute('aria-busy')).toBe('true');
    expect(root.querySelector('[type="submit"]')!.textContent).toBe('common.processing');
  });

  it('shows and focuses server errors, then allows retry without losing guest details', () => {
    const { state, root, send, submit } = mountForm();
    const alert = root.querySelector<HTMLElement>('[role="alert"]')!;
    expect(alert.hidden).toBe(true);
    send();
    state.set({ loading: false, error: 'Le paiement ne peut pas être préparé.' });
    expect(alert.hidden).toBe(false);
    expect(alert.textContent).toBe('Le paiement ne peut pas être préparé.');
    expect(document.activeElement).toBe(alert);
    expect(root.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled).toBe(false);
    expect(root.querySelector<HTMLInputElement>('#cb-email')!.value).toBe('test@example.com');
    send();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(alert.hidden).toBe(true);
    expect(state.get().error).toBeNull();
  });

  it('renders server error content as text and leaves field validation in place', () => {
    const { state, root, send, submit } = mountForm();
    state.set({ error: '<img src=x onerror=alert(1)>' });
    expect(root.querySelector('[role="alert"] img')).toBeNull();
    expect(root.querySelector('[role="alert"]')!.textContent).toContain('<img');
    state.set({ guestForm: { ...state.get().guestForm, email: 'invalid' } });
    send();
    expect(submit).not.toHaveBeenCalled();
    expect(state.get().guestFormErrors.email).toBe('common.invalidEmail');
  });
});
