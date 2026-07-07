import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Skeleton, Menu, MenuItem } from '@mui/material';
import { Sparkles, Rocket, AlertTriangle, Check, ArrowUp, Wand2, SquarePen, ChevronDown } from 'lucide-react';
import { sitesApi, type Site, type SitePage } from '../../../services/api/sitesApi';

/**
 * Studio de site IMMERSIF (surface user org, hors GrapesJS) — expérience « open-design » :
 * aperçu live à gauche + panneau conversationnel à droite. L'utilisateur itère en langage naturel
 * (« rends le hero plus chaleureux », « passe la liste en 2 colonnes ») → `sitesApi.refinePage`
 * régénère le HTML de la page → l'aperçu se rafraîchit. Puis « Publier » fige le brouillon servi au
 * public. Le Studio GrapesJS reste réservé au staff plateforme.
 */

/** Un tour de conversation d'itération. */
interface Turn {
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
}

/**
 * CSS d'APERÇU (injecté uniquement dans l'iframe du studio) : donne aux marqueurs `data-clenzy-widget`
 * un placeholder lisible et thémé (avec un libellé du module) au lieu d'un `<div>` vide. Ne modifie PAS
 * le contenu stocké — sur le site publié, le SDK hydrate ces marqueurs avec les vrais widgets.
 */
const WIDGET_LABELS: Record<string, string> = {
  search: 'Barre de recherche', results: 'Grille des logements', 'property-list': 'Grille des logements',
  property: 'Détail du logement', dates: 'Sélecteur de dates', guests: 'Voyageurs', currency: 'Devise',
  cart: 'Panier', price: 'Filtre prix', 'guest-form': 'Coordonnées voyageur', checkout: 'Paiement',
  account: 'Compte', confirmation: 'Confirmation', upsells: 'Options & extras',
};
const PREVIEW_WIDGET_CSS = `
[data-clenzy-widget]{
  display:flex!important; align-items:center; justify-content:center; text-align:center;
  min-height:56px; margin:14px 0; padding:18px 16px; box-sizing:border-box;
  border:1.5px dashed var(--bt-color-border, #d8d3c8);
  border-radius: var(--bt-radius-md, 12px);
  background: color-mix(in srgb, var(--bt-color-primary, #6B8A9A) 7%, transparent);
  color: var(--bt-color-text-muted, #6b7280);
  font: 600 13px/1.4 var(--bt-font-body, system-ui, sans-serif);
  letter-spacing:.01em;
}
[data-clenzy-widget]::before{ content:"Module de réservation"; }
[data-clenzy-widget="search"], [data-clenzy-widget="results"], [data-clenzy-widget="property-list"]{ min-height:76px; }
`
  + Object.entries(WIDGET_LABELS)
    .map(([k, v]) => `[data-clenzy-widget="${k}"]::before{ content:"${v}"; }`)
    .join('\n');

/** Extrait html+css de l'enveloppe GrapesJS stockée dans `SitePage.blocks` (repli : blocks brut = HTML). */
function parseEnvelope(blocks: string | null): { html: string; css: string } {
  if (!blocks) return { html: '', css: '' };
  if (blocks.trimStart().charAt(0) !== '{') return { html: stripBodyWrapper(blocks), css: '' };
  try {
    const node = JSON.parse(blocks) as { html?: string; css?: string };
    return { html: stripBodyWrapper(node.html ?? ''), css: node.css ?? '' };
  } catch {
    return { html: stripBodyWrapper(blocks), css: '' };
  }
}

/**
 * Normalise le HTML avant injection dans l'aperçu : GrapesJS re-sérialise le contenu en l'enveloppant
 * dans `<body>…</body>`. On retire ce wrapper pour éviter un double `<body>` dans le srcDoc (qui casse
 * le rendu). Le HTML généré par l'IA (sans wrapper) est laissé intact.
 */
function stripBodyWrapper(html: string): string {
  return html.replace(/^\s*<body[^>]*>/i, '').replace(/<\/body>\s*$/i, '');
}

