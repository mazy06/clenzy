import React, { useEffect, useState } from 'react';

/**
 * Pont tokens Signature → recharts (module Rapports).
 *
 * APPROCHE (consignée — cf. DESIGN_BASELINE §1/§3) : les attributs de
 * présentation SVG posés par recharts (fill/stroke) ne résolvent pas
 * `var(--…)`. On lit donc les tokens via `getComputedStyle` sur `<html>`,
 * et on ré-échantillonne quand `data-theme` / `data-accent` changent
 * (MutationObserver) — le dark mode et les 7 teintes d'accent sont ainsi
 * couverts sans style spécifique. Les parties HTML des charts (tooltips,
 * légendes) consomment `var(--…)` directement.
 *
 * Les fallbacks ci-dessous dupliquent les valeurs CLAIRES de
 * `theme/signature/tokens.css` (jamais d'autre source).
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
  /** Palette catégorielle de repli — uniquement des tokens (accent + sémantiques). */
  series: string[];
}

const TOKEN_FALLBACKS: Record<string, string> = {
  '--accent': '#2E8B6F',
  '--ok': '#4A9B8E',
  '--warn': '#C28A52',
  '--err': '#C97A7A',
  '--info': '#7BA3C2',
  '--airbnb': '#E0735A',
  '--booking': '#4A6B9A',
  '--line': '#E7ECEF',
  '--faint': '#98A4AB',
  '--muted': '#67757C',
  '--ink': '#15242D',
  '--card': '#FFFFFF',
  '--bg': '#F5F8F9',
};

function readToken(styles: CSSStyleDeclaration, name: string): string {
  const value = styles.getPropertyValue(name).trim();
  return value || TOKEN_FALLBACKS[name];
}

function resolveChartTokens(): ChartTokens {
  const styles = getComputedStyle(document.documentElement);
  const accent = readToken(styles, '--accent');
  const ok = readToken(styles, '--ok');
  const warn = readToken(styles, '--warn');
  const err = readToken(styles, '--err');
  const info = readToken(styles, '--info');
  return {
    accent,
    ok,
    warn,
    err,
    info,
    airbnb: readToken(styles, '--airbnb'),
    booking: readToken(styles, '--booking'),
    line: readToken(styles, '--line'),
    faint: readToken(styles, '--faint'),
    muted: readToken(styles, '--muted'),
    ink: readToken(styles, '--ink'),
    card: readToken(styles, '--card'),
    bg: readToken(styles, '--bg'),
    series: [accent, ok, info, warn, err],
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

/** Ticks d'axes : 10px, encre tertiaire (--faint). */
export const axisTick = (t: ChartTokens) => ({ fontSize: 10, fill: t.faint });

/** Tooltip de chart au pattern tooltip Signature (--ink / --bg, r8, 11.5 fw600). */
export const CHART_TOOLTIP_CONTENT_STYLE = {
  fontSize: 11.5,
  fontWeight: 600,
  borderRadius: 8,
  border: 'none',
  backgroundColor: 'var(--ink)',
  color: 'var(--bg)',
  boxShadow: 'none',
  padding: '6px 10px',
} as const;
export const CHART_TOOLTIP_LABEL_STYLE = { color: 'var(--bg)', fontWeight: 700 } as const;
export const CHART_TOOLTIP_ITEM_STYLE = { color: 'var(--bg)', padding: 0 } as const;

/** Légende 11.5px --muted (le texte par défaut recharts prend la couleur de série). */
export const renderChartLegendText = (value: React.ReactNode): React.ReactNode => (
  <span style={{ color: 'var(--muted)', fontSize: 11.5 }}>{value}</span>
);
