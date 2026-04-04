import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import { API_CONFIG } from '../../config/api';
import {
  DOMNode,
  PreviewInspectorProps,
  WidgetPositionConfig,
  ViewportPreset,
  RESPONSIVE_PRESETS,
} from './components/inspector/types';
import { getComputedStylesFiltered } from './components/inspector/helpers';
import { useCSSOverrides } from './components/inspector/useCSSOverrides';
import { useElementInspector } from './components/inspector/useElementInspector';
import ViewportToolbar from './components/inspector/ViewportToolbar';
import WidgetPositionConfigPanel, { SectionTarget } from './components/inspector/WidgetPositionConfig';
import DOMTreePanel from './components/inspector/DOMTreePanel';
import StyleInspectorPanel from './components/inspector/StyleInspectorPanel';
import FakeSiteContent from './components/inspector/FakeSiteContent';

// Re-export types for external consumers
export type { PreviewInspectorProps, WidgetPositionConfig };

// ─── PreviewInspector (layout orchestrator) ─────────────────────────────────

const PreviewInspector: React.FC<PreviewInspectorProps> = ({
  children,
  onCssChange,
  onClose,
  initialSiteUrl,
  initialWidgetPosition,
  onWidgetPositionChange,
}) => {
  const previewRef = useRef<HTMLDivElement>(null);

  // ── Viewport state ──
  const [inspectMode, setInspectMode] = useState(false);
  const [viewport, setViewport] = useState<ViewportPreset>('full');
  const [siteUrl, setSiteUrl] = useState(initialSiteUrl ?? '');
  const [snapshotHtml, setSnapshotHtml] = useState<string | null>(null);
  const [siteLoading, setSiteLoading] = useState(false);
  const [widgetPage, setWidgetPage] = useState<string>('search');

  // Debounce site URL — fetch static snapshot after typing stops
  useEffect(() => {
    const trimmed = siteUrl.trim();
    if (!trimmed) {
      setSnapshotHtml(null);
      setSiteLoading(false);
      return;
    }
    // Only proceed if URL looks like a valid domain (has at least one dot + 2 chars TLD)
    const urlWithProtocol = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    const hasValidDomain = /^https?:\/\/[^/]+\.[a-z]{2,}/i.test(urlWithProtocol);
    if (!hasValidDomain) return;

    setSiteLoading(true);
    const timer = setTimeout(async () => {
      try {
        const resp = await fetch(
          `${API_CONFIG.BASE_URL}/api/public/preview-proxy/snapshot?url=${encodeURIComponent(urlWithProtocol)}`
        );
        if (resp.ok) {
          const html = await resp.text();
          setSnapshotHtml(html.length > 100 ? html : null);
        } else {
          setSnapshotHtml(null);
        }
      } catch {
        setSnapshotHtml(null);
      } finally {
        setSiteLoading(false);
      }
    }, 1500);
    return () => { clearTimeout(timer); setSiteLoading(false); };
  }, [siteUrl]);
  const [panelOpen, setPanelOpen] = useState(true);

  // ── Widget position state ──
  const [widgetPosition, setWidgetPositionLocal] = useState<'bottom' | 'top' | 'inline'>(
    initialWidgetPosition?.widgetPosition ?? 'bottom',
  );
  const [inlineTargetId, setInlineTargetIdLocal] = useState(
    initialWidgetPosition?.inlineTargetId ?? 'hebergements',
  );
  const [inlinePlacement, setInlinePlacementLocal] = useState<'before' | 'after'>(
    (initialWidgetPosition?.inlinePlacement as 'before' | 'after') ?? 'after',
  );

  const setWidgetPosition = useCallback((v: 'bottom' | 'top' | 'inline') => {
    setWidgetPositionLocal(v);
    onWidgetPositionChange?.({ widgetPosition: v, inlineTargetId, inlinePlacement });
  }, [inlineTargetId, inlinePlacement, onWidgetPositionChange]);

  const setInlineTargetId = useCallback((v: string) => {
    setInlineTargetIdLocal(v);
    onWidgetPositionChange?.({ widgetPosition, inlineTargetId: v, inlinePlacement });
  }, [widgetPosition, inlinePlacement, onWidgetPositionChange]);

  const setInlinePlacement = useCallback((v: 'before' | 'after') => {
    setInlinePlacementLocal(v);
    onWidgetPositionChange?.({ widgetPosition, inlineTargetId, inlinePlacement: v });
  }, [widgetPosition, inlineTargetId, onWidgetPositionChange]);

  // ── iframe DOM tree via postMessage bridge ──
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeDomTree, setIframeDomTree] = useState<DOMNode | null>(null);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || !e.data.type) return;
      if (e.data.type === 'preview-dom-tree' && e.data.tree) {
        // Convert the flat tree from iframe to DOMNode[] format
        const convert = (node: { tag: string; id: string; cls: string; text: string; children: unknown[]; rect: { t: number; l: number; w: number; h: number } | null }, depth: number, parentPath: string): DOMNode | null => {
          if (!node || !node.tag) return null;
          const label = node.tag + (node.id ? '#' + node.id : '') + (node.cls ? '.' + node.cls.split(' ')[0] : '');
          const path = parentPath ? parentPath + ' > ' + label : label;
          const children: DOMNode[] = [];
          if (node.children) {
            for (const child of node.children as typeof node[]) {
              const c = convert(child, depth + 1, path);
              if (c) children.push(c);
            }
          }
          return {
            tag: node.tag,
            classes: node.cls ? node.cls.split(' ').filter(Boolean) : [],
            id: node.id || '',
            path,
            element: document.createElement('div'), // placeholder — not accessible cross-origin
            children,
            depth,
          };
        };
        const root = convert(e.data.tree, 0, '');
        setIframeDomTree(root);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // ── Extract section targets from the snapshot DOM tree ──
  const extractSectionTargets = useCallback((tree: DOMNode | null): SectionTarget[] => {
    if (!tree) return [];
    const targets: SectionTarget[] = [];
    const LANDMARK_TAGS = new Set(['section', 'header', 'main', 'footer', 'nav', 'aside', 'article']);

    const walk = (node: DOMNode, parentIndex: Map<string, number>) => {
      const tag = node.tag.toLowerCase();
      const isLandmark = LANDMARK_TAGS.has(tag);
      const hasId = Boolean(node.id);

      if (isLandmark || hasId) {
        let selector: string;
        let label: string;

        if (hasId) {
          selector = `#${node.id}`;
          label = `#${node.id}`;
        } else {
          // Build nth-of-type selector for sections without id
          const count = parentIndex.get(tag) ?? 0;
          parentIndex.set(tag, count + 1);
          const cls0 = node.classes[0] || '';
          if (cls0) {
            selector = `${tag}.${cls0}`;
            label = `<${tag}.${cls0}>`;
          } else {
            selector = `${tag}:nth-of-type(${count + 1})`;
            label = `<${tag}:nth-of-type(${count + 1})>`;
          }
        }

        targets.push({ selector, label });
      }

      // Recurse children (max depth 4 to avoid noise)
      if (node.depth < 4) {
        const childIndex = new Map<string, number>();
        for (const child of node.children) {
          walk(child, childIndex);
        }
      }
    };

    const rootIndex = new Map<string, number>();
    walk(tree, rootIndex);
    return targets;
  }, []);

  const sectionTargets = React.useMemo(
    () => extractSectionTargets(iframeDomTree),
    [iframeDomTree, extractSectionTargets],
  );

  // Auto-select first section when targets change
  useEffect(() => {
    if (sectionTargets.length > 0 && !sectionTargets.some(s => s.selector === inlineTargetId)) {
      setInlineTargetId(sectionTargets[0].selector);
    }
  }, [sectionTargets, inlineTargetId, setInlineTargetId]);

  // ── Inline widget placeholder position from iframe ──
  const [inlinePlaceholderRect, setInlinePlaceholderRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  // Listen for placeholder position updates from iframe bridge
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'preview-placeholder-rect') {
        setInlinePlaceholderRect(e.data.rect ?? null);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Send inline placement config to iframe bridge
  useEffect(() => {
    if (!iframeRef.current?.contentWindow || !snapshotHtml) return;
    if (widgetPosition === 'inline') {
      iframeRef.current.contentWindow.postMessage({
        type: 'preview-set-inline',
        selector: inlineTargetId,
        placement: inlinePlacement,
      }, '*');
    } else {
      iframeRef.current.contentWindow.postMessage({
        type: 'preview-set-inline',
        selector: null,
      }, '*');
      setInlinePlaceholderRect(null);
    }
  }, [snapshotHtml, widgetPosition, inlineTargetId, inlinePlacement]);

  // Send inspect mode state to iframe
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage({ type: 'preview-set-inspect', enabled: inspectMode }, '*');
  }, [inspectMode]);

  // Send highlight request to iframe on tree hover
  const handleIframeTreeHover = useCallback((node: DOMNode | null) => {
    if (!iframeRef.current?.contentWindow) return;
    if (!node) {
      iframeRef.current.contentWindow.postMessage({ type: 'preview-highlight', selector: null }, '*');
      return;
    }
    // Build a CSS selector from the node
    let selector = node.tag;
    if (node.id) selector += '#' + node.id;
    else if (node.classes.length > 0) selector += '.' + node.classes[0];
    iframeRef.current.contentWindow.postMessage({ type: 'preview-highlight', selector }, '*');
  }, []);

  // ── CSS overrides hook ──
  const cssOverrides = useCSSOverrides({ previewRef, onCssChange });

  // ── Element inspector hook ──
  const inspector = useElementInspector({
    previewRef,
    inspectMode: snapshotHtml ? false : inspectMode, // Disable local inspect when iframe is loaded
    overrides: cssOverrides.overrides,
    onElementSelected: (existingCss) => cssOverrides.setCustomCssText(existingCss),
  });

  // ── Style edit handler (refreshes computed styles after override) ──
  const handleStyleEdit = useCallback((property: string, value: string) => {
    if (!inspector.selectedInfo) return;
    cssOverrides.applyOverride(property, value, inspector.selectedInfo);
    setTimeout(() => {
      inspector.setSelectedInfo((prev) =>
        prev ? { ...prev, computedStyles: getComputedStylesFiltered(prev.element) } : null,
      );
    }, 50);
  }, [inspector, cssOverrides]);

  const handleApplyCustomCss = useCallback(() => {
    if (!inspector.selectedInfo) return;
    cssOverrides.applyCustomCssBlock(inspector.selectedInfo);
    setTimeout(() => {
      inspector.setSelectedInfo((prev) =>
        prev ? { ...prev, computedStyles: getComputedStylesFiltered(prev.element) } : null,
      );
    }, 50);
  }, [inspector, cssOverrides]);

  const handleToggleInspect = useCallback(() => {
    setInspectMode((prev) => !prev);
  }, []);

  // ── Compute widget order for flex layout ──
  const isWidgetFullPage = widgetPage !== 'search';
  const sectionOrders: Record<string, number> = { hero: 2, hebergements: 4, 'a-propos': 6, avis: 8, footer: 10 };
  const inlineOrder = (() => {
    const baseOrder = sectionOrders[inlineTargetId] ?? 4;
    return inlinePlacement === 'before' ? baseOrder - 1 : baseOrder + 1;
  })();
  const widgetOrder = isWidgetFullPage ? 0
    : widgetPosition === 'top' ? 1
    : widgetPosition === 'bottom' ? 99
    : inlineOrder;

  const presetWidth = RESPONSIVE_PRESETS[viewport].width;

  return (
    <Box sx={{ display: 'flex', height: '100%', bgcolor: '#0f1117', overflow: 'hidden' }}>
      {/* ── Preview Zone ── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ViewportToolbar
          inspectMode={inspectMode}
          onToggleInspect={handleToggleInspect}
          viewport={viewport}
          onViewportChange={setViewport}
          historyIdx={cssOverrides.historyIdx}
          historyLength={cssOverrides.historyLength}
          onUndo={cssOverrides.undo}
          onRedo={cssOverrides.redo}
          overrides={cssOverrides.overrides}
          onCssChange={onCssChange}
          panelOpen={panelOpen}
          onTogglePanel={() => setPanelOpen(prev => !prev)}
          onClose={onClose}
        />

        {/* Preview area */}
        <Box sx={{
          flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
          overflow: 'auto', bgcolor: '#1a1d27',
        }}>
          <Box sx={{
            position: 'relative',
            width: typeof presetWidth === 'number' ? presetWidth : '100%',
            maxWidth: '100%',
            minHeight: '100%',
            transition: 'width 0.3s ease',
            boxShadow: '0 0 40px rgba(0,0,0,0.3)',
            bgcolor: '#fff',
          }}>
            <Box sx={{
              position: 'relative', display: 'flex', flexDirection: 'column', minHeight: '100%',
            }}>
              {/* Widget area — overlays the iframe when a real site is loaded */}
              <Box
                ref={previewRef}
                onMouseMove={inspector.handleMouseMove}
                onClickCapture={inspectMode ? inspector.handleClick : undefined}
                sx={{
                  cursor: inspectMode ? 'crosshair' : 'default',
                  zIndex: 10,
                  ...(isWidgetFullPage
                    ? { flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }
                    : snapshotHtml
                      ? (widgetPosition === 'inline' && inlinePlaceholderRect
                        // Inline mode with placeholder position → overlay at exact position
                        ? {
                            position: 'absolute',
                            top: inlinePlaceholderRect.top,
                            left: inlinePlaceholderRect.left,
                            width: inlinePlaceholderRect.width,
                            zIndex: 20,
                          }
                        // Top/bottom with real site → fixed overlay
                        : {
                            position: 'fixed',
                            left: 0,
                            right: panelOpen ? 320 : 0,
                            ...(widgetPosition === 'top' ? { top: 36 } : { bottom: 0 }),
                            zIndex: 20,
                            transition: 'right 0.25s ease-in-out',
                          })
                      // Fake site → original flex layout with order
                      : widgetPosition === 'inline'
                        ? { order: inlineOrder, position: 'relative', px: 4, py: 3, maxWidth: 900, mx: 'auto', width: '100%', boxSizing: 'border-box' }
                        : {
                            order: widgetOrder,
                            position: 'sticky',
                            ...(widgetPosition === 'top' ? { top: 0 } : { bottom: 0 }),
                          }),
                }}
              >
                {React.isValidElement(children)
                  ? React.cloneElement(children as React.ReactElement<{ panelDirection?: 'up' | 'down'; onPageChange?: (p: string) => void }>, {
                      panelDirection: widgetPosition === 'top' ? 'down' : 'up',
                      onPageChange: setWidgetPage,
                    })
                  : children}

                {/* Hover overlay */}
                {inspector.hoveredInfo && inspector.containerRect && (
                  <>
                    <Box sx={{
                      position: 'fixed',
                      top: inspector.hoveredInfo.rect.top, left: inspector.hoveredInfo.rect.left,
                      width: inspector.hoveredInfo.rect.width, height: inspector.hoveredInfo.rect.height,
                      border: '2px solid #635BFF', bgcolor: 'rgba(99,91,255,0.06)',
                      pointerEvents: 'none', zIndex: 9999, borderRadius: '2px',
                      transition: 'all 0.08s ease',
                    }} />
                    <Box sx={{
                      position: 'fixed',
                      top: inspector.hoveredInfo.rect.top - 24,
                      left: inspector.hoveredInfo.rect.left,
                      bgcolor: '#1a1d27', color: '#fff', fontSize: 10, fontFamily: '"SF Mono", monospace',
                      px: 1, py: 0.25, borderRadius: '3px', pointerEvents: 'none', zIndex: 10000,
                      whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    }}>
                      {inspector.hoveredInfo.label}
                    </Box>
                  </>
                )}

                {/* Selected outline */}
                {inspector.selectedInfo && (
                  <Box sx={{
                    position: 'fixed',
                    top: inspector.selectedInfo.rect.top, left: inspector.selectedInfo.rect.left,
                    width: inspector.selectedInfo.rect.width, height: inspector.selectedInfo.rect.height,
                    border: '2px solid #E91E63', pointerEvents: 'none', zIndex: 9998, borderRadius: '2px',
                  }} />
                )}
              </Box>

              {/* Site content: real site via proxy or fake site */}
              {!isWidgetFullPage && (
                snapshotHtml ? (
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <iframe
                      ref={iframeRef}
                      srcDoc={snapshotHtml}
                      title="Site cible"
                      onLoad={() => {
                        setSiteLoading(false);
                        // Send inline placement config after iframe loads
                        if (widgetPosition === 'inline' && iframeRef.current?.contentWindow) {
                          setTimeout(() => {
                            iframeRef.current?.contentWindow?.postMessage({
                              type: 'preview-set-inline',
                              selector: inlineTargetId,
                              placement: inlinePlacement,
                            }, '*');
                          }, 600); // Wait for bridge script to initialize
                        }
                      }}
                      style={{
                        width: '100%', height: '100%', minHeight: '100vh',
                        border: 'none', display: 'block',
                      }}
                    />
                  </Box>
                ) : siteLoading ? (
                  <Box sx={{
                    order: 50, flex: 1, minHeight: 200,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Box sx={{ fontSize: 13, color: '#6b7280' }}>Chargement du site…</Box>
                  </Box>
                ) : (
                  <FakeSiteContent />
                )
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ── Inspector Panel ── */}
      <Box sx={{
        width: panelOpen ? 320 : 0, flexShrink: 0, display: 'flex', flexDirection: 'column',
        bgcolor: '#1a1d27', borderLeft: panelOpen ? '1px solid #2a2d3a' : 'none',
        overflow: 'hidden',
        transition: 'width 0.25s ease-in-out',
      }}>
        {/* Top: Elements panel */}
        <Box sx={{
          flex: '0 0 45%', minHeight: 120, overflow: 'auto',
          borderBottom: '1px solid #2a2d3a',
        }}>
          <WidgetPositionConfigPanel
            siteUrl={siteUrl}
            onSiteUrlChange={setSiteUrl}
            widgetPosition={widgetPosition}
            onWidgetPositionChange={setWidgetPosition}
            inlinePlacement={inlinePlacement}
            onInlinePlacementChange={setInlinePlacement}
            inlineTargetId={inlineTargetId}
            onInlineTargetIdChange={setInlineTargetId}
            sectionTargets={sectionTargets}
          />
          <DOMTreePanel
            domTree={iframeDomTree ?? inspector.domTree}
            selectedPath={inspector.selectedInfo?.path ?? null}
            onSelect={snapshotHtml ? ((_node: DOMNode) => {}) : inspector.handleTreeSelect}
            onHover={snapshotHtml ? handleIframeTreeHover : inspector.handleTreeHover}
          />
        </Box>

        {/* Bottom: Styles */}
        <StyleInspectorPanel
          selectedInfo={inspector.selectedInfo}
          overriddenProps={inspector.overriddenProps}
          customCssText={cssOverrides.customCssText}
          onCustomCssTextChange={cssOverrides.setCustomCssText}
          onApplyCustomCss={handleApplyCustomCss}
          onStyleEdit={handleStyleEdit}
        />
      </Box>
    </Box>
  );
};

export default PreviewInspector;
