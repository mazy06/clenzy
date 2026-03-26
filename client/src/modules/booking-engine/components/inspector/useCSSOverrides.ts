import { useState, useCallback, useRef } from 'react';
import { CSSOverride, SelectedElementInfo } from './types';
import { ensureInspectorId, getComputedStylesFiltered, overridesToCSS } from './helpers';

interface UseCSSOverridesParams {
  previewRef: React.RefObject<HTMLDivElement | null>;
  onCssChange?: (css: string) => void;
}

interface UseCSSOverridesReturn {
  overrides: CSSOverride[];
  historyIdx: number;
  historyLength: number;
  customCssText: string;
  setCustomCssText: (text: string) => void;
  applyOverride: (property: string, value: string, selectedInfo: SelectedElementInfo) => void;
  applyCustomCssBlock: (selectedInfo: SelectedElementInfo) => void;
  undo: () => void;
  redo: () => void;
  loadExistingOverrides: (element: Element) => string;
  inspectorIdCounterRef: React.MutableRefObject<number>;
}

export function useCSSOverrides({ previewRef, onCssChange }: UseCSSOverridesParams): UseCSSOverridesReturn {
  const styleTagRef = useRef<HTMLStyleElement | null>(null);
  const inspectorIdCounterRef = useRef(0);

  const [overrides, setOverrides] = useState<CSSOverride[]>([]);
  const [history, setHistory] = useState<CSSOverride[][]>([[]]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [customCssText, setCustomCssText] = useState('');

  const injectOverrides = useCallback((ovrs: CSSOverride[]) => {
    if (!previewRef.current) return;
    if (!styleTagRef.current) {
      styleTagRef.current = document.createElement('style');
      styleTagRef.current.setAttribute('data-inspector', 'overrides');
      previewRef.current.appendChild(styleTagRef.current);
    }
    const css = overridesToCSS(ovrs);
    styleTagRef.current.textContent = css;
    onCssChange?.(css);
  }, [previewRef, onCssChange]);

  const historyIdxRef = useRef(historyIdx);
  historyIdxRef.current = historyIdx;

  const pushHistory = useCallback((newOverrides: CSSOverride[]) => {
    setOverrides(newOverrides);
    injectOverrides(newOverrides);
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIdxRef.current + 1);
      return [...trimmed, newOverrides];
    });
    setHistoryIdx((prev) => prev + 1);
  }, [injectOverrides]);

  const applyOverride = useCallback((property: string, value: string, selectedInfo: SelectedElementInfo) => {
    const iid = ensureInspectorId(selectedInfo.element, inspectorIdCounterRef);
    const selector = `[data-iid="${iid}"]`;
    const existingIdx = overrides.findIndex((o) => o.selector === selector && o.property === property);
    let newOverrides: CSSOverride[];
    if (existingIdx >= 0) {
      newOverrides = [...overrides];
      newOverrides[existingIdx] = { ...newOverrides[existingIdx], value };
    } else {
      newOverrides = [...overrides, {
        id: `${iid}-${property}`,
        selector,
        property,
        value,
        originalValue: selectedInfo.computedStyles[property] || '',
      }];
    }
    pushHistory(newOverrides);
  }, [overrides, pushHistory]);

  const applyCustomCssBlock = useCallback((selectedInfo: SelectedElementInfo) => {
    const iid = ensureInspectorId(selectedInfo.element, inspectorIdCounterRef);
    const selector = `[data-iid="${iid}"]`;
    const lines = customCssText.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//'));
    const parsed: Array<{ property: string; value: string }> = [];
    for (const line of lines) {
      const clean = line.replace(/;$/, '').trim();
      const colonIdx = clean.indexOf(':');
      if (colonIdx <= 0) continue;
      parsed.push({ property: clean.slice(0, colonIdx).trim(), value: clean.slice(colonIdx + 1).trim() });
    }
    let newOverrides = overrides.filter((o) => o.selector !== selector);
    for (const { property, value } of parsed) {
      newOverrides.push({
        id: `${iid}-${property}`,
        selector,
        property,
        value,
        originalValue: selectedInfo.computedStyles[property] || '',
      });
    }
    pushHistory(newOverrides);
  }, [customCssText, overrides, pushHistory]);

  const undo = useCallback(() => {
    if (historyIdx <= 0) return;
    const newIdx = historyIdx - 1;
    setHistoryIdx(newIdx);
    const prev = history[newIdx];
    setOverrides(prev);
    injectOverrides(prev);
  }, [historyIdx, history, injectOverrides]);

  const redo = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    const newIdx = historyIdx + 1;
    setHistoryIdx(newIdx);
    const next = history[newIdx];
    setOverrides(next);
    injectOverrides(next);
  }, [historyIdx, history, injectOverrides]);

  const loadExistingOverrides = useCallback((element: Element): string => {
    const iid = element.getAttribute('data-iid') || '';
    if (!iid) return '';
    return overrides
      .filter((o) => o.selector === `[data-iid="${iid}"]`)
      .map((o) => `  ${o.property}: ${o.value};`)
      .join('\n');
  }, [overrides]);

  return {
    overrides,
    historyIdx,
    historyLength: history.length,
    customCssText,
    setCustomCssText,
    applyOverride,
    applyCustomCssBlock,
    undo,
    redo,
    loadExistingOverrides,
    inspectorIdCounterRef,
  };
}
