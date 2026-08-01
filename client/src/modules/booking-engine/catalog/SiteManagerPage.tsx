import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../../utils/cn';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
} from '../../../components/ui';
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
      <div className="p-4">
        <Skeleton className="h-[80vh] w-full rounded-[16px] bg-[var(--hover)]" />
      </div>
    );
  }

  return (
    <div className="h-[100vh] flex flex-col bg-[var(--bg)]">
      {/* Barre supérieure */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--line)] shrink-0">
        <Button variant="ghost" onClick={() => navigate('/booking-engine/studio')} className="text-[var(--muted)]">← Studio</Button>
        <div className="text-[15px] font-bold text-[var(--ink)]">{site?.name ?? 'Mon site'}</div>
        <div className="flex-1" />
        {/* Passage en ÉDITION MANUELLE : ouvre l'éditeur GrapesJS sur ce site (config liée). */}
        <Button
          variant="ghost"
          onClick={() => { if (site?.bookingEngineConfigId) navigate(`/booking-engine/studio/${site.bookingEngineConfigId}`); }}
          disabled={!site?.bookingEngineConfigId}
          className="text-[var(--muted)]"
        >
          <SquarePen size={16} strokeWidth={2} />
          Édition manuelle
        </Button>
        <Button
          onClick={handlePublish}
          disabled={publishing || !selected?.dirty}
        >
          <Rocket size={16} strokeWidth={2} />
          {publishing ? 'Publication…' : selected?.dirty ? 'Publier cette page' : 'Publié'}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 mx-4 mt-2 p-2 rounded-[var(--radius-md)] bg-[var(--err-soft)] text-[var(--err)] text-[13px]">
          <AlertTriangle size={16} strokeWidth={2} /> {error}
        </div>
      )}

      {/* Corps : aperçu | conversation (la sélection de page vit dans la barre d'adresse de l'aperçu). */}
      <div className="flex-1 min-h-0 grid grid-cols-[1fr] min-[900px]:grid-cols-[1fr_360px] gap-0">

        {/* Aperçu live */}
        <div className="p-3 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0 border border-solid border-[var(--line)] rounded-[var(--radius-lg,_14px)] overflow-hidden flex flex-col" style={{ boxShadow: '0 10px 40px -24px rgba(20,30,55,0.35)' }}>
            {/* Chrome navigateur */}
            <div className="flex items-center gap-1.5 px-[9px] py-1.5 bg-[var(--surface-2,_#f4f5f8)] shrink-0" style={{ borderBottom: '1px solid var(--line)' }}>
              <div className="flex gap-1">
                {['#ff5f57', '#febc2e', '#28c840'].map((c) => <div className="w-[10px] h-[10px] rounded-[50%]" style={{ backgroundColor: c }} key={c} />)}
              </div>
              {/* Barre d'adresse = sélecteur de page (remplace la colonne « Pages » retirée). */}
              <div className="flex-1 flex justify-center min-w-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-[4.5px] max-w-full cursor-pointer border border-solid border-[var(--line)] bg-[var(--field,_#fff)] rounded-[var(--radius-pill,_999px)] px-[9px] py-[2.4000000000000004px] text-[var(--muted)] text-[12px] hover:border-[var(--accent)]" style={{ transition: 'border-color 150ms ease' }} type="button" aria-label="Changer de page">
                      <span className="tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
                        {site?.slug ? `${site.slug}.baitly.site` : 'aperçu'}{selected?.path && selected.path !== '/' ? selected.path : ''}
                      </span>
                      {selected?.dirty && <div className="w-[6px] h-[6px] rounded-[50%] bg-[var(--accent)] shrink-0" />}
                      <ChevronDown size={13} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center">
                    {pages?.map((p) => (
                      <DropdownMenuItem
                        key={p.id}
                        onSelect={() => setSelectedId(p.id)}
                        className="text-[13px] gap-[9px] min-w-[240px]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-[var(--ink)] whitespace-nowrap overflow-hidden text-ellipsis">{p.title || p.path}</div>
                          <div className="text-[11px] text-[var(--muted)] tabular-nums">{p.path}</div>
                        </div>
                        {p.dirty
                          ? <div className="w-[7px] h-[7px] rounded-[50%] bg-[var(--accent)] shrink-0" title="Brouillon non publié" />
                          : <Check size={14} strokeWidth={2.4} color="var(--muted)" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="relative flex-1 min-h-0 bg-[#fff]">
              {refining && (
                <div className="absolute inset-0 bg-[rgba(255,255,255,0.55)] grid place-items-[center] z-[2] text-[13px] text-[var(--muted)] gap-1.5">
                  <Wand2 size={20} strokeWidth={1.8} /> Retouche en cours…
                </div>
              )}
              <iframe title="Aperçu de la page" srcDoc={srcDoc} sandbox="" style={{ width: '100%', height: '100%', border: 0, background: '#fff', display: 'block' }} />
            </div>
          </div>
        </div>

        {/* Conversation d'itération */}
        <div className="border-s border-[var(--line)] flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-[var(--line)] flex items-center gap-1.5 shrink-0">
            <Sparkles size={16} strokeWidth={2} color="var(--accent)" />
            <div className="text-[13.5px] font-bold text-[var(--ink)]">Assistant de design</div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2" ref={logRef}>
            {turns.length === 0 && !refining && (
              <div className="text-[var(--muted)] text-[13px] leading-[1.6]">
                Décrivez une modification de la page <b>{selected?.title || selected?.path}</b> en langage naturel.
                <ul className="ps-3.5 mt-1.5 flex flex-col gap-0.5">
                  <li>« Rends le hero plus chaleureux »</li>
                  <li>« Passe la liste des logements en 2 colonnes »</li>
                  <li>« Ajoute une section “à propos” sous le hero »</li>
                </ul>
              </div>
            )}
            {turns.map((turn, i) => (
              <div className={cn('max-w-[88%] px-[9px] py-1.5 rounded-[var(--radius-md)] text-[13px] leading-[1.5] flex gap-[4.5px] items-start', turn.role === 'user' ? 'self-end' : 'self-start', turn.role === 'user' ? 'bg-[var(--accent)]' : turn.error ? 'bg-[var(--err-soft)]' : 'bg-[var(--hover)]', turn.role === 'user' ? 'text-[#fff]' : turn.error ? 'text-[var(--err)]' : 'text-[var(--ink)]')} key={i}>
                {turn.role === 'assistant' && !turn.error && <Check size={15} strokeWidth={2.4} style={{ flexShrink: 0, marginTop: 1 }} />}
                {turn.role === 'assistant' && turn.error && <AlertTriangle size={15} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />}
                <span>{turn.text}</span>
              </div>
            ))}
            {refining && (
              <div className="self-start px-2 py-1.5 rounded-[var(--radius-md)] bg-[var(--hover)] text-[var(--muted)] text-[13px]">…</div>
            )}
          </div>

          <div className="p-2 border-t border-[var(--line)] shrink-0">
            <div className="flex items-end gap-1.5 border border-solid border-[var(--line)] rounded-[var(--radius-md)] px-1.5 py-[4.5px] bg-[var(--field,_#fff)]">
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefine(); } }}
                placeholder="Décrivez une modification…"
                disabled={refining}
                rows={2}
                className="flex-1 resize-none border-0 outline-0 bg-transparent [font-family:inherit] text-[13.5px] text-[var(--ink)] leading-[1.5] py-[3px]"
              />
              <button className={cn('shrink-0 w-[34px] h-[34px] rounded-[50%] text-[#fff] grid place-items-[center]', refining || !instruction.trim() ? 'cursor-default' : 'cursor-pointer', instruction.trim() && !refining ? 'bg-[var(--accent)]' : 'bg-[var(--line)]')} style={{ border: 0, transition: 'background 150ms ease' }} type="button" aria-label="Envoyer" onClick={handleRefine} disabled={refining || !instruction.trim()}>
                <ArrowUp size={17} strokeWidth={2.4} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
