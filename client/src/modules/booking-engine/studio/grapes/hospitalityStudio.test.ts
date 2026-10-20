import type { Editor } from 'grapesjs';
import { afterEach, expect, it, vi } from 'vitest';
import { registerHospitalityStudio } from './hospitalityStudio';

afterEach(() => document.body.replaceChildren());

it('routes a property CTA before the canvas cancels links and carries its selection', () => {
  document.body.innerHTML = '<main data-baitly-template="baitly-atlas"><a href="/reserver?clenzy_property=81">Choisir mes dates</a></main>';
  const handlers = new Map<string, (event?: { id: string }) => void>();
  const editor = {
    Canvas: { getDocument: () => document },
    Commands: { isActive: () => false },
    DomComponents: { addType: vi.fn() },
    on: (event: string, handler: (event?: { id: string }) => void) => handlers.set(event, handler),
  } as unknown as Editor;
  const navigate = vi.fn().mockReturnValue(true);
  const cancelDefault = (event: Event) => event.preventDefault();
  document.addEventListener('click', cancelDefault, true);
  registerHospitalityStudio(editor, navigate);
  handlers.get('command:run')!({ id: 'core:preview' });
  const suppress = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
  document.body.addEventListener('click', suppress);
  document.querySelector('a')!.click();
  expect(navigate).toHaveBeenCalledWith('/reserver', '', '?clenzy_property=81');
  document.body.removeEventListener('click', suppress);
  document.querySelector('main')!.dispatchEvent(new CustomEvent('baitly:navigate', { bubbles: true, detail: { path: '/logements/81?clenzy_property=81' } }));
  expect(navigate).toHaveBeenLastCalledWith('/logements/81', '', '?clenzy_property=81');
  handlers.get('destroy')!();
  document.removeEventListener('click', cancelDefault, true);
});
