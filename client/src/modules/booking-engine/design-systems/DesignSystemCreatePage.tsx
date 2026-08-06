import { useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription, Badge, Button } from '../../../components/ui';
import { Spinner } from '../../../components/ui';
import {
  Collapsible,
  CollapsibleContent,
  Input,
  NativeSelect,
  NativeSelectOption,
  Separator,
  Switch,
  Textarea,
} from '../../../components/ui';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '../../../utils/cn';
import { ArrowLeft, ArrowRight, AlertTriangle, Sparkles, Upload, LayoutGrid } from 'lucide-react';
import { designSystemsApi, type DesignSystem, type DesignSystemCreateRequest } from '../../../services/api/designSystemsApi';
import { bookingEngineApi, type BookingEngineConfigUpdate } from '../../../services/api/bookingEngineApi';
import { buildConfigPayload } from '../studio/StudioHome';
import '../studio/openDesignCanvas.css';

/**
 * Écran plein « open-design » de conception d'un système de design (« Design a system, in minutes »).
 * Reproduit fidèlement la mise en page open-design : colonne gauche = cadrage + APERÇU LIVE ; colonne
 * droite = un tableau de sources en lignes « libellé (+ description) → champ », séparées par des filets,
 * SANS icônes décoratives sur les libellés. Le backend combine tout le contexte fourni (site, marque,
 * DESIGN.md, réglages manuels) en une seule génération. Les sources qui exigent un gros backend (fichiers,
 * dépôt, Figma, code local) sont présentes mais désactivées (« bientôt »).
 *
 * Deux modes selon `location.state.flow` :
 *  - défaut (menu « Systèmes de design ») → créer puis revenir à la liste.
 *  - `'blank'` (étape DIRECTION avant « Partir d'une page vierge ») → réutiliser/créer une direction, puis
 *    créer le booking engine vierge habillé de ses tokens et ouvrir l'éditeur. Remplace l'ancien modal.
 */

const HEX = /^#[0-9a-fA-F]{6}$/;

// Nom unique de booking engine (le backend impose l'unicité org+nom → 400 sinon). Suffixe contre la liste.
const uniqueEngineName = async (base: string): Promise<string> => {
  try {
    const configs = await bookingEngineApi.listConfigs();
    const taken = new Set(configs.map((c) => c.name));
    if (!taken.has(base)) return base;
    for (let i = 2; i <= 99; i += 1) { const n = `${base} ${i}`; if (!taken.has(n)) return n; }
    return `${base} ${Date.now().toString(36)}`;
  } catch { return base; }
};

