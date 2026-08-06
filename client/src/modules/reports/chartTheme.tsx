import React, { useEffect, useState } from 'react';

/**
 * Pont palette Baitly UI → recharts (module Rapports).
 *
 * APPROCHE (consignée — cf. DESIGN_BASELINE §1/§3) : les attributs de
 * présentation SVG posés par recharts (fill/stroke) ne résolvent pas
 * `var(--…)`. On lit donc les tokens via `getComputedStyle` sur `<html>`,
 * et on ré-échantillonne quand `data-theme` / `data-accent` changent
 * (MutationObserver) — le dark mode et les 7 teintes d'accent sont ainsi
 * couverts sans style spécifique. Les parties HTML des charts (tooltips,
 * légendes) consomment `var(--…)` directement.
 *
 * Les teintes sémantiques sont les VIVES (`--bui-success`…) et non les `-ink` :
 * un aplat de série ou un trait de courbe n'est pas du texte. Les couleurs de
 * canal (`--airbnb`, `--booking`) restent hors palette : ce sont des couleurs
 * de marque, pas de la sémantique.
 *
 * Les fallbacks ci-dessous dupliquent les valeurs CLAIRES de
 * `theme/baitly-ui.css` (jamais d'autre source), sauf les canaux qui viennent
 * de `theme/signature/tokens.css`.
 */

export interface ChartTokens {
  accent: string;
  ok: string;
  warn: string;
  err: string;
  info: string;
  airbnb: string;
  booking: string;
  line: string;
  faint: string;
  muted: string;
  ink: string;
  card: string;
  bg: string;
  /** Palette catégorielle : les 5 séries dédiées de Baitly UI. */
  series: string[];
}

const TOKEN_FALLBACKS: Record<string, string> = {
  '--bui-primary': '#1B2A35',
  '--bui-success': '#14B8A6',
  '--bui-warning': '#D4A574',
  '--bui-destructive': '#C97A7A',
  '--bui-info': '#2563EB',
  '--airbnb': '#E0735A',
  '--booking': '#4A6B9A',
  '--bui-border': '#E2E8F0',
  '--bui-faint': '#94A7B8',
  '--bui-muted-foreground': '#5F7382',
  '--bui-foreground': '#1B2A35',
  '--bui-card': '#FBFCFD',
  '--bui-background': '#F4F7F9',
  '--bui-chart-1': '#2563EB',
  '--bui-chart-2': '#14B8A6',
  '--bui-chart-3': '#1B2A35',
  '--bui-chart-4': '#D4A574',
  '--bui-chart-5': '#C97A7A',
};

function readToken(styles: CSSStyleDeclaration, name: string): string {
  const value = styles.getPropertyValue(name).trim();
  return value || TOKEN_FALLBACKS[name];
}

function resolveChartTokens(): ChartTokens {
  const styles = getComputedStyle(document.documentElement);
  return {
    accent: readToken(styles, '--bui-primary'),
    ok: readToken(styles, '--bui-success'),
    warn: readToken(styles, '--bui-warning'),
    err: readToken(styles, '--bui-destructive'),
    info: readToken(styles, '--bui-info'),
    airbnb: readToken(styles, '--airbnb'),
    booking: readToken(styles, '--booking'),
    line: readToken(styles, '--bui-border'),
    faint: readToken(styles, '--bui-faint'),
    muted: readToken(styles, '--bui-muted-foreground'),
    ink: readToken(styles, '--bui-foreground'),
    card: readToken(styles, '--bui-card'),
    bg: readToken(styles, '--bui-background'),
    series: [1, 2, 3, 4, 5].map((n) => readToken(styles, `--bui-chart-${n}`)),
  };
}

/** Tokens résolus en valeurs concrètes pour les SVG recharts (réactif thème/accent). */
export function useChartTokens(): ChartTokens {
  const [tokens, setTokens] = useState<ChartTokens>(resolveChartTokens);

  useEffect(() => {
    const observer = new MutationObserver(() => setTokens(resolveChartTokens()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-accent'],
    });
    return () => observer.disconnect();
  }, []);

  return tokens;
}

// ─── Helpers recharts (SVG → valeurs résolues, HTML → var()) ────────────────

/** Ticks d'axes : 10px, encre tertiaire. */
export const axisTick = (t: ChartTokens) => ({ fontSize: 10, fill: t.faint });

/** Tooltip de chart : encre inversée (foreground sur background), r8, 11.5 fw600. */
export const CHART_TOOLTIP_CONTENT_STYLE = {
  fontSize: 11.5,
  fontWeight: 600,
  borderRadius: 8,
  border: 'none',
  backgroundColor: 'var(--bui-foreground)',
  color: 'var(--bui-background)',
  boxShadow: 'none',
  padding: '6px 10px',
} as const;
export const CHART_TOOLTIP_LABEL_STYLE = { color: 'var(--bui-background)', fontWeight: 700 } as const;
export const CHART_TOOLTIP_ITEM_STYLE = { color: 'var(--bui-background)', padding: 0 } as const;

/** Légende 11.5px en encre secondaire (le texte recharts prend sinon la couleur de série). */
export const renderChartLegendText = (value: React.ReactNode): React.ReactNode => (
  <span style={{ color: 'var(--bui-muted-foreground)', fontSize: 11.5 }}>{value}</span>
);
