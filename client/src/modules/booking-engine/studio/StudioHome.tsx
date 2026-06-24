import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Menu, MenuItem, Skeleton } from '@mui/material';
import {
  Plus, LayoutDashboard, Sparkles, ArrowUp, Search, Home, Layers, FileText,
  ShoppingBag, Zap, ArrowRight, List as ListIcon, LayoutGrid, AlertTriangle, ChevronDown,
} from 'lucide-react';
import { bookingEngineApi, type BookingEngineConfig, type BookingEngineConfigUpdate } from '../../../services/api/bookingEngineApi';
import { BUILTIN_FUNNEL_PRESETS } from './grapes/funnelPresets';
import { GALLERY_TEMPLATES } from './grapes/import/galleryTemplates';
import { DESIGN_PRESETS } from '../constants';
import { usePageHeaderActions } from '../../../components/PageHeaderActionsContext';
import { useAuth } from '../../../hooks/useAuth';
import './studioHome.css';

/**
 * Accueil « studio » du Booking Engine (refonte handoff design_handoff_booking_accueil) :
 * hero + champ IA + éventail de funnels + galerie de templates + liste « Mes booking engines ».
 * Zone de CONTENU uniquement — le chrome (sidebar, top bar segmentée, sous-onglets) est fourni
 * par le parent. Accent module = indigo via le wrapper `data-accent="indigo"`.
 *
 * Câblage : la liste, la création (vierge / depuis funnel / depuis template / depuis le champ IA)
 * sont réelles (bookingEngineApi). Les champs sûrs (couleur/police d'un style ou d'un template,
 * URL source) sont posés sur la config à la création. L'APPLICATION fine en éditeur (analyse IA
 * du site, insertion des widgets du funnel, import des pages d'un template) vit dans l'éditeur
 * GrapesJS et est transmise via `location.state` — cf. les TODO marqués ci-dessous.
 */

/** Payload de création d'un booking engine vierge (éditeur démarre sur page blanche). */
function buildConfigPayload(name: string): BookingEngineConfigUpdate {
  return {
    name,
    primaryColor: '#5453D6', accentColor: null, logoUrl: null, fontFamily: 'Inter',
    defaultLanguage: 'fr', defaultCurrency: 'EUR', minAdvanceDays: 1, maxAdvanceDays: 365,
    cancellationPolicy: null, termsUrl: null, privacyUrl: null, allowedOrigins: null,
    collectPaymentOnBooking: true, autoConfirm: true, showCleaningFee: true, showTouristTax: true,
    directBookingDiscountPercent: null, memberDiscountPercent: null, pendingHoldMinutes: null,
    customCss: null, customJs: null, componentConfig: null, pageLayout: null,
    funnelPresets: null, compositeWidgets: null, featuredPropertyIds: null, designTokens: null,
    sourceWebsiteUrl: null, aiAnalysisAt: null, widgetPosition: 'bottom', inlineTargetId: null,
    inlinePlacement: 'after',
  };
}

// ── Données d'affichage ──────────────────────────────────────────────────────

/** Funnels mis en avant dans l'éventail (5 parmi les presets intégrés) + icône lucide. */
const FAN_FUNNEL_ICONS: Record<string, typeof LayoutDashboard> = {
  catalogue: LayoutDashboard, single: Home, inquiry: FileText, extras: ShoppingBag, express: Zap,
};
const FAN_FUNNELS = ['catalogue', 'single', 'inquiry', 'extras', 'express']
  .map((id) => BUILTIN_FUNNEL_PRESETS.find((f) => f.id === id))
  .filter((f): f is NonNullable<typeof f> => !!f);

/** Funnel associé à un template (pour le badge de la carte). */
const TEMPLATE_FUNNEL_LABEL: Record<string, string> = {
  'conciergerie-marrakech': 'Recherche Catalogue',
  'recherche-catalogue-premium': 'Recherche Catalogue',
};

