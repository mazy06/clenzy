import { useEffect, useMemo, useRef } from 'react';
import { Box } from '@mui/material';
import { BaitlyWidget } from '../../sdk/BaitlyWidget';
import { widgetThemeFromTokens } from '../../widgetTheme';
import { FRAME_WIDTH, themeStyle } from './BuilderCanvas';
import type { Breakpoint } from '../StudioShell';
import type { BookingEngineConfig, DesignTokens } from '../../../../services/api/bookingEngineApi';
import { API_CONFIG } from '../../../../config/api';

/**
 * Aperçu « Réservation » du Studio : monte le VRAI widget (BaitlyWidget, Shadow DOM) avec le thème
 * et le CSS custom courants — donc identique à la page publique. Sert à visualiser/valider le module
 * de réservation (et son design custom `.cb-*`) sans quitter le Studio. Remonte quand les champs
 * de thème/CSS changent ; ne dépend que de la clé publique + d'une signature des champs concernés.
 */

function parseTokens(json: string | null): DesignTokens | null {
  if (!json) return null;
  try { return JSON.parse(json) as DesignTokens; } catch { return null; }
}

export interface WidgetPreviewProps {
  config: BookingEngineConfig | null;
  breakpoint: Breakpoint;
}

export default function WidgetPreview({ config, breakpoint }: WidgetPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const apiKey = config?.apiKey;
  // Signature des champs qui influent sur le rendu du widget → remount ciblé (pas à chaque patch).
  const sig = useMemo(
    () => JSON.stringify([
      config?.primaryColor, config?.fontFamily, config?.designTokens,
      config?.customCss, config?.defaultCurrency, config?.defaultLanguage,
    ]),
    [config?.primaryColor, config?.fontFamily, config?.designTokens, config?.customCss, config?.defaultCurrency, config?.defaultLanguage],
  );

  useEffect(() => {
    if (!apiKey || !hostRef.current || !config) return;
    const tokens = parseTokens(config.designTokens);
    const lang = (['fr', 'en', 'ar'].includes(config.defaultLanguage) ? config.defaultLanguage : 'fr') as 'fr' | 'en' | 'ar';
    const widget = new BaitlyWidget({
      container: hostRef.current,
      apiKey,
      baseUrl: API_CONFIG.BASE_URL,
      theme: widgetThemeFromTokens(config.primaryColor, config.fontFamily, tokens),
      customCss: config.customCss ?? undefined,
      language: lang,
      currency: config.defaultCurrency,
    });
    widget.mount();
    return () => widget.destroy();
    // config lu via closure au remount ; déclencheurs explicites ci-dessous.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, sig]);

  const width = FRAME_WIDTH[breakpoint];

  return (
    <Box sx={{ flex: 1, minWidth: 0, height: '100%', overflowY: 'auto', bgcolor: 'var(--bg-2, var(--bg))', display: 'flex', justifyContent: 'center', p: breakpoint === 'desktop' ? 0 : 3 }}>
      <Box
        style={themeStyle(config ? { primaryColor: config.primaryColor, fontFamily: config.fontFamily, tokens: parseTokens(config.designTokens) } : undefined)}
        sx={{
          width, maxWidth: '100%', minHeight: '100%', bgcolor: 'var(--card)',
          ...(breakpoint !== 'desktop' && {
            my: 'auto', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
            border: '1px solid var(--line)', boxShadow: 'var(--shadow-card)', minHeight: 'auto',
          }),
        }}
      >
        <Box sx={{ maxWidth: 1040, mx: 'auto', px: { xs: 2, md: 4 }, py: { xs: 4, md: 6 } }}>
          <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-bold)', textAlign: 'center', mb: 3, color: 'var(--ink)' }}>
            Réservez votre séjour
          </Box>
          {apiKey ? (
            <Box ref={hostRef} />
          ) : (
            <Box sx={{ textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--text-md)', py: 6 }}>
              Génère la clé publique (onglet Diffusion) pour prévisualiser la réservation.
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
