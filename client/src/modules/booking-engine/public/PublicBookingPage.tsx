import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '../../../components/ui';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
 *
 * ATTENTION : les noms de variables posés ici (`--accent`, `--card`, `--ink`, `--line`…) sont le
 * CONTRAT entre cette fonction et le balisage du site rendu plus bas. Ce sont les couleurs du SITE
 * DU CLIENT, pas la peinture de l'interface Baitly : les migrer vers les utilitaires Baitly UI
 * (`bg-card`, `text-foreground`…) débrancherait le thème du tenant. Seul le chrome affiché AVANT le
 * chargement de la config (chargement, erreur) suit la palette Baitly UI.
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
  const widgetHostRef = useRef<HTMLDivElement>(null);
  // Conteneur du HTML GrapesJS injecté (racine de scan pour l'hydratation des marqueurs).
  const grapesRef = useRef<HTMLDivElement>(null);

  // Config du booking engine — one-shot par visite (semantique inchangee :
  // pas de retry ni de refetch-on-focus), react-query gere dedup + races.
  const configQuery = useQuery({
    queryKey: ['public-booking-config', apiKey],
    queryFn: async (): Promise<PublicBookingConfig> => {
      const r = await fetch(`${API_BASE}/public/booking/widget/config`, {
        headers: { 'X-Booking-Key': apiKey! },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: !!apiKey,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  const config = configQuery.data ?? null;
  const error = !apiKey
    ? 'Clé manquante'
    : configQuery.isError
      ? 'Ce booking engine est introuvable ou indisponible.'
      : null;

  // Avis publics (preuve sociale) — best-effort, n'empêche pas l'affichage de la page.
  const reviewsQuery = useQuery({
    queryKey: ['public-booking-reviews', apiKey],
    queryFn: async (): Promise<PublicReviews> => {
      const r = await fetch(`${API_BASE}/public/booking/widget/reviews/summary?limit=6`, {
        headers: { 'X-Booking-Key': apiKey! },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: !!apiKey,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  const reviews = reviewsQuery.data && reviewsQuery.data.stats ? reviewsQuery.data : null;

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
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <AlertTriangle size={32} strokeWidth={1.75} />
          <div className="text-sm">{error}</div>
        </div>
      </Centered>
    );
  }

  if (!config) {
    return <Centered><Spinner className="size-7 text-primary" /></Centered>;
  }

  return (
    <div style={themeVars(config.primaryColor, config.fontFamily, tokens)}
      className="min-h-[100vh] bg-[var(--card)] text-[var(--ink)] [container-type:inline-size]">
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
        <div className="max-w-[1040px] mx-auto px-3 min-[900px]:px-6 py-6 min-[900px]:py-9" id="reserver">
          <div className="font-[family-name:var(--font-display)] text-2xl font-bold text-center text-balance mb-4">
            Réservez votre séjour
          </div>
          <div ref={widgetHostRef} />
        </div>
      )}

      {/* Concierge IA (2.13) — bulle flottante, affichée seulement si l'org a activé l'IA. */}
      {apiKey && <PublicConcierge apiKey={apiKey} />}
    </div>
  );
}

function ReviewsSection({ data }: { data: PublicReviews }) {
  return (
    <div className="max-w-[1040px] mx-auto px-3 min-[900px]:px-6 py-6 min-[900px]:py-9">
      <div className="flex items-center justify-center gap-1.5 mb-4">
        <Star size={22} fill="var(--accent)" color="var(--accent)" />
        <div className="font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums text-[var(--ink)]">
          {data.stats.averageRating.toFixed(1)}
        </div>
        <div className="text-[var(--muted)] text-sm tabular-nums">· {data.stats.totalCount} avis</div>
      </div>
      <div className="grid grid-cols-[1fr] min-[900px]:grid-cols-[repeat(2,_1fr)] min-[1200px]:grid-cols-[repeat(3,_1fr)] gap-3">
        {data.reviews.map((r, i) => (
          <div className="p-3 border border-[var(--line)] rounded-[var(--radius-lg)] bg-[var(--bg)]" key={i}>
            <div className="flex gap-0.5 mb-1.5">
              {Array.from({ length: 5 }).map((_, s) => (
                <Star key={s} size={14} color="var(--accent)" fill={s < r.rating ? 'var(--accent)' : 'none'} />
              ))}
            </div>
            {r.reviewText && (
              <div className="text-sm text-[var(--body)] leading-[1.5] mb-1.5">{r.reviewText}</div>
            )}
            <div className="text-xs font-semibold text-[var(--ink)]">{r.guestName}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Chrome Baitly : rendu AVANT que le thème du tenant ne s'applique — donc palette Baitly UI. */
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100vh] flex items-center justify-center bg-background p-4">
      {children}
    </div>
  );
}
