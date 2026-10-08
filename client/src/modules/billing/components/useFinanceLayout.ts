import { useViewportFill } from '../../../hooks/useViewportFill';
import { useDynamicPageSize } from '../../../hooks/useDynamicPageSize';

/** Mesure la place réelle sous les KPI, puis les lignes et le pied de liste. */
export function useFinanceLayout<T extends HTMLElement = HTMLElement>() {
  const [workspaceRef, height] = useViewportFill<T>({ minWidth: 0, minHeight: 160 });
  const { containerRef: listRef, pageSize } = useDynamicPageSize({
    rowSelector: ':scope > ul > li', headerSelector: '[data-finance-list-heading]',
    rowHeight: 63, headerHeight: 0, bottomChrome: 56, min: 1, max: 100, fallback: 10,
  });
  return { workspaceRef, height, listRef, pageSize };
}