/** Libellé lisible d'un style preset (à défaut d'i18n ici). */
function styleLabel(id: string): string {
  return id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const EXAMPLES = [
  { icon: Search, text: 'Analyser premium-conciergerie.com', prompt: 'https://premium-conciergerie.com' },
  { icon: Home, text: 'Conciergerie de riads à Marrakech', prompt: 'Conciergerie de riads de luxe à Marrakech, réservation directe multi-logements.' },
  { icon: Layers, text: 'Importer mes annonces Airbnb', prompt: 'Importer mes annonces Airbnb pour créer un site de réservation directe.' },
];

const URL_RE = /^(https?:\/\/|www\.)|\.[a-z]{2,}(\/|$)/i;

export default function StudioHome({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [configs, setConfigs] = useState<BookingEngineConfig[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Champ IA
  const [prompt, setPrompt] = useState('');
  const [funnelId, setFunnelId] = useState<string>('catalogue');
  const [styleId, setStyleId] = useState<string | null>(null); // null = automatique
  const [funnelAnchor, setFunnelAnchor] = useState<HTMLElement | null>(null);
  const [styleAnchor, setStyleAnchor] = useState<HTMLElement | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  // Liste
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'list' | 'grid'>('list');

  useEffect(() => {
    let alive = true;
    bookingEngineApi.listConfigs()
      .then((data) => { if (alive) setConfigs(data); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Erreur de chargement'); });
    return () => { alive = false; };
  }, []);

  const initials = useMemo(() => {
    const fromName = ((user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')).toUpperCase();
    if (fromName) return fromName;
    const src = (user?.fullName || user?.email || 'AU').trim();
    return src.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('') || 'AU';
  }, [user]);

  /** Crée une config (avec overrides sûrs) puis ouvre l'éditeur, en transmettant l'intention
   *  d'application fine via location.state (consommée côté éditeur — TODO ci-dessous). */
  const createAndOpen = async (
    name: string,
    overrides: Partial<BookingEngineConfigUpdate>,
    navState?: Record<string, unknown>,
  ) => {
    if (creating) return;
    setCreating(true);
    try {
      const created = await bookingEngineApi.createConfig({ ...buildConfigPayload(name), ...overrides });
      navigate(`/booking-engine/studio/${created.id}`, navState ? { state: navState } : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Création impossible');
      setCreating(false);
    }
  };

  const handleCreateBlank = () => createAndOpen('Nouveau booking engine', {});

  const handleAiSubmit = () => {
    const value = prompt.trim();
    const isUrl = URL_RE.test(value);
    const style = styleId ? DESIGN_PRESETS.find((p) => p.id === styleId) : undefined;
    const name = value ? value.replace(/^https?:\/\//, '').split(/[\s/]+/)[0].slice(0, 40) : 'Nouveau booking engine';
    createAndOpen(
      name,
      {
        // Champs sûrs posés dès la création ; le reste (analyse IA, parcours) est appliqué en éditeur.
        sourceWebsiteUrl: isUrl ? value : null,
        ...(style ? { primaryColor: style.primaryColor, fontFamily: style.fontFamily } : {}),
      },
      // TODO(éditeur) : StudioPage doit consommer ce state pour lancer
      // bookingEngineApi.analyzeWebsite(id, analyzeUrl) si présent, et insérer le funnel choisi.
      { aiPrompt: value, analyzeUrl: isUrl ? value : null, funnelId, styleId },
    );
  };

  const handleFunnel = (id: string, label: string) =>
    // TODO(éditeur) : insérer les widgets du funnel (FunnelPicker.onInsert) au chargement via ce state.
    createAndOpen(label, {}, { funnelId: id });

  const handleTemplate = (tplId: string) => {
    const tpl = GALLERY_TEMPLATES.find((t) => t.id === tplId);
    createAndOpen(
      tpl?.name ?? 'Nouveau booking engine',
      { ...(tpl?.theme?.primaryColor ? { primaryColor: tpl.theme.primaryColor } : {}), ...(tpl?.theme?.fontFamily ? { fontFamily: tpl.theme.fontFamily } : {}) },
      // TODO(éditeur) : importer les pages du template (useSitePages.importPages) au chargement via ce state.
      { templateId: tplId },
    );
  };

  const filtered = useMemo(
    () => (configs ?? []).filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())),
    [configs, query],
  );

  // Action « Créer » portée dans le PageHeader partagé du parent (mode embarqué).
  const headerPortal = usePageHeaderActions(
    embedded ? (
      <Box component="button" onClick={handleCreateBlank} disabled={creating} sx={primaryBtnSx}>
        <Plus size={16} strokeWidth={2.2} /> Créer un booking engine
      </Box>
    ) : null,
  );

  const content = (
    <Box className="be-home" data-accent="indigo">
      <div className="canvas">
        {error && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1.5, borderRadius: 'var(--radius-md)', bgcolor: 'var(--err-soft)', color: 'var(--err)', fontSize: 13 }}>
            <AlertTriangle size={16} strokeWidth={2} /> {error}
          </Box>
        )}

        {/* 1 · Hero */}
        <div className="hero">
          <p className="eyebrow">Booking Engine · Studio</p>
          <h1>Quel booking engine créons-nous&nbsp;?</h1>
        </div>

        {/* 2 · Champ IA */}
        {creating ? (
          <Skeleton variant="rounded" height={170} sx={{ borderRadius: '20px', bgcolor: 'var(--hover)' }} />
        ) : (
          <div className="field">
            <textarea
              ref={areaRef}
              className="field__area"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              aria-label="Décrivez votre activité ou collez l'URL de votre site"
              placeholder="Collez l'URL de votre site actuel à analyser, ou décrivez votre conciergerie…"
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAiSubmit(); }}
            />
            <div className="field__bar">
              <button className="chip chip--icon" aria-label="Importer un fichier" type="button" title="Importer (bientôt)">
                <Plus size={16} strokeWidth={2} />
              </button>
              <button className="chip" type="button" onClick={(e) => setFunnelAnchor(e.currentTarget)}>
                <LayoutDashboard size={16} strokeWidth={2} />
                <span className="lbl-faint">Funnel</span>
                {BUILTIN_FUNNEL_PRESETS.find((f) => f.id === funnelId)?.label ?? 'Funnel'}
                <ChevronDown size={14} strokeWidth={2} />
              </button>
              <button className="chip" type="button" onClick={(e) => setStyleAnchor(e.currentTarget)}>
                <Sparkles size={16} strokeWidth={2} />
                <span className="lbl-faint">Style</span>
                {styleId ? styleLabel(styleId) : 'Automatique'}
                <ChevronDown size={14} strokeWidth={2} />
              </button>
              <div className="field__spacer" />
              <button className="send" type="button" aria-label="Générer" disabled={creating} onClick={handleAiSubmit}>
                <ArrowUp size={19} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        )}

        <Menu anchorEl={funnelAnchor} open={!!funnelAnchor} onClose={() => setFunnelAnchor(null)}>
          {BUILTIN_FUNNEL_PRESETS.map((f) => (
            <MenuItem key={f.id} selected={f.id === funnelId} onClick={() => { setFunnelId(f.id); setFunnelAnchor(null); }} sx={{ fontSize: 13 }}>
              {f.label}
            </MenuItem>
          ))}
        </Menu>
        <Menu anchorEl={styleAnchor} open={!!styleAnchor} onClose={() => setStyleAnchor(null)}>
          <MenuItem selected={!styleId} onClick={() => { setStyleId(null); setStyleAnchor(null); }} sx={{ fontSize: 13 }}>Automatique</MenuItem>
          {DESIGN_PRESETS.map((p) => (
            <MenuItem key={p.id} selected={p.id === styleId} onClick={() => { setStyleId(p.id); setStyleAnchor(null); }} sx={{ fontSize: 13, gap: 1 }}>
              <Box component="span" sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: p.primaryColor, flexShrink: 0 }} />
              {styleLabel(p.id)}
            </MenuItem>
          ))}
        </Menu>

        {/* Exemples */}
        {!creating && (
          <div className="examples">
            {EXAMPLES.map((ex) => (
              <button key={ex.text} className="ex" type="button" onClick={() => { setPrompt(ex.prompt); areaRef.current?.focus(); }}>
                <ex.icon size={14} strokeWidth={2} /> {ex.text}
              </button>
            ))}
          </div>
        )}

        {/* 3 · Éventail de funnels */}
        <div className="fan-wrap">
          <p className="fan-lead">Ou partez d'un funnel prêt à l'emploi…</p>
          <div className="fan">
            {FAN_FUNNELS.map((f) => {
              const Icon = FAN_FUNNEL_ICONS[f.id] ?? LayoutDashboard;
              return (
                <article
                  key={f.id} className="fan__card" role="button" tabIndex={0}
                  onClick={() => handleFunnel(f.id, f.label)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFunnel(f.id, f.label); } }}
                >
                  <div className="fan__vig"><Icon size={30} strokeWidth={1.6} /></div>
                  {f.badge && <span className="fan__badge">{f.badge}</span>}
                  <p className="fan__name">{f.label}</p>
                  <p className="fan__desc">{f.description}</p>
                </article>
              );
            })}
          </div>
          <div className="blank-row">
            <button className="blank" type="button" onClick={handleCreateBlank} disabled={creating}>
              Partir d'une page vierge <ArrowRight size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* 4 · Templates prêts à l'emploi */}
        <section className="templates">
          <div className="tpl-head">
            <div>
              <p className="eyebrow2">Templates</p>
              <h2 className="tpl-title">Des sites prêts à l'emploi</h2>
            </div>
            {/* TODO : page « tous les templates » (galerie complète). */}
            <button className="tpl-all" type="button" onClick={handleCreateBlank}>
              Voir tous les templates <ArrowRight size={15} strokeWidth={2} />
            </button>
          </div>
          <div className="tpl-grid">
            {GALLERY_TEMPLATES.map((tpl) => {
              const c1 = tpl.theme?.primaryColor || 'var(--accent)';
              return (
                <article
                  key={tpl.id} className="tpl-card" role="button" tabIndex={0}
                  onClick={() => handleTemplate(tpl.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTemplate(tpl.id); } }}
                >
                  <div className="tpl-thumb">
                    {tpl.thumbnail ? (
                      <img src={tpl.thumbnail} alt="" />
                    ) : (
                      // Repli mini-aperçu CSS aux couleurs du template (TODO : vrai screenshot).
                      <div className="mini" style={{ ['--t1' as string]: c1, ['--t2' as string]: c1, ['--t3' as string]: 'var(--surface-2)' }}>
                        <div className="mini__bar"><span className="mini__logo" /><span className="mini__nav" /><span className="mini__nav" /><span className="mini__nav sp" /></div>
                        <div className="mini__hero"><span className="mini__h1" /><span className="mini__h2" /><span className="mini__search" /></div>
                        <div className="mini__cards"><span /><span /><span /></div>
                      </div>
                    )}
                    <div className="tpl-use"><span><Plus size={15} strokeWidth={2} /> Utiliser ce template</span></div>
                  </div>
                  <div className="tpl-body">
                    <p className="tpl-name">{tpl.name}</p>
                    <div className="tpl-meta">
                      <span className="tpl-tag">{TEMPLATE_FUNNEL_LABEL[tpl.id] ?? 'Recherche Catalogue'}</span>
                      {tpl.description && <span className="tpl-style">{tpl.description}</span>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* 5 · Mes booking engines */}
        <section className="list">
          <div className="list__head">
            <h2>Mes booking engines</h2>
            <span className="count">{configs?.length ?? 0}</span>
            <div className="sp" />
            <label className="search">
              <Search size={15} strokeWidth={2} />
              <input placeholder="Rechercher…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <div className="view">
              <button className={view === 'list' ? 'on' : ''} aria-label="Liste" type="button" onClick={() => setView('list')}><ListIcon size={16} strokeWidth={2} /></button>
              <button className={view === 'grid' ? 'on' : ''} aria-label="Grille" type="button" onClick={() => setView('grid')}><LayoutGrid size={16} strokeWidth={2} /></button>
            </div>
          </div>

          {configs === null && !error && <Skeleton variant="rounded" height={132} sx={{ borderRadius: '14px', bgcolor: 'var(--hover)' }} />}

          {configs && configs.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 6, color: 'var(--muted)', fontSize: 14 }}>
              Aucun booking engine pour l'instant — partez d'un funnel, d'un template, ou décrivez votre activité ci-dessus.
            </Box>
          )}

          {configs && configs.length > 0 && view === 'list' && (
            <div className="tbl">
              <div className="tbl__h"><span>Nom</span><span>Statut</span><span>Dernière modif.</span><span>Accès</span></div>
              {filtered.map((c) => (
                <button key={c.id} className="row" type="button" onClick={() => navigate(`/booking-engine/studio/${c.id}`)}>
                  <div className="row__name">
                    <div className="row__ic" style={{ background: c.primaryColor || 'var(--accent)' }}><LayoutDashboard size={19} strokeWidth={2} /></div>
                    <div>
                      <p className="row__t">{c.name}</p>
                      {/* TODO : vraie URL publique (la config n'expose pas de slug). */}
                      <p className="row__u">{c.enabled ? 'Publié' : 'Brouillon · non publié'}</p>
                    </div>
                  </div>
                  <span className={`status ${c.enabled ? 'active' : 'off'}`}><span className="led" /> {c.enabled ? 'Actif' : 'Désactivé'}</span>
                  {/* TODO : « dernière modif » (la config n'expose pas updatedAt). */}
                  <span className="row__meta">—</span>
                  <div className="row__acc"><span className="av-sm">{initials}</span><span className="row__go"><ArrowRight size={17} strokeWidth={2} /></span></div>
                </button>
              ))}
            </div>
          )}

          {configs && configs.length > 0 && view === 'grid' && (
            <div className="grid">
              {filtered.map((c) => (
                <button key={c.id} className="gcard" type="button" onClick={() => navigate(`/booking-engine/studio/${c.id}`)}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: '10px', flexShrink: 0, bgcolor: c.primaryColor || 'var(--accent)' }} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box sx={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--ink)' }}>{c.name}</Box>
                      <span className={`status ${c.enabled ? 'active' : 'off'}`} style={{ fontSize: 12 }}><span className="led" /> {c.enabled ? 'Actif' : 'Désactivé'}</span>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 'auto', color: 'var(--accent)', fontSize: 13, fontWeight: 500 }}>
                    Ouvrir <ArrowRight size={14} strokeWidth={2} />
                  </Box>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </Box>
  );

  return (
    <>
      {embedded ? (
        <Box sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
          {headerPortal}
          {content}
        </Box>
      ) : (
        <Box sx={{ minHeight: '100vh', bgcolor: 'var(--bg)' }}>
          <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 5 } }}>{content}</Box>
        </Box>
      )}
    </>
  );
}

const primaryBtnSx = {
  display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 38, px: 2, border: 0,
  borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent)', color: 'var(--on-accent)',
  fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', flexShrink: 0,
  transition: 'background var(--duration-fast) var(--ease-out)',
  '&:hover': { bgcolor: 'var(--accent-deep)' },
  '&:disabled': { opacity: 0.6, cursor: 'not-allowed' },
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
} as const;
