import { useState, useCallback, useEffect, useMemo } from 'react';
import { DOMNode, SelectedElementInfo, CSSOverride } from './types';
import { buildCSSPath, getComputedStylesFiltered, buildDOMTree } from './helpers';

interface HoveredInfo {
  rect: DOMRect;
  label: string;
}

interface UseElementInspectorParams {
  previewRef: React.RefObject<HTMLDivElement | null>;
  inspectMode: boolean;
  overrides: CSSOverride[];
  onElementSelected?: (existingCss: string) => void;
}

interface UseElementInspectorReturn {
  hoveredInfo: HoveredInfo | null;
  selectedInfo: SelectedElementInfo | null;
  setSelectedInfo: React.Dispatch<React.SetStateAction<SelectedElementInfo | null>>;
  domTree: DOMNode | null;
  containerRect: DOMRect | undefined;
  overriddenProps: Set<string>;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleClick: (e: React.MouseEvent) => void;
  handleTreeSelect: (node: DOMNode) => void;
  handleTreeHover: (node: DOMNode | null) => void;
}

export function useElementInspector({
  previewRef,
  inspectMode,
  overrides,
  onElementSelected,
}: UseElementInspectorParams): UseElementInspectorReturn {
  const [hoveredInfo, setHoveredInfo] = useState<HoveredInfo | null>(null);
  const [selectedInfo, setSelectedInfo] = useState<SelectedElementInfo | null>(null);
  const [domTree, setDomTree] = useState<DOMNode | null>(null);

  // Build DOM tree on mount
  const rebuildTree = useCallback(() => {
    if (!previewRef.current) return;
    let target: Element | null = previewRef.current.firstElementChild;
    if (target?.firstElementChild && target.children.length <= 2) {
      target = target.firstElementChild;
    }
    if (target) {
      setDomTree(buildDOMTree(target));
    }
  }, [previewRef]);

  // Rebuild tree on mount + observe DOM mutations to keep it in sync
  useEffect(() => {
    const timer = setTimeout(rebuildTree, 500);

    // Observe subtree changes (page navigation, dynamic content)
    const el = previewRef.current;
    if (!el) return () => clearTimeout(timer);

    const observer = new MutationObserver(() => {
      // Debounce rebuilds
      clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(rebuildTree, 300);
    });
    let rebuildTimer: ReturnType<typeof setTimeout>;

    observer.observe(el, { childList: true, subtree: true });

    return () => {
      clearTimeout(timer);
      clearTimeout(rebuildTimer);
      observer.disconnect();
    };
  }, [rebuildTree, previewRef]);

  const loadExistingCss = useCallback((element: Element): string => {
    const iid = element.getAttribute('data-iid') || '';
    if (!iid) return '';
    return overrides
      .filter((o) => o.selector === `[data-iid="${iid}"]`)
      .map((o) => `  ${o.property}: ${o.value};`)
      .join('\n');
  }, [overrides]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!inspectMode || !previewRef.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || !previewRef.current.contains(el) || el === previewRef.current || el === previewRef.current.firstElementChild) {
      setHoveredInfo(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    const tag = el.tagName.toLowerCase();
    const classes = [...el.classList].filter((c) => !c.startsWith('css-') && !c.startsWith('Mui'));
    const label = `${tag}${classes.length > 0 ? `.${classes[0]}` : ''} — ${Math.round(rect.width)}×${Math.round(rect.height)}`;
    setHoveredInfo({ rect, label });
  }, [inspectMode, previewRef]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!inspectMode || !previewRef.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || !previewRef.current.contains(el) || el === previewRef.current) return;
    if (el === previewRef.current.firstElementChild) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = el.getBoundingClientRect();
    const tag = el.tagName.toLowerCase();
    const classes = [...el.classList].filter((c) => !c.startsWith('css-') && !c.startsWith('Mui'));

    onElementSelected?.(loadExistingCss(el));
    setSelectedInfo({
      element: el,
      tag,
      classes,
      id: el.id || '',
      path: buildCSSPath(el),
      rect,
      computedStyles: getComputedStylesFiltered(el),
    });
    setHoveredInfo(null);
  }, [inspectMode, previewRef, overrides, onElementSelected, loadExistingCss]);

  const handleTreeSelect = useCallback((node: DOMNode) => {
    const rect = node.element.getBoundingClientRect();
    node.element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    onElementSelected?.(loadExistingCss(node.element));
    setSelectedInfo({
      element: node.element,
      tag: node.tag,
      classes: node.classes,
      id: node.id,
      path: node.path,
      rect,
      computedStyles: getComputedStylesFiltered(node.element),
    });
  }, [onElementSelected, loadExistingCss]);

  const handleTreeHover = useCallback((node: DOMNode | null) => {
    if (!node) { setHoveredInfo(null); return; }
    const rect = node.element.getBoundingClientRect();
    const label = `${node.tag}${node.classes.length > 0 ? `.${node.classes[0]}` : ''} — ${Math.round(rect.width)}×${Math.round(rect.height)}`;
    setHoveredInfo({ rect, label });
  }, []);

  const containerRect = previewRef.current?.getBoundingClientRect();

  const overriddenProps = useMemo(() => {
    if (!selectedInfo) return new Set<string>();
    const iid = selectedInfo.element.getAttribute('data-iid');
    if (!iid) return new Set<string>();
    return new Set(overrides.filter((o) => o.selector === `[data-iid="${iid}"]`).map((o) => o.property));
  }, [selectedInfo, overrides]);

  return {
    hoveredInfo,
    selectedInfo,
    setSelectedInfo,
    domTree,
    containerRect,
    overriddenProps,
    handleMouseMove,
    handleClick,
    handleTreeSelect,
    handleTreeHover,
  };
}
