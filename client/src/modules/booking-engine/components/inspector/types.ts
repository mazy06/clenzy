// ─── Shared types for PreviewInspector ─────────────────────────────────────

export interface DOMNode {
  tag: string;
  classes: string[];
  id: string;
  path: string;
  element: Element;
  children: DOMNode[];
  depth: number;
}

export interface CSSOverride {
  id: string;
  selector: string;
  property: string;
  value: string;
  originalValue: string;
}

export interface SelectedElementInfo {
  element: Element;
  tag: string;
  classes: string[];
  id: string;
  path: string;
  rect: DOMRect;
  computedStyles: Record<string, string>;
}

export interface WidgetPositionConfig {
  widgetPosition: 'bottom' | 'top' | 'inline';
  inlineTargetId: string;
  inlinePlacement: 'before' | 'after';
}

export interface PreviewInspectorProps {
  children: React.ReactNode;
  onCssChange?: (css: string) => void;
  onClose?: () => void;
  initialCss?: string;
  initialWidgetPosition?: WidgetPositionConfig;
  onWidgetPositionChange?: (config: WidgetPositionConfig) => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const RESPONSIVE_PRESETS = {
  full: { width: '100%', label: 'Auto' },
  mobile: { width: 375, label: 'Mobile' },
  tablet: { width: 768, label: 'Tablet' },
  desktop: { width: 1280, label: 'Desktop' },
} as const;

export type ViewportPreset = keyof typeof RESPONSIVE_PRESETS;

/** CSS properties to show in style panel (most useful for UI inspection) */
export const STYLE_PROPERTIES = [
  'display', 'flex-direction', 'align-items', 'justify-content', 'gap',
  'width', 'height', 'min-width', 'max-width',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'color', 'background-color', 'background',
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-transform',
  'border', 'border-radius', 'box-shadow',
  'opacity', 'overflow', 'position', 'z-index',
];
