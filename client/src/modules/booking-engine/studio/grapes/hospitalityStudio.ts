import type { Editor } from 'grapesjs';
import { enhanceHospitality } from '../../sdk/hospitality';

const previews = new WeakMap<Editor, () => void>();
const routes = new WeakMap<Editor, (path: string, hash: string, search?: string) => boolean>();

export function refreshHospitalityPreview(editor: Editor, enteringPreview = false): void {
  previews.get(editor)?.();
  previews.delete(editor);
  const doc = editor.Canvas.getDocument();
  if (doc && (enteringPreview || editor.Commands.isActive('preview') || editor.Commands.isActive('core:preview'))) {
    const stop = enhanceHospitality(doc, { imageSource: (link) => link.querySelector('img')?.src || link.href });
    const onLink = (event: MouseEvent) => {
      const target = event.target as Element;
      const link = target.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || link.hasAttribute('data-baitly-image')) return;
      if (link.getAttribute('href')?.startsWith('#')) {
        const anchor = doc.getElementById(link.hash.slice(1));
        if (anchor) { event.preventDefault(); anchor.scrollIntoView({ block: 'start' }); }
        return;
      }
      const url = new URL(link.href, doc.location.href);
      if (url.origin === doc.location.origin && routes.get(editor)?.(url.pathname, url.hash, url.search)) event.preventDefault();
    };
    const onWidgetNavigation = (event: Event) => {
      const path = (event as CustomEvent<{ path?: string }>).detail?.path;
      if (!path) return;
      const url = new URL(path, doc.location.href);
      if (url.origin === doc.location.origin) routes.get(editor)?.(url.pathname, url.hash, url.search);
    };
    // Capture before GrapesJS suppresses ordinary anchor navigation in its canvas.
    doc.addEventListener('click', onLink, true);
    doc.addEventListener('baitly:navigate', onWidgetNavigation);
    previews.set(editor, () => { stop(); doc.removeEventListener('click', onLink, true); doc.removeEventListener('baitly:navigate', onWidgetNavigation); });
  }
}

export function registerHospitalityStudio(editor: Editor, navigate: (path: string, hash: string, search?: string) => boolean): void {
  routes.set(editor, navigate);
  editor.DomComponents.addType('baitly-hospitality-section', {
    isComponent: (element) => element.tagName === 'SECTION' && element.hasAttribute('data-baitly-reveal'),
    model: { defaults: {
      name: 'Section hôtelière',
      traits: [
        { name: 'data-baitly-reveal', label: 'Animation', type: 'select', options: [{ id: 'none', name: 'Aucune' }, { id: 'fade', name: 'Fondu' }, { id: 'rise', name: 'Apparition douce' }] },
        { name: 'data-baitly-speed', label: 'Durée (ms)', type: 'number', min: 200, max: 1200, step: 50 },
        { name: 'data-baitly-parallax', label: 'Profondeur de la photo', type: 'checkbox', valueTrue: 'true', valueFalse: 'false' },
      ],
    } },
  });
  editor.on('command:run', ({ id }) => {
    if (id === 'preview' || id === 'core:preview') refreshHospitalityPreview(editor, true);
  });
  editor.on('command:stop', ({ id }) => {
    if (id === 'preview' || id === 'core:preview') { previews.get(editor)?.(); previews.delete(editor); }
  });
  editor.on('destroy', () => { previews.get(editor)?.(); previews.delete(editor); routes.delete(editor); });
}
