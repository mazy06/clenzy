import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../../utils/cn';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  AlertDescription,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
} from '../../../components/ui';
import { Sparkles, Rocket, AlertTriangle, ArrowLeft, Check, ArrowUp, Wand2, SquarePen, ChevronDown } from 'lucide-react';
import { sitesApi, type Site, type SitePage } from '../../../services/api/sitesApi';
import { SidebarTrigger, useSidebar } from '../../../components/ui/sidebar';

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
  // Meme source de verite que la bande qu'on remplace : le declencheur n'apparait
  // que lorsque la barre laterale est en mode feuille.
  const { isMobile } = useSidebar();
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
        <Skeleton className="h-[80vh] w-full rounded-xl" />
      </div>
    );
  }

  return (
    // `dvh` et non `vh` : sur mobile, `vh` compte la hauteur barre d'URL retractee.
    // L'ecran depassait donc par le bas et la saisie de l'assistant, tout en bas,
    // devenait inatteignable.
    <div className="h-[100dvh] flex flex-col bg-background overflow-x-hidden">
      {/* Barre supérieure — rangee unique : le titre se tronque, les libelles des
          actions cedent sous 900 px. Sans cela le nom du site s'ecrivait sur trois
          lignes et « Publier » sortait de l'ecran. */}
      <div className="flex items-center gap-2 px-2 py-2 border-b border-border shrink-0 min-[900px]:gap-3 min-[900px]:px-4">
        {/* Navigation de l'application : ici plutot que dans une bande a elle
            seule (cf. MainLayoutFull), qui coutait 48 px de haut pour un bouton. */}
        {isMobile && <SidebarTrigger className="shrink-0" />}
        <Button variant="ghost" onClick={() => navigate('/booking-engine/studio')} className="shrink-0 text-muted-foreground" aria-label="Retour au Studio">
          <ArrowLeft size={16} strokeWidth={2} />
          <span className="hidden min-[900px]:inline">Studio</span>
        </Button>
        <div className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{site?.name ?? 'Mon site'}</div>
        {/* Passage en ÉDITION MANUELLE : ouvre l'éditeur GrapesJS sur ce site (config liée). */}
        <Button
          variant="ghost"
          onClick={() => { if (site?.bookingEngineConfigId) navigate(`/booking-engine/studio/${site.bookingEngineConfigId}`); }}
          disabled={!site?.bookingEngineConfigId}
          className="shrink-0 text-muted-foreground"
          aria-label="Édition manuelle"
        >
          <SquarePen size={16} strokeWidth={2} />
          <span className="hidden min-[900px]:inline">Édition manuelle</span>
        </Button>
        <Button
          onClick={handlePublish}
          disabled={publishing || !selected?.dirty}
          className="shrink-0"
        >
          <Rocket size={16} strokeWidth={2} />
          {/* « Publier cette page » ne tient pas a cote du reste sur telephone :
              le libelle s'y raccourcit, sans jamais disparaitre — c'est l'action
              principale de l'ecran. */}
          <span className="min-[900px]:hidden">
            {publishing ? 'Publication…' : selected?.dirty ? 'Publier' : 'Publié'}
          </span>
          <span className="hidden min-[900px]:inline">
            {publishing ? 'Publication…' : selected?.dirty ? 'Publier cette page' : 'Publié'}
          </span>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mx-4 mt-2">
          <AlertTriangle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Corps : aperçu | conversation (la sélection de page vit dans la barre d'adresse de l'aperçu). */}
      {/* Empile sous 900 px. Les deux rangees etaient dimensionnees par leur
          CONTENU : l'apercu prenait ce qu'il voulait et la conversation, poussee
          en bas, se faisait clipper — sa zone de saisie devenait inatteignable.
          L'apercu est donc borne, la conversation prend tout le reste. */}
      <div className="flex-1 min-h-0 grid grid-cols-[1fr] grid-rows-[minmax(180px,38dvh)_minmax(0,1fr)] gap-0 min-[900px]:grid-cols-[1fr_360px] min-[900px]:grid-rows-[minmax(0,1fr)]">

        {/* Aperçu live */}
        <div className="p-3 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0 border border-border rounded-xl overflow-hidden flex flex-col shadow-sm">
            {/* Chrome navigateur */}
            <div className="flex items-center gap-1.5 px-[9px] py-1.5 bg-muted border-b border-border shrink-0">
              <div className="flex gap-1">
                {['#ff5f57', '#febc2e', '#28c840'].map((c) => <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: c }} key={c} />)}
              </div>
              {/* Barre d'adresse = sélecteur de page (remplace la colonne « Pages » retirée). */}
              <div className="flex-1 flex justify-center min-w-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-[4.5px] max-w-full cursor-pointer border border-field-line bg-field rounded-full px-[9px] py-[2.4px] text-muted-foreground text-xs transition-[border-color] duration-150 ease-out-quart motion-reduce:transition-none hover:border-primary" type="button" aria-label="Changer de page">
                      <span className="tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
                        {site?.slug ? `${site.slug}.baitly.site` : 'aperçu'}{selected?.path && selected.path !== '/' ? selected.path : ''}
                      </span>
                      {selected?.dirty && <div className="w-[6px] h-[6px] rounded-full bg-primary shrink-0" />}
                      <ChevronDown size={13} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center">
                    {pages?.map((p) => (
                      <DropdownMenuItem
                        key={p.id}
                        onSelect={() => setSelectedId(p.id)}
                        className="text-sm gap-[9px] min-w-[240px]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-foreground whitespace-nowrap overflow-hidden text-ellipsis">{p.title || p.path}</div>
                          <div className="text-2xs text-muted-foreground tabular-nums">{p.path}</div>
                        </div>
                        {p.dirty
                          ? <div className="w-[7px] h-[7px] rounded-full bg-primary shrink-0" title="Brouillon non publié" />
                          : <Check size={14} strokeWidth={2.4} color="var(--color-muted-foreground)" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Le fond blanc n'est pas du chrome Baitly : c'est la page du client rendue dans l'iframe. */}
            <div className="relative flex-1 min-h-0 bg-white">
              {refining && (
                <div className="absolute inset-0 bg-background/70 grid place-items-center z-[2] text-sm text-muted-foreground gap-1.5">
                  <Wand2 size={20} strokeWidth={1.8} /> Retouche en cours…
                </div>
              )}
              <iframe title="Aperçu de la page" srcDoc={srcDoc} sandbox="" style={{ width: '100%', height: '100%', border: 0, background: '#fff', display: 'block' }} />
            </div>
          </div>
        </div>

        {/* Conversation d'itération */}
        <div className="border-t border-border flex flex-col min-h-0 min-[900px]:border-t-0 min-[900px]:border-s">
          <div className="px-3 py-2 border-b border-border flex items-center gap-1.5 shrink-0">
            <Sparkles size={16} strokeWidth={2} color="var(--color-primary)" />
            <div className="text-sm font-semibold text-foreground">Assistant de design</div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2" ref={logRef}>
            {turns.length === 0 && !refining && (
              <div className="text-muted-foreground text-sm leading-[1.6]">
                Décrivez une modification de la page <b>{selected?.title || selected?.path}</b> en langage naturel.
                <ul className="ps-3.5 mt-1.5 flex flex-col gap-0.5">
                  <li>« Rends le hero plus chaleureux »</li>
                  <li>« Passe la liste des logements en 2 colonnes »</li>
                  <li>« Ajoute une section “à propos” sous le hero »</li>
                </ul>
              </div>
            )}
            {turns.map((turn, i) => (
              <div className={cn('max-w-[88%] px-[9px] py-1.5 rounded-lg text-sm leading-[1.5] flex gap-[4.5px] items-start', turn.role === 'user' ? 'self-end' : 'self-start', turn.role === 'user' ? 'bg-primary text-primary-foreground' : turn.error ? 'bg-destructive-soft text-destructive-ink' : 'bg-muted text-foreground')} key={i}>
                {turn.role === 'assistant' && !turn.error && <Check size={15} strokeWidth={2.4} style={{ flexShrink: 0, marginTop: 1 }} />}
                {turn.role === 'assistant' && turn.error && <AlertTriangle size={15} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />}
                <span>{turn.text}</span>
              </div>
            ))}
            {refining && (
              <div className="self-start px-2 py-1.5 rounded-lg bg-muted text-muted-foreground text-sm">…</div>
            )}
          </div>

          <div className="p-2 border-t border-border shrink-0">
            <div className="flex items-end gap-1.5 border border-field-line rounded-lg px-1.5 py-[4.5px] bg-field">
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefine(); } }}
                placeholder="Décrivez une modification…"
                disabled={refining}
                rows={2}
                className="flex-1 resize-none border-0 outline-0 bg-transparent [font-family:inherit] text-sm text-foreground leading-[1.5] py-[3px]"
              />
              {/* Envoi : gabarit du kit (fond primaire, focus clavier, etat desactive) plutot qu'un bouton refait a la main. */}
              <Button
                type="button"
                size="icon"
                aria-label="Envoyer"
                onClick={handleRefine}
                disabled={refining || !instruction.trim()}
                className="shrink-0 size-[34px] rounded-full"
              >
                <ArrowUp size={17} strokeWidth={2.4} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