export default function DesignSystemCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const flowState = (location.state ?? {}) as { flow?: 'blank'; funnelId?: string | null };
  const isBlankFlow = flowState.flow === 'blank';
  const [reuseId, setReuseId] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [brandDescription, setBrandDescription] = useState('');
  const [designMarkdown, setDesignMarkdown] = useState('');
  const [manualOn, setManualOn] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#6B8A9A');
  const [accentColor, setAccentColor] = useState('#C97A7A');
  const [headingFont, setHeadingFont] = useState('');
  const [bodyFont, setBodyFont] = useState('');

  const [systems, setSystems] = useState<DesignSystem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { designSystemsApi.list().then(setSystems).catch(() => {}); }, []);

  const hasSource = websiteUrl.trim() || brandDescription.trim() || designMarkdown.trim() || (manualOn && HEX.test(primaryColor));
  const canCreate = !!name.trim() && !!hasSource && !busy;

  // Aperçu : couleurs/polices affichées (réglages manuels si activés, sinon identité par défaut).
  const preview = useMemo(() => ({
    primary: manualOn && HEX.test(primaryColor) ? primaryColor : '#6B8A9A',
    accent: manualOn && HEX.test(accentColor) ? accentColor : '#4A9B8E',
    heading: manualOn && headingFont.trim() ? headingFont.trim() : 'Cormorant Garamond, Georgia, serif',
    body: manualOn && bodyFont.trim() ? bodyFont.trim() : 'Inter, system-ui, sans-serif',
  }), [manualOn, primaryColor, accentColor, headingFont, bodyFont]);

  const handleCopyFrom = async (id: number) => {
    try {
      const ds = await designSystemsApi.get(id);
      if (ds.designMarkdown) setDesignMarkdown(ds.designMarkdown);
    } catch { /* best-effort */ }
  };

  // Nom unique de booking engine (le backend impose l'unicité org+nom → 400 sinon). Suffixe contre la liste.
  const uniqueEngineName = async (base: string): Promise<string> => {
    try {
      const configs = await bookingEngineApi.listConfigs();
      const taken = new Set(configs.map((c) => c.name));
      if (!taken.has(base)) return base;
      for (let i = 2; i <= 99; i += 1) { const n = `${base} ${i}`; if (!taken.has(n)) return n; }
      return `${base} ${Date.now().toString(36)}`;
    } catch { return base; }
  };

  // Flux « page vierge » : direction choisie (id) ou aucune (null) → crée le booking engine habillé, ouvre l'éditeur.
  const continueWithDirection = async (designSystemId: number | null) => {
    setBusy(true);
    setError(null);
    try {
      const overrides: Partial<BookingEngineConfigUpdate> = {};
      if (designSystemId != null) {
        try {
          const ds = await designSystemsApi.get(designSystemId);
          if (ds.tokensJson) {
            overrides.designCssVariables = ds.tokensJson;
            try {
              const tokens = JSON.parse(ds.tokensJson) as Record<string, string>;
              if (tokens['--bt-color-primary']) overrides.primaryColor = tokens['--bt-color-primary'];
            } catch { /* tokens non-JSON : on garde designCssVariables brut */ }
          }
        } catch { /* best-effort : la direction n'est pas bloquante */ }
      }
      const engineName = await uniqueEngineName('Nouveau booking engine');
      const created = await bookingEngineApi.createConfig({ ...buildConfigPayload(engineName), ...overrides });
      navigate(`/booking-engine/studio/${created.id}`, { state: { funnelId: flowState.funnelId ?? null, designSystemId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Création du booking engine impossible.');
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (!canCreate) return;
    setBusy(true);
    setError(null);
    let tokensJson: string | undefined;
    if (manualOn) {
      const t: Record<string, string> = {};
      if (HEX.test(primaryColor)) t['--bt-color-primary'] = primaryColor;
      if (HEX.test(accentColor)) t['--bt-color-accent'] = accentColor;
      if (headingFont.trim()) t['--bt-font-heading'] = headingFont.trim();
      if (bodyFont.trim()) t['--bt-font-body'] = bodyFont.trim();
      if (Object.keys(t).length) tokensJson = JSON.stringify(t);
    }
    const body: DesignSystemCreateRequest = {
      name: name.trim(),
      websiteUrl: websiteUrl.trim() || undefined,
      brandDescription: brandDescription.trim() || undefined,
      designMarkdown: designMarkdown.trim() || undefined,
      tokensJson,
    };
    try {
      const created = await designSystemsApi.create(body);
      // Flux « page vierge » : enchaîne directement sur la création du booking engine habillé.
      if (isBlankFlow) { await continueWithDirection(created.id); return; }
      navigate('/booking-engine/design-systems');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La création du système a échoué.');
      setBusy(false);
    }
  };

  const primaryLabel = busy ? 'Création…' : isBlankFlow ? 'Créer & continuer' : 'Créer le système';

  return (
    <div className="od-canvas min-h-[100vh] bg-background">
      {/* Barre supérieure — sticky opaque, grille 1fr auto 1fr avec marque centrée (modèle .ds-setup-topbar).
          Fond plein plutot que voile floute : le verre decoratif est proscrit par le contrat Baitly UI. */}
      <div className="sticky top-0 z-[20] h-[64px] grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 min-[900px]:px-7 bg-background border-b border-border">
        <div className="justify-self-start">
          {/* Sortie de l'ecran : action tertiaire, aucun cadre au repos. */}
          <Button variant="ghost" onClick={() => navigate(-1)} className="text-muted-foreground">
            <ArrowLeft size={16} strokeWidth={2} />
            Retour
          </Button>
        </div>
        <div className="justify-self-center grid place-items-center w-8 h-8 text-primary"><LayoutGrid size={20} strokeWidth={2} /></div>
        <div className="justify-self-end">
          <Button onClick={handleCreate} disabled={!canCreate}>
            {busy ? <Spinner className="size-[15px]" /> : <Sparkles size={16} strokeWidth={2} />}
            {primaryLabel}
            {!busy && <ArrowRight size={16} strokeWidth={2} />}
          </Button>
        </div>
      </div>

      {/* Rupture MUI md = 900px (breakpoints non configures) ; gap 3 = 18px, px 2/4 = 12/24px, py 3/5 = 18/30px. */}
      <div className="grid grid-cols-[1fr] min-[900px]:grid-cols-[minmax(320px,_420px)_minmax(0,_1fr)] gap-[18px] min-[900px]:gap-[48px] items-start px-3 min-[900px]:px-6 py-[18px] min-[900px]:py-[30px] max-w-[1320px] mx-auto">
        {/* ─── Colonne gauche : cadrage + aperçu — épinglée au scroll (position: sticky, comme open-design) ─── */}
        <div className="min-[900px]:sticky min-[900px]:top-[84px] self-start">
          <div className="inline-flex items-center gap-[4.5px] mb-[15px] ps-[3px] pe-[9px] py-[3px] rounded-full bg-primary-soft border border-primary/20">
            <div className="grid place-items-center w-[22px] h-[22px] rounded-full bg-primary text-primary-foreground shrink-0" aria-hidden>
              <Sparkles size={12} strokeWidth={2.4} />
            </div>
            <span className="text-2xs font-semibold uppercase tracking-[0.09em] text-primary">
              Système de design
            </span>
          </div>
          <div className="[font-family:var(--font-display)] text-[30px] min-[900px]:text-[42px] font-bold leading-[1.08] text-foreground tracking-[-0.02em] text-balance">
            Concevez un système, en minutes
          </div>
          <div className="text-sm text-muted-foreground leading-[1.6] mt-3 max-w-[460px]">
            Un site, une marque ou un DESIGN.md — plus tout le contexte que vous avez — deviennent un système de design complet et on-brand, réutilisable partout.
          </div>
          <div className="text-2xs text-muted-foreground mt-3 font-semibold tracking-[0.02em] tabular-nums">
            3 étapes · ~3 min · DESIGN.md · tokens · aperçu
          </div>
          <div className="flex flex-col gap-2 mt-4">
            {[
              { n: 1, t: 'Site web ou DESIGN.md', d: 'Collez un lien, décrivez une marque, ou copiez des tokens' },
              { n: 2, t: 'Ajoutez du contexte', d: 'Réglages manuels, fichiers, dépôt — optionnel' },
              { n: 3, t: 'Générez', d: 'Extraction rapide d’abord ; l’IA affine ensuite' },
            ].map((s) => (
              <div className="flex gap-2 items-center" key={s.n}>
                <div className="grid place-items-center w-[26px] h-[26px] rounded-full bg-primary-soft border border-primary/25 text-primary text-xs font-semibold shrink-0 tabular-nums">{s.n}</div>
                <div>
                  <div className="text-xs font-semibold text-foreground">{s.t}</div>
                  <div className="text-2xs text-muted-foreground">{s.d}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Aperçu live du système — halo diffus derrière la carte (modèle open-design .showcaseGlow). */}
          <div className="relative mt-6 rounded-2xl border border-border p-[15px] bg-card shadow-sm">
            {/* L'ancien ::before devient un vrai enfant : un pseudo-element ne peut
                pas recevoir de degrade depuis `style`, et l'ecrire en valeur
                arbitraire Tailwind rendrait la declaration illisible. */}
            <div
              aria-hidden
              className="pointer-events-none absolute -z-10 rounded-[30px] blur-[22px] opacity-55"
              style={{
                inset: '-14% -8% -22%',
                background: 'radial-gradient(60% 60% at 30% 20%, color-mix(in srgb, var(--color-primary) 22%, transparent), transparent 70%), radial-gradient(50% 50% at 85% 90%, color-mix(in srgb, var(--color-info) 18%, transparent), transparent 70%)',
              }}
            />
            <div className="flex items-center gap-1 mb-3">
              <div className="flex gap-0.5">{['#ff5f57', '#febc2e', '#28c840'].map((c) => <div className="w-[9px] h-[9px] rounded-full" style={{ backgroundColor: c }} key={c} />)}</div>
              <div className="text-2xs font-semibold text-muted-foreground ms-0.5">Votre système de design</div>
            </div>
            <Label>Palette</Label>
            <div className="flex gap-1.5 mb-3">
              {[preview.primary, preview.accent, '#2b2420', '#e8ddcb', '#faf6ef'].map((c, i) => (
                <div className="flex-1 h-[40px] rounded-md border border-border" style={{ backgroundColor: c }} key={i} />
              ))}
            </div>
            <Label>Échelle typographique</Label>
            <div className="flex items-baseline gap-[9px] mb-3 text-foreground" style={{ fontFamily: preview.heading }}>
              <div className="text-[40px] font-bold leading-[1]">Aa</div>
              <div className="text-[26px] font-semibold leading-[1]">Aa</div>
              <div className="text-[17px] text-muted-foreground leading-[1]">Aa</div>
            </div>
            <Label>Composants</Label>
            <div className="flex items-center gap-1.5">
              {/* Ces deux pastilles montrent la palette EXTRAITE (couleurs arbitraires du
                  client) : l'encre blanche y est imposee par le fond, pas par la marque. */}
              <div className="px-[10.5px] py-[4.5px] rounded-md text-white text-xs font-semibold" style={{ backgroundColor: preview.primary, fontFamily: preview.body }}>Primaire</div>
              <div className="px-[10.5px] py-[4.5px] rounded-md border border-border text-foreground text-xs font-semibold" style={{ fontFamily: preview.body }}>Ghost</div>
              <div className="flex-1 h-[8px] rounded-full bg-muted" />
            </div>
          </div>
        </div>

        {/* ─── Colonne droite : tableau de sources (libellé → champ) ─── */}
        <div className="flex flex-col">
          {/* Flux « page vierge » : réutiliser une direction existante ou partir sans direction, sans rien créer. */}
          {isBlankFlow && (
            <div className="border border-border rounded-lg p-3 mb-[18px] flex flex-col gap-[9px] bg-card">
              <div className="text-xs font-semibold text-foreground">Réutiliser une direction existante</div>
              <div className="flex gap-1.5 flex-wrap items-center">
                <NativeSelect
                  size="sm"
                  className="min-w-[240px] flex-1"
                  aria-label="Système de design à réutiliser"
                  value={reuseId ?? ''}
                  disabled={busy}
                  onChange={(e) => setReuseId(e.target.value === '' ? null : Number(e.target.value))}
                >
                  {/* L'ancien `renderValue` faisait office de placeholder : une option
                      vide non selectionnable tient le meme role sur un select natif. */}
                  <NativeSelectOption value="" disabled={systems.length > 0}>
                    {systems.length === 0 ? "Aucun système pour l'instant" : 'Choisir un système de design…'}
                  </NativeSelectOption>
                  {systems.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
                </NativeSelect>
                <Button disabled={reuseId == null || busy} onClick={() => continueWithDirection(reuseId)}>
                  Continuer
                  <ArrowRight size={16} strokeWidth={2} />
                </Button>
                {/* Echappatoire du bloc « reutiliser » : action tertiaire. */}
                <Button variant="ghost" disabled={busy} onClick={() => continueWithDirection(null)} className="text-muted-foreground">
                  Sans direction
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Separator className="flex-1" />
                <div className="text-2xs text-muted-foreground uppercase tracking-[0.08em] font-semibold">ou créez-en une</div>
                <Separator className="flex-1" />
              </div>
            </div>
          )}

          <div className="text-lg font-semibold tracking-tight text-foreground text-balance">Extraire depuis un site, un dépôt ou vos éléments sources</div>
          <div className="text-xs text-muted-foreground mt-0.5 leading-[1.55]">
            Commencez avec un site, un DESIGN.md ou des éléments qui montrent votre style. Baitly crée d'abord un système utilisable, puis l'IA l'affine.
          </div>

          {/* Tableau de sources dans une carte — lignes « libellé (gauche) → description + champ (droite) »
              séparées par des filets doux (modèle open-design .ds-resource-card / .ds-resource-row). */}
          <div className="mt-[9px] border border-border rounded-xl bg-card shadow-sm overflow-hidden [&>.od-row+.od-row]:border-t [&>.od-row+.od-row]:border-border">
            <Row label="Nom du système" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Riad Marrakech" aria-label="Nom du système" />
            </Row>

            <Row label="Site web" description="Collez l'URL d'un site dont vous aimez le style — l'IA en extrait couleurs, typo et ambiance.">
              <div className="flex gap-1.5 flex-wrap">
                <Input className="flex-1 min-w-[220px]" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://votre-site.com" aria-label="Site web" />
                {/* Textarea du kit ne transmet pas de ref (composant fonction, React 18) :
                    le focus passe par l'id du champ plutot que par un inputRef. */}
                <Button variant="outline" onClick={() => document.getElementById(BRAND_FIELD_ID)?.focus()}
                  className="whitespace-nowrap hover:border-primary">
                  <Sparkles size={15} strokeWidth={2} />
                  Partir d'une marque
                </Button>
              </div>
            </Row>

            <Row label="Décrire la marque" optional description="Voix de marque, intro et contexte produit. Utilisé pour la génération et l'affinage IA.">
              {/* `field-sizing: content` du primitif neutralise `rows` : la hauteur
                  minimale de 3 lignes se pose en min-h. */}
              <Textarea id={BRAND_FIELD_ID} aria-label="Décrire la marque" value={brandDescription} onChange={(e) => setBrandDescription(e.target.value)}
                className="min-h-[3lh]"
                placeholder="Ex. conciergerie de riads à Marrakech, feutré, terracotta et zelliges, voix chaleureuse et raffinée…" />
            </Row>

            <Row label="Coller un DESIGN.md" optional
              description={<>Collez un DESIGN.md pour créer directement depuis tokens, rationale et guidage de composants. <a className="text-primary no-underline font-semibold" href="/DESIGN-BAITLY.md" target="_blank" rel="noreferrer">Référence ↗</a></>}>
              {systems.length > 0 && (
                // Ce select ne porte pas d'etat : il declenche une copie puis revient
                // sur son option-titre (d'ou `value=""` constant).
                <NativeSelect
                  size="sm"
                  className="mb-[7.5px] min-w-[260px]"
                  aria-label="Copier depuis un système existant"
                  value=""
                  onChange={(e) => e.target.value && handleCopyFrom(Number(e.target.value))}
                >
                  <NativeSelectOption value="">Copier depuis un système existant</NativeSelectOption>
                  {systems.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
                </NativeSelect>
              )}
              <Textarea value={designMarkdown} onChange={(e) => setDesignMarkdown(e.target.value)}
                aria-label="Coller un DESIGN.md"
                placeholder={'# Riad Lune d\'Argile\n> Catégorie : conciergerie\n\n## Palette & rôles\nTerracotta (#c96442) en accent…\n\n## Typographie\nSerif éditorial…\n\n## Voix & ton\nChaleureuse, raffinée…'}
                className="min-h-[5lh] [font-family:ui-monospace,Menlo,monospace] text-xs" />
            </Row>

            <Row label="Réglages manuels" optional description="Couleur et polices — priment sur les tokens dérivés par l'IA.">
              <div className="flex items-center gap-1.5">
                <Switch id="ds-manual-toggle" size="sm" checked={manualOn} onCheckedChange={setManualOn} />
                <label htmlFor="ds-manual-toggle" className="cursor-pointer text-xs text-foreground">
                  {manualOn ? 'Activés' : 'Définir manuellement couleur & typo'}
                </label>
              </div>
              <Collapsible open={manualOn}>
                <CollapsibleContent>
                  <div className="flex flex-col gap-2 mt-2.5">
                    <div className="flex gap-2 flex-wrap">
                      <ColorField label="Couleur principale" value={primaryColor} onChange={setPrimaryColor} />
                      <ColorField label="Couleur d'accent" value={accentColor} onChange={setAccentColor} />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <TextField label="Police des titres" value={headingFont} onChange={setHeadingFont} placeholder="Ex. Cormorant Garamond, serif" />
                      <TextField label="Police du corps" value={bodyFont} onChange={setBodyFont} placeholder="Ex. Inter, system-ui" />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Row>

            {/* Sources à venir : présentes pour parité open-design, désactivées en attendant le backend. */}
            <Row label="Ajouter des fichiers" optional soon description="Images, logos, polices, PDF, HTML — jusqu'à 12 Mo chacun.">
              <div className="border border-dashed border-border rounded-lg py-[18px] flex flex-col items-center gap-[3px] text-muted-foreground bg-field">
                <Upload size={20} strokeWidth={2} />
                <div className="text-xs font-semibold">Glisser-déposer, coller ou parcourir</div>
                <div className="text-2xs">Extraction en tokens & assets — bientôt</div>
              </div>
            </Row>

            <Row label="Dépôt GitHub" optional soon description="Analyse d'un repo pour en extraire le système existant.">
              <Input disabled aria-label="Dépôt GitHub" placeholder="https://github.com/org/repo" />
            </Row>

            <Row label="Figma / .fig" optional soon description="Décodage en tokens, composants & assets réels.">
              <Input disabled aria-label="Figma / .fig" placeholder="https://figma.com/file/… ou un fichier .fig" />
            </Row>

            <Row label="Code local" optional soon description="Un dossier ou des fichiers de votre machine.">
              <Button disabled variant="outline">Parcourir un dossier</Button>
            </Row>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-3">
              <AlertTriangle />
              <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end mt-4">
            <Button onClick={handleCreate} disabled={!canCreate}>
              {busy ? <Spinner className="size-[15px]" /> : <Sparkles size={16} strokeWidth={2} />}
              {primaryLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5">{children}</div>;
}

/** Ligne du tableau de sources : libellé (+ « optionnel » / « bientôt ») à gauche, description + champ à droite. */
function Row({ label, required, optional, soon, description, children }: {
  label: string; required?: boolean; optional?: boolean; soon?: boolean; description?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'od-row grid grid-cols-[1fr] min-[900px]:grid-cols-[220px_minmax(0,_1fr)] gap-1.5 min-[900px]:gap-[16px]',
        'items-start px-[18px] py-[16px]',
        soon ? 'opacity-60' : 'opacity-100',
      )}
    >
      <div>
        <div className="text-sm font-semibold text-foreground leading-[1.3]">
          {label}{required && <span className="text-primary ms-0.5">*</span>}
        </div>
        {optional && <div className="text-2xs font-medium text-muted-foreground mt-0.5">optionnel</div>}
        {soon && <Badge variant="secondary" className="h-[18px] mt-0.5 text-2xs font-semibold">Bientôt</Badge>}
      </div>
      <div>
        {description && <div className="text-xs text-muted-foreground leading-[1.5] mb-2">{description}</div>}
        {children}
      </div>
    </div>
  );
}

const SUBFIELD_LABEL_CLASS = 'block mb-0.5 text-2xs font-medium text-muted-foreground';

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex-1 min-w-[200px]">
      <label className={SUBFIELD_LABEL_CLASS}>{label}</label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex-1 min-w-[200px]">
      <label className={SUBFIELD_LABEL_CLASS}>{label}</label>
      <div className="flex items-center gap-1">
        <input className="w-[40px] h-[40px] p-0 border border-field-line rounded-lg bg-field cursor-pointer shrink-0" type="color" value={HEX.test(value) ? value : '#6B8A9A'} onChange={(e) => onChange((e.target as HTMLInputElement).value)} aria-label={label} />
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#……" aria-label={`${label} (hexadécimal)`} className="flex-1" />
      </div>
    </div>
  );
}

// Id du champ « Décrire la marque » : le bouton « Partir d'une marque » y donne le
// focus sans passer par une ref (les primitives du kit n'en transmettent pas).
const BRAND_FIELD_ID = 'ds-brand-description';
