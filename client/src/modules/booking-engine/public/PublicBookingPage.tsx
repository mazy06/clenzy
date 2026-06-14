import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { AlertTriangle } from 'lucide-react';
import { getBlockDef, parsePageLayout } from '../studio/builder/blockRegistry';
import { themeStyle } from '../studio/builder/BuilderCanvas';
import { BaitlyWidget } from '../sdk/BaitlyWidget';

/**
 * Page publique hébergée du booking engine (P0.1) — rend la PAGE COMPOSÉE dans le Studio
 * (blocs marketing en flux document) PUIS monte le widget de réservation fonctionnel
 * (BaitlyWidget, Shadow DOM) → la page est réellement bookable.
 *
 * Route /booking/:apiKey (hors auth). L'org est résolue par la clé API (X-Booking-Key) ; le
 * {slug} du chemin public est un placeholder. Rendu client (pas de SEO ; SSR = Lot 1).
 */

interface PublicBookingConfig {
  primaryColor: string;
  fontFamily: string | null;
  defaultLanguage: string;
  defaultCurrency: string;
  customCss: string | null;
  pageLayout: string | null;
}

export default function PublicBookingPage() {
  const { apiKey } = useParams<{ apiKey: string }>();
  const [config, setConfig] = useState<PublicBookingConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const widgetHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!apiKey) { setError('Clé manquante'); return; }
    let alive = true;
    fetch(`${window.location.origin}/api/public/booking/widget/config`, {
      headers: { 'X-Booking-Key': apiKey },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: PublicBookingConfig) => { if (alive) setConfig(data); })
      .catch(() => { if (alive) setError('Ce booking engine est introuvable ou indisponible.'); });
    return () => { alive = false; };
  }, [apiKey]);

  const blocks = useMemo(() => parsePageLayout(config?.pageLayout), [config?.pageLayout]);

  // Monte le widget de réservation fonctionnel une fois la config chargée.
  useEffect(() => {
    if (!config || !apiKey || !widgetHostRef.current) return;
    const widget = new BaitlyWidget({
      container: widgetHostRef.current,
      apiKey,
      theme: {
        primaryColor: config.primaryColor,
        fontFamily: config.fontFamily ?? undefined,
      },
      language: (['fr', 'en', 'ar'].includes(config.defaultLanguage) ? config.defaultLanguage : 'fr') as 'fr' | 'en' | 'ar',
      currency: config.defaultCurrency,
    });
    widget.mount();
    return () => widget.destroy();
  }, [config, apiKey]);

  if (error) {
    return (
      <Centered>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, color: 'var(--muted)' }}>
          <AlertTriangle size={32} strokeWidth={1.75} />
          <Box sx={{ fontSize: 'var(--text-md)' }}>{error}</Box>
        </Box>
      </Centered>
    );
  }

  if (!config) {
    return <Centered><CircularProgress size={28} sx={{ color: 'var(--accent)' }} /></Centered>;
  }

  return (
    <Box style={themeStyle({ primaryColor: config.primaryColor, fontFamily: config.fontFamily })}
      sx={{ minHeight: '100vh', bgcolor: 'var(--card)', color: 'var(--ink)' }}>
      {config.customCss && <style>{config.customCss}</style>}

      {/* Page composée (blocs marketing) en flux document. */}
      {blocks.map((b) => <Box key={b.id}>{getBlockDef(b.type).render(b.props)}</Box>)}

      {/* Section de réservation : widget fonctionnel (Shadow DOM, styles isolés). */}
      <Box id="reserver" sx={{ maxWidth: 1040, mx: 'auto', px: { xs: 2, md: 4 }, py: { xs: 4, md: 6 } }}>
        <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-bold)', textAlign: 'center', mb: 3 }}>
          Réservez votre séjour
        </Box>
        <Box ref={widgetHostRef} />
      </Box>
    </Box>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'var(--bg)', p: 3 }}>
      {children}
    </Box>
  );
}
