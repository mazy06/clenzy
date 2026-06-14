import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { AlertTriangle } from 'lucide-react';
import PagePreview from '../studio/builder/PagePreview';
import { parsePageLayout } from '../studio/builder/blockRegistry';

/**
 * Page publique hébergée du booking engine (P0.1) — rend la PAGE COMPOSÉE dans le Studio,
 * visible par les voyageurs. Route /booking/:apiKey (hors auth). Réutilise PagePreview.
 *
 * L'org/config est résolue par la clé API (header X-Booking-Key) ; le {slug} du chemin public
 * est un placeholder ('widget'). Rendu client (pas de SEO) ; le SSR pour le SEO = Lot 1.
 * Le câblage fonctionnel des blocs (vrai booking) = incrément suivant.
 */

interface PublicBookingConfig {
  primaryColor: string;
  fontFamily: string | null;
  customCss: string | null;
  pageLayout: string | null;
}

export default function PublicBookingPage() {
  const { apiKey } = useParams<{ apiKey: string }>();
  const [config, setConfig] = useState<PublicBookingConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (blocks.length === 0) {
    return (
      <Centered>
        <Box sx={{ fontSize: 'var(--text-md)', color: 'var(--muted)' }}>Ce site n’est pas encore publié.</Box>
      </Centered>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'var(--bg)' }}>
      {config.customCss && <style>{config.customCss}</style>}
      <PagePreview
        blocks={blocks}
        theme={{ primaryColor: config.primaryColor, fontFamily: config.fontFamily }}
        breakpoint="desktop"
      />
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
