import { useLayoutEffect, useRef, useState } from 'react';

/** Seuils du contenu disponible, après déduction de la sidebar et des marges. */
const INLINE_WIDTH = 1100;
const SEARCH_WIDTH = 820;
const ACTIONS_WIDTH = 680;

/** Traverser uniquement les enveloppes pleine largeur, jamais une colonne. */
function pageGutters(parent: HTMLElement) {
  const style = getComputedStyle(parent);
  let start = parseFloat(style.paddingInlineStart) || 0;
  let end = parseFloat(style.paddingInlineEnd) || 0;
  let top = parseFloat(style.paddingTop) || 0;
  let current = parent;
  while (current.parentElement && current.tagName !== 'MAIN') {
    const ancestor = current.parentElement;
    if (ancestor.tagName === 'BODY') break;
    const padding = getComputedStyle(ancestor);
    const outer = ancestor.getBoundingClientRect();
    const inner = current.getBoundingClientRect();
    const left = parseFloat(padding.paddingLeft) || 0;
    const right = parseFloat(padding.paddingRight) || 0;
    const above = parseFloat(padding.paddingTop) || 0;
    if (inner.width <= 0 || Math.abs(inner.left - outer.left - left) > 1
      || Math.abs(inner.right - outer.right + right) > 1
      || Math.abs(inner.top - outer.top - above) > 1) break;
    start += parseFloat(padding.paddingInlineStart) || 0;
    end += parseFloat(padding.paddingInlineEnd) || 0;
    top += above;
    current = ancestor;
  }
  return { start, end, top };
}

export function usePageHeaderLayout(anchored: boolean, contentKey = '') {
  const headerRef = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);
  const [expandedWidth, setExpandedWidth] = useState(INLINE_WIDTH);

  useLayoutEffect(() => { setExpandedWidth(INLINE_WIDTH); }, [contentKey]);

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const parent = header.parentElement;
    let frame = 0;
    let disposed = false;
    const measure = () => {
      if (anchored && parent) {
        const gutters = pageGutters(parent);
        header.style.setProperty('--page-header-gutter-start', `${gutters.start}px`);
        header.style.setProperty('--page-header-gutter-end', `${gutters.end}px`);
        header.style.setProperty('--page-header-gutter-top', `${gutters.top}px`);
      }
      const row = header.querySelector<HTMLElement>('[data-header-row]');
      if (!row?.clientWidth) return;
      setWidth(previous => previous === row.clientWidth ? previous : row.clientWidth);
      // Les traductions, dates et filtres peuvent demander plus de place.
      if (row.dataset.inline === 'true') {
        const title = row.querySelector<HTMLElement>('[data-slot="page-title"]');
        const toolbar = row.querySelector<HTMLElement>('[data-header-toolbar]');
        if (title && toolbar) {
          const children = Array.from(title.children) as HTMLElement[];
          const titleWidth = children.reduce((sum, child) => sum + child.getBoundingClientRect().width, 0)
            + Math.max(0, children.length - 1) * (parseFloat(getComputedStyle(title).columnGap) || 0)
            + Array.from(title.querySelectorAll<HTMLElement>('.truncate'))
              .reduce((sum, text) => sum + Math.max(0, text.scrollWidth - text.clientWidth), 0);
          const sidebar = row.querySelector<HTMLElement>('[data-slot="sidebar-trigger"]');
          const required = Math.max(INLINE_WIDTH, Math.ceil(titleWidth + toolbar.scrollWidth + 8 + (sidebar?.getBoundingClientRect().width || 0)));
          setExpandedWidth(previous => Math.abs(previous - required) < 2 ? previous : required);
        }
      }
    };
    const schedule = () => {
      if (disposed) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    const resize = new ResizeObserver(schedule);
    resize.observe(header);
    if (parent) resize.observe(parent);
    const changes = new MutationObserver(schedule);
    changes.observe(header, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', schedule);
    document.fonts?.ready.then(schedule);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      changes.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [anchored]);

  return {
    headerRef,
    canInlineControls: width >= expandedWidth,
    compactSearch: width < SEARCH_WIDTH,
    compactActions: width < ACTIONS_WIDTH,
  };
}