export default function SiteManagerPage() {
  const { siteId: siteIdParam } = useParams();
  const siteId = Number(siteIdParam);
  const navigate = useNavigate();

  const [site, setSite] = useState<Site | null>(null);
  const [pages, setPages] = useState<SitePage[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');
  const [refining, setRefining] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [turnsByPage, setTurnsByPage] = useState<Record<number, Turn[]>>({});
  const [pageMenuAnchor, setPageMenuAnchor] = useState<HTMLElement | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [s, ps] = await Promise.all([sitesApi.getSite(siteId), sitesApi.listPages(siteId)]);
      setSite(s);
      setPages(ps);
      setSelectedId((cur) => cur ?? ps.find((p) => p.type === 'HOME')?.id ?? ps[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement du site impossible');
    }
  }, [siteId]);

  useEffect(() => { if (Number.isFinite(siteId)) load(); }, [siteId, load]);

  const selected = useMemo(() => pages?.find((p) => p.id === selectedId) ?? null, [pages, selectedId]);
  const turns = selectedId != null ? (turnsByPage[selectedId] ?? []) : [];
  // Mémoïsé sur l'ID + le CONTENU (blocks) uniquement : un « Publier » change le statut/dirty du
  // `selected` mais PAS son contenu → l'aperçu ne se recharge plus inutilement (plus de flash blanc).
  const srcDoc = useMemo(() => {
    if (!selected) return '';
    const { html, css } = parseEnvelope(selected.blocks);
    return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}${css}${PREVIEW_WIDGET_CSS}</style></head><body>${html}</body></html>`;
  }, [selected?.id, selected?.blocks]);

  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [turns, refining]);

  const replacePage = (updated: SitePage) =>
    setPages((prev) => (prev ? prev.map((p) => (p.id === updated.id ? updated : p)) : prev));
  const pushTurn = (pageId: number, turn: Turn) =>
    setTurnsByPage((prev) => ({ ...prev, [pageId]: [...(prev[pageId] ?? []), turn] }));

  const handleRefine = async () => {
    if (!selected || !instruction.trim() || refining) return;
    const pageId = selected.id;
    const text = instruction.trim();
    setInstruction('');
    pushTurn(pageId, { role: 'user', text });
    setRefining(true);
    setError(null);
    try {
      const updated = await sitesApi.refinePage(siteId, pageId, text);
      replacePage(updated);
      pushTurn(pageId, { role: 'assistant', text: 'Modification appliquée.' });
    } catch (e) {
      pushTurn(pageId, { role: 'assistant', text: e instanceof Error ? e.message : 'La retouche a échoué.', error: true });
    } finally {
      setRefining(false);
    }
  };

  const handlePublish = async () => {
    if (!selected || publishing) return;
    setPublishing(true);
    setError(null);
    try {
      const updated = await sitesApi.publishPage(siteId, selected.id);
      replacePage(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La publication a échoué.');
    } finally {
      setPublishing(false);
    }
  };

  if ((site === null || pages === null) && !error) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rounded" height="80vh" sx={{ borderRadius: '16px', bgcolor: 'var(--hover)' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'var(--bg)' }}>
      {/* Barre supérieure */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 3, py: 1.5, borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <Button onClick={() => navigate('/booking-engine/studio')} sx={{ textTransform: 'none', color: 'var(--muted)', minWidth: 0 }}>← Studio</Button>
        <Box sx={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{site?.name ?? 'Mon site'}</Box>
        <Box sx={{ flex: 1 }} />
        {/* Passage en ÉDITION MANUELLE : ouvre l'éditeur GrapesJS sur ce site (config liée). */}
        <Button
          variant="text"
          startIcon={<SquarePen size={16} strokeWidth={2} />}
          onClick={() => { if (site?.bookingEngineConfigId) navigate(`/booking-engine/studio/${site.bookingEngineConfigId}`); }}
          disabled={!site?.bookingEngineConfigId}
          sx={{ textTransform: 'none', color: 'var(--muted)' }}
        >
          Édition manuelle
        </Button>
        <Button
          variant="contained" disableElevation
          startIcon={<Rocket size={16} strokeWidth={2} />}
          onClick={handlePublish}
          disabled={publishing || !selected?.dirty}
          sx={{ textTransform: 'none' }}
        >
          {publishing ? 'Publication…' : selected?.dirty ? 'Publier cette page' : 'Publié'}
        </Button>
      </Box>

      {error && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mx: 3, mt: 1.5, p: 1.25, borderRadius: 'var(--radius-md)', bgcolor: 'var(--err-soft)', color: 'var(--err)', fontSize: 13 }}>
          <AlertTriangle size={16} strokeWidth={2} /> {error}
        </Box>
      )}

      {/* Corps : aperçu | conversation (la sélection de page vit dans la barre d'adresse de l'aperçu). */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 360px' }, gap: 0 }}>

        {/* Aperçu live */}
        <Box sx={{ p: 2, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ flex: 1, minHeight: 0, border: '1px solid var(--line)', borderRadius: 'var(--radius-lg, 14px)', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px -24px rgba(20,30,55,0.35)' }}>
            {/* Chrome navigateur */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, bgcolor: 'var(--surface-2, #f4f5f8)', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
              <Box sx={{ display: 'flex', gap: 0.6 }}>
                {['#ff5f57', '#febc2e', '#28c840'].map((c) => <Box key={c} sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c }} />)}
              </Box>
              {/* Barre d'adresse = sélecteur de page (remplace la colonne « Pages » retirée). */}
              <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
                <Box
                  component="button" type="button" onClick={(e: React.MouseEvent<HTMLButtonElement>) => setPageMenuAnchor(e.currentTarget)}
                  aria-label="Changer de page"
                  sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.75, maxWidth: '100%', cursor: 'pointer',
                    border: '1px solid var(--line)', bgcolor: 'var(--field, #fff)', borderRadius: 'var(--radius-pill, 999px)',
                    px: 1.5, py: 0.4, color: 'var(--muted)', fontSize: 12,
                    transition: 'border-color 150ms ease', '&:hover': { borderColor: 'var(--accent)' },
                  }}
                >
                  <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {site?.slug ? `${site.slug}.baitly.site` : 'aperçu'}{selected?.path && selected.path !== '/' ? selected.path : ''}
                  </Box>
                  {selected?.dirty && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'var(--accent)', flexShrink: 0 }} />}
                  <ChevronDown size={13} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                </Box>
              </Box>
            </Box>

            <Menu
              anchorEl={pageMenuAnchor} open={!!pageMenuAnchor} onClose={() => setPageMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} transformOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
              {pages?.map((p) => (
                <MenuItem
                  key={p.id} selected={p.id === selectedId}
                  onClick={() => { setSelectedId(p.id); setPageMenuAnchor(null); }}
                  sx={{ fontSize: 13, gap: 1.5, minWidth: 240 }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title || p.path}</Box>
                    <Box sx={{ fontSize: 11, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{p.path}</Box>
                  </Box>
                  {p.dirty
                    ? <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'var(--accent)', flexShrink: 0 }} title="Brouillon non publié" />
                    : <Check size={14} strokeWidth={2.4} color="var(--muted)" />}
                </MenuItem>
              ))}
            </Menu>
            <Box sx={{ position: 'relative', flex: 1, minHeight: 0, bgcolor: '#fff' }}>
              {refining && (
                <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(255,255,255,0.55)', display: 'grid', placeItems: 'center', zIndex: 2, fontSize: 13, color: 'var(--muted)', gap: 1 }}>
                  <Wand2 size={20} strokeWidth={1.8} /> Retouche en cours…
                </Box>
              )}
              <iframe title="Aperçu de la page" srcDoc={srcDoc} sandbox="" style={{ width: '100%', height: '100%', border: 0, background: '#fff', display: 'block' }} />
            </Box>
          </Box>
        </Box>

        {/* Conversation d'itération */}
        <Box sx={{ borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <Sparkles size={16} strokeWidth={2} color="var(--accent)" />
            <Box sx={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Assistant de design</Box>
          </Box>

          <Box ref={logRef} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {turns.length === 0 && !refining && (
              <Box sx={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
                Décrivez une modification de la page <b>{selected?.title || selected?.path}</b> en langage naturel.
                <Box component="ul" sx={{ pl: 2.5, mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <li>« Rends le hero plus chaleureux »</li>
                  <li>« Passe la liste des logements en 2 colonnes »</li>
                  <li>« Ajoute une section “à propos” sous le hero »</li>
                </Box>
              </Box>
            )}
            {turns.map((turn, i) => (
              <Box
                key={i}
                sx={{
                  alignSelf: turn.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '88%', px: 1.5, py: 1, borderRadius: 'var(--radius-md)', fontSize: 13, lineHeight: 1.5,
                  bgcolor: turn.role === 'user' ? 'var(--accent)' : turn.error ? 'var(--err-soft)' : 'var(--hover)',
                  color: turn.role === 'user' ? '#fff' : turn.error ? 'var(--err)' : 'var(--ink)',
                  display: 'flex', gap: 0.75, alignItems: 'flex-start',
                }}
              >
                {turn.role === 'assistant' && !turn.error && <Check size={15} strokeWidth={2.4} style={{ flexShrink: 0, marginTop: 1 }} />}
                {turn.role === 'assistant' && turn.error && <AlertTriangle size={15} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />}
                <span>{turn.text}</span>
              </Box>
            ))}
            {refining && (
              <Box sx={{ alignSelf: 'flex-start', px: 1.5, py: 1, borderRadius: 'var(--radius-md)', bgcolor: 'var(--hover)', color: 'var(--muted)', fontSize: 13 }}>…</Box>
            )}
          </Box>

          <Box sx={{ p: 1.5, borderTop: '1px solid var(--line)', flexShrink: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', px: 1, py: 0.75, bgcolor: 'var(--field, #fff)' }}>
              <Box
                component="textarea"
                value={instruction}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInstruction(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefine(); } }}
                placeholder="Décrivez une modification…"
                disabled={refining}
                rows={2}
                sx={{ flex: 1, resize: 'none', border: 0, outline: 0, bgcolor: 'transparent', fontFamily: 'inherit', fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5, py: 0.5 }}
              />
              <Box
                component="button" type="button" aria-label="Envoyer" onClick={handleRefine}
                disabled={refining || !instruction.trim()}
                sx={{
                  flexShrink: 0, width: 34, height: 34, borderRadius: '50%', border: 0, cursor: refining || !instruction.trim() ? 'default' : 'pointer',
                  bgcolor: instruction.trim() && !refining ? 'var(--accent)' : 'var(--line)', color: '#fff',
                  display: 'grid', placeItems: 'center', transition: 'background 150ms ease',
                }}
              >
                <ArrowUp size={17} strokeWidth={2.4} />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
