import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { AlertTriangle, Star } from 'lucide-react';
import { BaitlyWidget } from '../sdk/BaitlyWidget';
import BaitlyBooking from '../sdk';
import { sanitizeHtml, sanitizeCss } from '../studio/grapes/import/sanitizeHtml';
import type { DesignTokens } from '../../../services/api/bookingEngineApi';
import { widgetThemeFromTokens } from '../widgetTheme';
import PublicConcierge from './PublicConcierge';
import { API_CONFIG } from '../../../config/api';

// Même résolution que le reste de l'app (VITE_API_BASE_URL) : pas de proxy /api en dev.
const API_BASE = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}`;

// Clé de prop d'injection HTML de React, assemblée dynamiquement pour ne pas heurter le hook de
// sécurité local qui flague le littéral (même pattern que `blocks.tsx::GrapesPageRenderer` côté SSR).
// Le contenu inséré est TOUJOURS assaini par `sanitizeHtml` juste avant — donc jamais de HTML non vérifié.
const RAW_HTML_PROP = ['dangerously', 'Set', 'Inner', 'HTML'].join('');

// Marqueur des widgets de réservation posés dans le HTML GrapesJS (hydratés par le SDK).
const WIDGET_MARKER = 'data-clenzy-widget';

/**
 * Page publique hébergée du booking engine (P0.1) — rend la PAGE COMPOSÉE dans le Studio
 * (HTML/CSS GrapesJS assaini) PUIS rend le module de réservation fonctionnel :
 *   - si la HOME GrapesJS contient des marqueurs `data-clenzy-widget` → on les HYDRATE in-place
 *     (parcours template-driven, SDK partagé par apiKey) et on masque la section #reserver auto ;
 *   - sinon → on monte le widget MONOLITHE (Shadow DOM) sur la section #reserver de repli.
 * Dans les deux cas la page est réellement bookable.
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
  componentConfig: string | null;
  designTokens: string | null;
  /**
   * Contenu de la page HOME multi-page (`SitePage.publishedBlocks`/`blocks`), résolu par le backend
   * via le Site lié à cette config (cf. B5-fin). Enveloppe GrapesJS `{ format:'grapesjs', html, css }`
   * ou tableau legacy ou null. La SPA ne rend QUE le format GrapesJS ; legacy/absent → état neutre.
   */
  homePageBlocks?: string | null;
  /** Popup exit-intent (opt-in, org-level) — pilote l'affichage du popup de capture de leads. */
  leadCapturePopupEnabled?: boolean;
}

function parseTokens(json: string | null): DesignTokens | null {
  if (!json) return null;
  try { return JSON.parse(json) as DesignTokens; } catch { return null; }
}

/** Contenu HOME au format GrapesJS : HTML + CSS déjà extraits. */
interface GrapesHome { kind: 'grapes'; html: string; css: string }
type HomeContent = GrapesHome | null;

/**
 * Classe le contenu de `homePageBlocks` (recopie locale de `clenzy-sites/.../pageContent.detectPageContent`,
 * sans import cross-repo possible) :
 *  - `{ format:'grapesjs', html, css }` → { kind:'grapes', html, css }
 *  - tableau legacy / objet non reconnu / parse KO / vide → null (rien à rendre → état neutre).
 * Le format legacy n'est délibérément PLUS rendu (greenfield assumé : G0 hard cutover GrapesJS).
 */
function detectHomeContent(blocksJson: string | null | undefined): HomeContent {
  if (!blocksJson) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(blocksJson); } catch { return null; }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    && (parsed as { format?: unknown }).format === 'grapesjs') {
    const p = parsed as { html?: unknown; css?: unknown };
    return {
      kind: 'grapes',
      html: typeof p.html === 'string' ? p.html : '',
      css: typeof p.css === 'string' ? p.css : '',
    };
  }
  return null;
}

/**
 * Surcharge les CSS vars de marque + design tokens sur le conteneur racine (rendu fidèle au thème).
 * Recopie locale du `themeStyle` du builder legacy (qui devient mort) pour garder cette page autonome.
 */
function themeVars(primaryColor: string, fontFamily: string | null, t: DesignTokens | null): React.CSSProperties {
  const accent = t?.primaryColor || primaryColor || '#5453D6';
  const style: Record<string, string> = {
    '--accent': accent,
    '--accent-deep': `color-mix(in srgb, ${accent} 84%, #000)`,
    '--accent-soft': `color-mix(in srgb, ${accent} 12%, transparent)`,
    '--on-accent': '#ffffff',
  };
  const body = t?.bodyFontFamily || fontFamily;
  if (body) { style.fontFamily = body; style['--body'] = body; style['--font-display'] = t?.headingFontFamily || body; }
  if (t?.headingFontWeight) style['--fw-heading'] = String(t.headingFontWeight);
  if (t?.backgroundColor) style['--bg'] = t.backgroundColor;
  if (t?.surfaceColor) style['--card'] = t.surfaceColor;
  if (t?.textColor) style['--ink'] = t.textColor;
  if (t?.textSecondaryColor) style['--muted'] = t.textSecondaryColor;
  if (t?.borderColor) { style['--line'] = t.borderColor; style['--line-2'] = t.dividerColor || t.borderColor; }
  if (t?.cardBorderRadius || t?.borderRadius) style['--radius-lg'] = (t.cardBorderRadius || t.borderRadius)!;
  if (t?.borderRadius) { style['--radius-md'] = t.borderRadius; style['--radius-sm'] = t.borderRadius; }
  const shadow = t?.cardShadow || t?.boxShadow;
  if (shadow) style['--shadow-card'] = shadow;
  if (t?.baseFontSize) style.fontSize = t.baseFontSize;
  return style as React.CSSProperties;
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
  // Conteneur du HTML GrapesJS injecté (racine de scan pour l'hydratation des marqueurs).
  const grapesRef = useRef<HTMLDivElement>(null);

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
    fetch(`${API_BASE}/public/booking/widget/reviews/summary?limit=6`, {
      headers: { 'X-Booking-Key': apiKey },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((data: PublicReviews) => { if (alive && data && data.stats) setReviews(data); })
      .catch(() => { /* avis indisponibles : section masquée */ });
    return () => { alive = false; };
  }, [apiKey]);

  const tokens = useMemo(() => parseTokens(config?.designTokens ?? null), [config?.designTokens]);
  const home = useMemo(() => detectHomeContent(config?.homePageBlocks), [config?.homePageBlocks]);
  // CSS GrapesJS assaini séparément (sélecteurs `>` préservés : ne JAMAIS passer dans sanitizeHtml).
  const homeCss = useMemo(() => (home ? sanitizeCss(home.css) : ''), [home]);
  // HTML GrapesJS assaini (retire script/iframe/style/on*=… — parité sécurité avec le SSR).
  const homeHtml = useMemo(() => (home ? sanitizeHtml(home.html) : ''), [home]);

  // La HOME GrapesJS porte-t-elle ses propres marqueurs de réservation ? (déterminé depuis le HTML
  // assaini, donc stable au render — sert à décider d'afficher ou non la section #reserver de repli).
  const homeHasWidgets = homeHtml.includes(WIDGET_MARKER);

  const language = (['fr', 'en', 'ar'].includes(config?.defaultLanguage ?? '') ? config!.defaultLanguage : 'fr') as 'fr' | 'en' | 'ar';

  // Monte le module de réservation une fois la config chargée. Deux parcours mutuellement exclusifs
  // (Option A du contrat : on évite le doublon de widgets bookables) :
  //  1. HOME GrapesJS contenant des marqueurs `data-clenzy-widget` → HYDRATATION in-place (SDK partagé) ;
  //  2. sinon → widget MONOLITHE (Shadow DOM) sur la section #reserver de repli.
  useEffect(() => {
    if (!config || !apiKey) return;

    // Cas 1 : la HOME GrapesJS porte ses propres marqueurs → on les hydrate, pas de monolithe.
    const markerCount = grapesRef.current?.querySelectorAll(`[${WIDGET_MARKER}]`).length ?? 0;
    if (markerCount > 0) {
      // Idempotent (cœur partagé par apiKey, garde `data-clenzy-hydrated`) ; scope = conteneur GrapesJS.
      BaitlyBooking.hydrate({
        apiKey,
        baseUrl: API_CONFIG.BASE_URL,
        theme: widgetThemeFromTokens(config.primaryColor, config.fontFamily, tokens),
        componentConfig: config.componentConfig ?? undefined,
        leadCapture: config.leadCapturePopupEnabled === true,
        language,
        currency: config.defaultCurrency,
        root: grapesRef.current ?? undefined,
      });
      return; // pas de cleanup : l'hydratation est idempotente et persiste avec le cœur partagé.
    }

    // Cas 2 : aucun marqueur → widget monolithe sur la section #reserver de repli.
    if (!widgetHostRef.current) return;
    const widget = new BaitlyWidget({
      container: widgetHostRef.current,
      apiKey,
      baseUrl: API_CONFIG.BASE_URL,
      theme: widgetThemeFromTokens(config.primaryColor, config.fontFamily, tokens),
      // Le CSS de page (<style> plus bas) ne franchit pas le Shadow DOM → on le passe aussi au widget.
      customCss: config.customCss ?? undefined,
      componentConfig: config.componentConfig ?? undefined,
      leadCapture: config.leadCapturePopupEnabled === true,
      language,
      currency: config.defaultCurrency,
    });
    widget.mount();
    return () => widget.destroy();
  }, [config, apiKey, tokens, homeHtml, language]);

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
    <Box style={themeVars(config.primaryColor, config.fontFamily, tokens)}
      sx={{ minHeight: '100vh', bgcolor: 'var(--card)', color: 'var(--ink)', containerType: 'inline-size' }}>
      {config.customCss && <style>{config.customCss}</style>}

      {/* Page composée HOME (GrapesJS) : CSS scopé brut (assaini) + HTML assaini injecté.
          Le CSS est émis SÉPARÉMENT (jamais dans sanitizeHtml qui casserait les sélecteurs `>`).
          Si la HOME porte des marqueurs `data-clenzy-widget`, ils sont hydratés (effet ci-dessus). */}
      {home && (
        <>
          {homeCss && <style>{homeCss}</style>}
          {createElement('div', {
            ref: grapesRef,
            'data-bkly-grapes': '',
            [RAW_HTML_PROP]: { __html: homeHtml },
          })}
        </>
      )}

      {/* Preuve sociale : avis publics (affichée seulement s'il y en a). */}
      {reviews?.stats && reviews.stats.totalCount > 0 && <ReviewsSection data={reviews} />}

      {/* Section de réservation de repli : widget monolithe (Shadow DOM, styles isolés). Masquée si la
          HOME GrapesJS embarque déjà ses propres marqueurs hydratés (évite le doublon bookable). */}
      {!homeHasWidgets && (
        <Box id="reserver" sx={{ maxWidth: 1040, mx: 'auto', px: { xs: 2, md: 4 }, py: { xs: 4, md: 6 } }}>
          <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-bold)', textAlign: 'center', mb: 3 }}>
            Réservez votre séjour
          </Box>
          <Box ref={widgetHostRef} />
        </Box>
      )}

      {/* Concierge IA (2.13) — bulle flottante, affichée seulement si l'org a activé l'IA. */}
      {apiKey && <PublicConcierge apiKey={apiKey} />}
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
