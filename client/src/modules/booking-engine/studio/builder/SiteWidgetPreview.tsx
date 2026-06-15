import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { AlertTriangle, Wand2 } from 'lucide-react';
import { BaitlyWidget } from '../../sdk/BaitlyWidget';
import { widgetThemeFromTokens } from '../../widgetTheme';
import { API_CONFIG } from '../../../../config/api';
import type { BookingEngineConfig, DesignTokens } from '../../../../services/api/bookingEngineApi';
import { FRAME_WIDTH } from './BuilderCanvas';
import type { Breakpoint } from '../StudioShell';

/**
 * Aperçu « Site » du Studio (volet 4) : affiche le SITE CIBLE du client (snapshot HTML auto-contenu,
 * scripts retirés, via /api/public/preview-proxy/snapshot) dans une iframe `srcDoc` (same-origin),
 * puis MONTE le vrai `BaitlyWidget` DANS le document du site à la position choisie — pour visualiser
 * le widget réellement posé sur le site, avec le thème/CSS courants.
 */

const API_BASE = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}`;

export type WidgetPlacement = 'bottom' | 'floating' | 'top';

function parseTokens(json: string | null): DesignTokens | null {
  if (!json) return null;
  try { return JSON.parse(json) as DesignTokens; } catch { return null; }
}

function styleHost(host: HTMLElement, placement: WidgetPlacement) {
  if (placement === 'floating') {
    Object.assign(host.style, {
      position: 'fixed', right: '16px', bottom: '16px', width: '360px', maxWidth: 'calc(100% - 32px)',
      zIndex: '2147483000', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.22)', background: '#fff',
    } as Partial<CSSStyleDeclaration>);
  } else {
    Object.assign(host.style, {
      maxWidth: '440px', margin: '24px auto', padding: '8px',
    } as Partial<CSSStyleDeclaration>);
  }
}

export interface SiteWidgetPreviewProps {
  config: BookingEngineConfig | null;
  breakpoint: Breakpoint;
  placement: WidgetPlacement;
}

export default function SiteWidgetPreview({ config, breakpoint, placement }: SiteWidgetPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const widgetRef = useRef<BaitlyWidget | null>(null);
  const loadedRef = useRef(false);
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = config?.sourceWebsiteUrl ?? null;
  const apiKey = config?.apiKey ?? null;
  const themeSig = useMemo(
    () => JSON.stringify([config?.primaryColor, config?.fontFamily, config?.designTokens, config?.customCss, config?.defaultCurrency, config?.defaultLanguage, placement]),
    [config?.primaryColor, config?.fontFamily, config?.designTokens, config?.customCss, config?.defaultCurrency, config?.defaultLanguage, placement],
  );

  // 1. Récupère le snapshot du site cible.
  useEffect(() => {
    if (!url) { setHtml(null); return; }
    let alive = true;
    setLoading(true); setError(null); loadedRef.current = false;
    fetch(`${API_BASE}/public/preview-proxy/snapshot?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((t) => { if (alive) { setHtml(t); setLoading(false); } })
      .catch(() => { if (alive) { setError('Impossible de capturer ce site.'); setLoading(false); } });
    return () => { alive = false; };
  }, [url]);

  // 2. (Re)monte le widget DANS l'iframe — à l'onLoad et quand le thème/placement change.
  const mountWidget = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc || !doc.body || !apiKey || !config) return;
    if (widgetRef.current) { widgetRef.current.destroy(); widgetRef.current = null; }
    doc.getElementById('__clenzy_widget_host')?.remove();

    const host = doc.createElement('div');
    host.id = '__clenzy_widget_host';
    styleHost(host, placement);
    if (placement === 'top') doc.body.prepend(host); else doc.body.appendChild(host);

    const tokens = parseTokens(config.designTokens);
    const lang = (['fr', 'en', 'ar'].includes(config.defaultLanguage) ? config.defaultLanguage : 'fr') as 'fr' | 'en' | 'ar';
    const widget = new BaitlyWidget({
      container: host,
      apiKey,
      baseUrl: API_CONFIG.BASE_URL,
      theme: widgetThemeFromTokens(config.primaryColor, config.fontFamily, tokens),
      customCss: config.customCss ?? undefined,
      language: lang,
      currency: config.defaultCurrency,
    });
    widget.mount();
    widgetRef.current = widget;
  };

  useEffect(() => {
    if (loadedRef.current) mountWidget();
    return () => { if (widgetRef.current) { widgetRef.current.destroy(); widgetRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeSig, apiKey]);

  const width = FRAME_WIDTH[breakpoint];

  if (!url) {
    return (
      <Centered>
        <Wand2 size={30} strokeWidth={1.6} />
        <Box sx={{ fontSize: 'var(--text-md)', maxWidth: 360, textAlign: 'center' }}>
          Lance d’abord <strong>Analyse du design</strong> (⌘K) avec l’URL du site du client :
          le site sera capturé ici et le widget posé dessus.
        </Box>
      </Centered>
    );
  }
  if (loading) return <Centered><CircularProgress size={26} sx={{ color: 'var(--accent)' }} /></Centered>;
  if (error || !html) {
    return (
      <Centered>
        <AlertTriangle size={28} strokeWidth={1.75} />
        <Box sx={{ fontSize: 'var(--text-md)' }}>{error ?? 'Site indisponible.'}</Box>
      </Centered>
    );
  }

  return (
    <Box sx={{ flex: 1, minWidth: 0, height: '100%', overflow: 'auto', bgcolor: 'var(--bg-2, var(--bg))', display: 'flex', justifyContent: 'center', p: breakpoint === 'desktop' ? 0 : 3 }}>
      <Box
        component="iframe"
        key={html.length}
        ref={iframeRef}
        title="Aperçu du site cible avec le widget"
        srcDoc={html}
        sandbox="allow-same-origin"
        onLoad={() => { loadedRef.current = true; mountWidget(); }}
        sx={{
          width, maxWidth: '100%', height: '100%', border: 'none', bgcolor: '#fff',
          ...(breakpoint !== 'desktop' && { my: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-card)', height: '90%' }),
        }}
      />
    </Box>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, color: 'var(--muted)', p: 3 }}>
      {children}
    </Box>
  );
}
