import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { AlertTriangle, Star } from 'lucide-react';
import { getBlockDef, parsePageLayout } from '../studio/builder/blockRegistry';
import { themeStyle } from '../studio/builder/BuilderCanvas';
import { BaitlyWidget } from '../sdk/BaitlyWidget';
import { API_CONFIG } from '../../../config/api';

// Même résolution que le reste de l'app (VITE_API_BASE_URL) : pas de proxy /api en dev.
const API_BASE = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}`;

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

interface PublicReview {
  guestName: string;
  rating: number;
  reviewText: string | null;
  hostResponse: string | null;
  reviewDate: string | null;
}
interface PublicReviews {
  stats: { averageRating: number; totalCount: number };
  reviews: PublicReview[];
}

export default function PublicBookingPage() {
  const { apiKey } = useParams<{ apiKey: string }>();
  const [config, setConfig] = useState<PublicBookingConfig | null>(null);
  const [reviews, setReviews] = useState<PublicReviews | null>(null);
  const [error, setError] = useState<string | null>(null);
  const widgetHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!apiKey) { setError('Clé manquante'); return; }
    let alive = true;
    fetch(`${API_BASE}/public/booking/widget/config`, {
      headers: { 'X-Booking-Key': apiKey },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: PublicBookingConfig) => { if (alive) setConfig(data); })
      .catch(() => { if (alive) setError('Ce booking engine est introuvable ou indisponible.'); });
    return () => { alive = false; };
  }, [apiKey]);

  // Avis publics (preuve sociale) — best-effort, n'empêche pas l'affichage de la page.
  useEffect(() => {
    if (!apiKey) return;
    let alive = true;
    fetch(`${API_BASE}/public/booking/widget/reviews?limit=6`, {
      headers: { 'X-Booking-Key': apiKey },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((data: PublicReviews) => { if (alive) setReviews(data); })
      .catch(() => { /* avis indisponibles : section masquée */ });
    return () => { alive = false; };
  }, [apiKey]);

  const blocks = useMemo(() => parsePageLayout(config?.pageLayout), [config?.pageLayout]);

  // Monte le widget de réservation fonctionnel une fois la config chargée.
  useEffect(() => {
    if (!config || !apiKey || !widgetHostRef.current) return;
    const widget = new BaitlyWidget({
      container: widgetHostRef.current,
      apiKey,
      baseUrl: API_CONFIG.BASE_URL,
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

      {/* Preuve sociale : avis publics (affichée seulement s'il y en a). */}
      {reviews && reviews.stats.totalCount > 0 && <ReviewsSection data={reviews} />}

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

function ReviewsSection({ data }: { data: PublicReviews }) {
  return (
    <Box sx={{ maxWidth: 1040, mx: 'auto', px: { xs: 2, md: 4 }, py: { xs: 4, md: 6 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 3 }}>
        <Star size={22} fill="var(--accent)" color="var(--accent)" />
        <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-bold)', color: 'var(--ink)' }}>
          {data.stats.averageRating.toFixed(1)}
        </Box>
        <Box sx={{ color: 'var(--muted)', fontSize: 'var(--text-md)' }}>· {data.stats.totalCount} avis</Box>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
        {data.reviews.map((r, i) => (
          <Box key={i} sx={{ p: 2, border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', bgcolor: 'var(--bg)' }}>
            <Box sx={{ display: 'flex', gap: 0.25, mb: 1 }}>
              {Array.from({ length: 5 }).map((_, s) => (
                <Star key={s} size={14} color="var(--accent)" fill={s < r.rating ? 'var(--accent)' : 'none'} />
              ))}
            </Box>
            {r.reviewText && (
              <Box sx={{ fontSize: 'var(--text-md)', color: 'var(--body)', lineHeight: 1.5, mb: 1 }}>{r.reviewText}</Box>
            )}
            <Box sx={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--ink)' }}>{r.guestName}</Box>
          </Box>
        ))}
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
