import { useEffect, useRef, useState } from 'react';
import { cn } from '../../../utils/cn';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AlertDescription,
  Button,
  Field as UiField,
  FieldLabel,
  Input,
  Spinner,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
} from '../../../components/ui';
import { Sparkles, AlertTriangle, Globe, FileText, SlidersHorizontal, Plus, ArrowRight, ArrowLeft, Check, LayoutGrid } from 'lucide-react';
import EmptyState from '../../../components/EmptyState';
import { bookingEngineApi, type BookingEngineConfigUpdate } from '../../../services/api/bookingEngineApi';
import { sitesApi, type SiteGenerationBrief } from '../../../services/api/sitesApi';
import { designSystemsApi, type DesignSystem, type DesignSystemSource } from '../../../services/api/designSystemsApi';
import { useNotification } from '../../../hooks/useNotification';
import { buildConfigPayload } from './StudioHome';
import SiteGenerationProgress from './SiteGenerationProgress';
import AiCreditsPaywall from '../../../components/AiCreditsPaywall';
import './openDesignCanvas.css';

/**
 * Écran plein « Générer mon site par IA » (modèle open-design — remplace l'ancienne modale wizard).
 * Deux étapes : 1) DIRECTION de design (réutiliser/créer une direction) → 2) BRIEF (type de biens, ton,
 * marque, couleur, langues). L'orchestration de génération vit ici (création config + site + generateSite),
 * puis atterrissage sur le studio immersif. Reçoit le brief pré-assemblé du Studio via `location.state`.
 */

// ── Brouillon de brief (sessionStorage, per-device, session-scoped) ──────────
const BRIEF_DRAFT_KEY = 'baitly_sitegen_brief';
interface SiteBriefDraft {
  propertyType?: string; tone?: string; brandName?: string;
  primaryColorHint?: string; languages?: string[]; selectedDsId?: number | null;
}
function readBriefDraft(): SiteBriefDraft | null {
  try {
    const raw = sessionStorage.getItem(BRIEF_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as SiteBriefDraft) : null;
  } catch { return null; }
}
function saveBriefDraft(d: SiteBriefDraft): void {
  try { sessionStorage.setItem(BRIEF_DRAFT_KEY, JSON.stringify(d)); } catch { /* quota / mode privé */ }
}
function clearBriefDraft(): void {
  try { sessionStorage.removeItem(BRIEF_DRAFT_KEY); } catch { /* ignore */ }
}

const LANGUAGE_CHOICES = [
  { code: 'fr', labelKey: 'french', fallback: 'Français' },
  { code: 'en', labelKey: 'english', fallback: 'Anglais' },
  { code: 'ar', labelKey: 'arabic', fallback: 'Arabe' },
] as const;

const DS_SOURCES: { id: DesignSystemSource; label: string; icon: typeof Globe }[] = [
  { id: 'URL', label: 'Site web', icon: Globe },
  { id: 'BRAND', label: 'Marque', icon: Sparkles },
  { id: 'PASTE', label: 'DESIGN.md', icon: FileText },
  { id: 'MANUAL', label: 'Manuel', icon: SlidersHorizontal },
];

const COMPLETENESS_FIELDS: { present: (b: Partial<SiteGenerationBrief>) => boolean; weight: number; hint: string }[] = [
  { present: (b) => !!b.propertyType?.trim(), weight: 25, hint: 'décrivez le type de biens' },
  { present: (b) => !!b.location, weight: 12, hint: 'ajoutez une localisation (SEO local)' },
  { present: (b) => !!(b.usps && b.usps.length), weight: 12, hint: 'listez vos points forts' },
  { present: (b) => !!b.audience, weight: 10, hint: 'précisez la clientèle cible' },
  { present: (b) => !!b.goal, weight: 8, hint: "définissez l'objectif principal" },
  { present: (b) => !!b.tone, weight: 8, hint: 'choisissez un ton' },
  { present: (b) => !!b.tier, weight: 7, hint: 'indiquez le niveau de gamme' },
  { present: (b) => !!b.brandName?.trim(), weight: 6, hint: 'renseignez le nom de marque' },
  { present: (b) => !!b.primaryColorHint, weight: 6, hint: 'définissez une couleur' },
  { present: (b) => !!(b.languages && b.languages.length), weight: 6, hint: 'sélectionnez les langues' },
];

function briefCompleteness(b: Partial<SiteGenerationBrief>): { score: number; hints: string[] } {
  let got = 0;
  let total = 0;
  const missing: { w: number; h: string }[] = [];
  for (const f of COMPLETENESS_FIELDS) {
    total += f.weight;
    if (f.present(b)) got += f.weight;
    else missing.push({ w: f.weight, h: f.hint });
  }
  missing.sort((x, y) => y.w - x.w);
  return { score: Math.round((got / total) * 100), hints: missing.slice(0, 2).map((m) => m.h) };
}

const uniqueConfigName = async (base: string): Promise<string> => {
  try {
    const configs = await bookingEngineApi.listConfigs();
    const taken = new Set(configs.map((c) => c.name));
    if (!taken.has(base)) return base;
    for (let i = 2; i <= 99; i += 1) { const n = `${base} ${i}`; if (!taken.has(n)) return n; }
    return `${base} ${Date.now().toString(36)}`;
  } catch { return base; }
};

export default function SiteGenerationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useNotification();
  const state = (location.state ?? {}) as { brief?: Partial<SiteGenerationBrief>; recap?: string };
  const initialBrief = state.brief ?? {};
  const recap = state.recap;

  // Brouillon de brief persistant (sessionStorage, per-device) : lu UNE fois → récupéré au retour sur l'écran.
  // L'état de navigation (brief venu du Studio) prime ; effacé après une génération réussie.
  const draftRef = useRef<SiteBriefDraft | null | undefined>(undefined);
  if (draftRef.current === undefined) {
    draftRef.current = readBriefDraft();
  }
  const draft = draftRef.current;

  const [step, setStep] = useState<1 | 2>(1);
  const [propertyType, setPropertyType] = useState(initialBrief.propertyType?.trim() || draft?.propertyType || '');
  const [tone, setTone] = useState(initialBrief.tone ?? draft?.tone ?? '');
  const [brandName, setBrandName] = useState(draft?.brandName ?? '');
  const [primaryColorHint, setPrimaryColorHint] = useState(
    /^#[0-9a-fA-F]{6}$/.test(initialBrief.primaryColorHint ?? '') ? (initialBrief.primaryColorHint as string) : (draft?.primaryColorHint ?? ''),
  );
  const [languages, setLanguages] = useState<string[]>(
    initialBrief.languages?.length ? initialBrief.languages : (draft?.languages?.length ? draft.languages : ['fr']),
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallBalance, setPaywallBalance] = useState<number | null>(null);

  // Étape 1 — direction de design
  const [systems, setSystems] = useState<DesignSystem[] | null>(null);
  const [selectedDsId, setSelectedDsId] = useState<number | null>(draft?.selectedDsId ?? null);
  const [dsCreating, setDsCreating] = useState(false);
  const [dsSource, setDsSource] = useState<DesignSystemSource>('URL');
  const [dsName, setDsName] = useState('');
  const [dsUrl, setDsUrl] = useState('');
  const [dsBrand, setDsBrand] = useState('');
  const [dsMarkdown, setDsMarkdown] = useState('');
  const [dsBusy, setDsBusy] = useState(false);

  useEffect(() => { designSystemsApi.list().then(setSystems).catch(() => setSystems([])); }, []);

  // Sauvegarde du brouillon à chaque changement (récupéré au retour ; effacé après génération réussie).
  useEffect(() => {
    saveBriefDraft({ propertyType, tone, brandName, primaryColorHint, languages, selectedDsId });
  }, [propertyType, tone, brandName, primaryColorHint, languages, selectedDsId]);

  const k = (key: string, fallback: string) => t(`bookingEngine.studio.ai.generate.${key}`, fallback);

  const canSubmit = propertyType.trim().length > 0 && languages.length > 0 && !generating;

  const { score: briefScore, hints: briefHints } = briefCompleteness({
    ...initialBrief, propertyType, tone: tone || null, brandName: brandName || null,
    primaryColorHint: primaryColorHint || null, languages,
  });
  // Deux jetons pour une meme information : `-ink` porte le TEXTE (contraste AA),
  // la teinte vive remplit la BARRE. Les memes seuils pilotent les deux.
  const briefScoreTextClass = briefScore >= 80 ? 'text-success-ink' : briefScore >= 50 ? 'text-primary' : 'text-warning-ink';
  const briefScoreBarClass = briefScore >= 80 ? 'bg-success' : briefScore >= 50 ? 'bg-primary' : 'bg-warning';

  const canCreateDs = dsName.trim() && (
    (dsSource === 'URL' && dsUrl.trim()) || (dsSource === 'BRAND' && dsBrand.trim()) ||
    (dsSource === 'PASTE' && dsMarkdown.trim()) || (dsSource === 'MANUAL' && dsMarkdown.trim())
  );

  const handleCreateDs = async () => {
    if (!canCreateDs || dsBusy) return;
    setDsBusy(true);
    setError(null);
    try {
      const created = await designSystemsApi.create({
        name: dsName.trim(), sourceType: dsSource,
        websiteUrl: dsSource === 'URL' ? dsUrl.trim() : undefined,
        brandDescription: dsSource === 'BRAND' ? dsBrand.trim() : undefined,
        designMarkdown: (dsSource === 'PASTE' || dsSource === 'MANUAL') ? dsMarkdown : undefined,
      });
      setSystems((prev) => (prev ? [created, ...prev] : [created]));
      setSelectedDsId(created.id);
      setDsCreating(false);
      setDsName(''); setDsUrl(''); setDsBrand(''); setDsMarkdown('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La création de la direction a échoué.');
    } finally {
      setDsBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setGenerating(true);
    setError(null);
    const brief: SiteGenerationBrief = {
      ...(initialBrief as SiteGenerationBrief),
      propertyType: propertyType.trim(),
      tone: tone.trim() || null,
      brandName: brandName.trim() || null,
      primaryColorHint: primaryColorHint.trim() || null,
      languages,
      designSystemId: selectedDsId ?? undefined,
    };
    try {
      const name = (brief.brandName?.trim() || brief.propertyType.trim()).slice(0, 40) || 'Nouveau booking engine';
      const overrides: Partial<BookingEngineConfigUpdate> = {};
      if (brief.primaryColorHint && /^#[0-9a-fA-F]{6}$/.test(brief.primaryColorHint)) overrides.primaryColor = brief.primaryColorHint;
      const created = await bookingEngineApi.createConfig({ ...buildConfigPayload(await uniqueConfigName(name)), ...overrides });
      const site = await sitesApi.ensureForConfig(created.id);
      const result = await sitesApi.generateSite(site.id, brief);
      const count = result.pagesCreated.length;
      notify.success(k('success', '{{count}} pages créées en brouillon — à relire avant publication.').replace('{{count}}', String(count)));
      clearBriefDraft(); // brief consommé → on n'a plus besoin du brouillon
      navigate(`/booking-engine/sites/${site.id}`);
    } catch (e) {
      const err = e as { status?: number; details?: { errorCode?: string; balanceMillicredits?: number } };
      const code = err?.details?.errorCode;
      if (err?.status === 422 && (code === 'AI_NOT_CONFIGURED' || code === 'AI_FEATURE_DISABLED')) {
        setUnavailable(true);
      } else if ((err?.status === 402 && code === 'AI_CREDITS_INSUFFICIENT') || (err?.status === 429 && code === 'AI_BUDGET_EXCEEDED')) {
        // Solde/quota IA insuffisant → paywall de rachat de crédits (packs Stripe existants).
        setPaywallBalance(err?.details?.balanceMillicredits ?? null);
        setPaywallOpen(true);
      } else {
        setError(e instanceof Error ? e.message : k('error', 'La génération a échoué. Réessayez dans un instant.'));
      }
      setGenerating(false);
    }
  };

  const selectedDsName = selectedDsId != null ? systems?.find((s) => s.id === selectedDsId)?.name : null;

  // ── États plein écran : génération en cours / indisponible ──
  if (generating) {
    return (
      <div className="od-canvas min-h-[100vh] bg-background grid place-items-center p-[18px]">
        <div className="w-full max-w-[560px]"><SiteGenerationProgress brandLabel={brandName.trim() || null} /></div>
      </div>
    );
  }
  if (unavailable) {
    return (
      <div className="od-canvas min-h-[100vh] bg-background grid place-items-center p-[18px]">
        <div className="w-full max-w-[460px]">
          <EmptyState
            variant="plain"
            icon={<AlertTriangle />}
            title={k('unavailableTitle', 'Génération IA indisponible')}
            description={k('unavailableBody', "Aucun modèle IA n'est disponible pour la génération de site pour le moment. Les administrateurs ont été notifiés et vont rétablir le service. Réessayez plus tard.")}
            action={<Button onClick={() => navigate(-1)}>{k('unavailableClose', 'Fermer')}</Button>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="od-canvas min-h-[100vh] bg-background">
      {/* Barre supérieure — sticky, grille 1fr auto 1fr, marque centrée (modèle .ds-setup-topbar). */}
      <div className="sticky top-0 z-[20] h-[64px] grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 min-[900px]:px-7 border-b border-border bg-background/90 backdrop-blur-md backdrop-saturate-150">
        <div className="justify-self-start">
          <Button variant="ghost" onClick={() => (step === 2 ? (setError(null), setStep(1)) : navigate(-1))}>
            <ArrowLeft size={16} strokeWidth={2} />
            {step === 2 ? k('back', 'Direction') : 'Retour'}
          </Button>
        </div>
        <div className="grid h-8 w-8 place-items-center justify-self-center text-primary"><LayoutGrid size={20} strokeWidth={2} /></div>
        <div className="justify-self-end">
          {step === 1 ? (
            <Button onClick={() => { setError(null); setStep(2); }}>
              {k('continue', 'Continuer vers le brief')}
              <ArrowRight size={16} strokeWidth={2} />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              <Sparkles size={16} strokeWidth={2} />
              {k('submit', 'Générer le site')}
            </Button>
          )}
        </div>
      </div>

      {/* Ruptures ecrites en pixels : le `md` MUI vaut 900px, pas les 768px de Tailwind. */}
      <div className="mx-auto grid max-w-[1320px] grid-cols-[1fr] items-start gap-[18px] px-3 py-[18px] min-[900px]:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] min-[900px]:gap-12 min-[900px]:px-6 min-[900px]:py-[30px]">
        {/* ─── Colonne gauche : cadrage + étapes — épinglée au scroll (position: sticky, comme open-design) ─── */}
        <div className="self-start min-[900px]:sticky min-[900px]:top-[84px]">
          <div className="inline-flex items-center gap-[4.5px] mb-[15px] ps-[3px] pe-[9px] py-[3px] rounded-full bg-primary-soft border border-solid border-primary/20">
            <div className="grid place-items-center w-[22px] h-[22px] rounded-full bg-primary text-primary-foreground shrink-0" aria-hidden>
              <Sparkles size={12} strokeWidth={2.4} />
            </div>
            <span className="text-2xs font-semibold tracking-wide uppercase text-primary">
              Génération IA
            </span>
          </div>
          <div className="[font-family:var(--font-display)] text-[30px] font-bold leading-[1.08] tracking-[-0.02em] text-balance text-foreground min-[900px]:text-[42px]">
            Générez votre site, en minutes
          </div>
          <div className="text-sm text-muted-foreground leading-[1.6] mt-3 max-w-[460px]">
            L'IA rédige et structure un site complet à partir de votre brief, puis en dérive un thème on-brand. Les pages sont créées en brouillon — à relire avant publication.
          </div>
          <div className="flex flex-col gap-2 mt-4">
            {[
              { n: 1, t: 'Direction de design', d: 'Réutilisez ou créez une direction — optionnel' },
              { n: 2, t: 'Brief', d: 'Type de biens, ton, marque, langues' },
            ].map((s) => {
              const active = step === s.n;
              return (
                <div className="flex gap-2 items-start" key={s.n}>
                  <div className={cn('grid place-items-center w-[22px] h-[22px] rounded-full shrink-0 mt-px text-2xs font-bold tabular-nums', active ? 'bg-primary text-primary-foreground' : 'bg-primary-soft text-primary')}>{s.n}</div>
                  <div>
                    <div className={cn('text-xs font-semibold', active ? 'text-foreground' : 'text-muted-foreground')}>{s.t}</div>
                    <div className="text-2xs text-muted-foreground">{s.d}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Récap direction + complétude (étape 2) */}
          {step === 2 && (
            <div className="mt-6 flex flex-col gap-2">
              {selectedDsName && (
                <div className="flex items-center gap-1 text-2xs text-foreground bg-primary-soft border border-border rounded-lg px-2 py-1.5">
                  <Check size={14} strokeWidth={2.4} className="text-primary shrink-0" /> {k('directionApplied', 'Direction')} : <b>{selectedDsName}</b>
                </div>
              )}
              {recap && (
                <div className="text-2xs text-foreground bg-card border border-border rounded-lg px-2 py-1.5 leading-[1.5]">
                  <span className="font-semibold">{k('briefRecap', 'Brief')} : </span>{recap}
                </div>
              )}
              <div>
                <div className="flex justify-between text-2xs text-muted-foreground mb-0.5">
                  <span>{k('completeness', 'Complétude du brief')}</span>
                  <span className={cn('font-semibold tabular-nums', briefScoreTextClass)}>{briefScore}%</span>
                </div>
                <div className="h-[6px] rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full transition-[width] duration-150 ease-out-quart motion-reduce:transition-none', briefScoreBarClass)}
                    style={{ width: `${briefScore}%` }}
                  />
                </div>
                {briefScore < 100 && briefHints.length > 0 && (
                  <div className="mt-0.5 text-2xs text-muted-foreground">{k('completenessHint', 'Pour un meilleur résultat')} : {briefHints.join(' · ')}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── Colonne droite : contenu d'étape ─── */}
        <div className="flex flex-col">
          {step === 1 ? (
            <>
              <div className="text-lg font-bold tracking-tight text-balance text-foreground">Direction de design</div>
              <div className="text-xs text-muted-foreground mt-0.5 mb-3 leading-[1.55]">
                {k('directionIntro', "Choisissez la DIRECTION (identité visuelle + voix) que l'IA suivra, ou créez-en une. Optionnel : sans direction, l'IA choisit un style.")}
              </div>

              {!dsCreating && (
                <>
                  <div className="flex flex-col gap-1">
                    <DirectionRow selected={selectedDsId === null} onClick={() => setSelectedDsId(null)}
                      title={k('directionNone', 'Sans direction')} subtitle={k('directionNoneSub', "L'IA choisit un style adapté au brief")} />
                    {systems === null && (
                      <div className="flex items-center gap-1.5 px-1.5 py-1.5 text-xs text-muted-foreground">
                        <Spinner className="size-[14px]" /> Chargement…
                      </div>
                    )}
                    {systems?.map((s) => (
                      <DirectionRow key={s.id} selected={selectedDsId === s.id} onClick={() => setSelectedDsId(s.id)}
                        title={s.name} subtitle={[s.category, s.scope === 'GLOBAL' ? 'Baitly' : 'Privé'].filter(Boolean).join(' · ')} />
                    ))}
                  </div>
                  <Button variant="outline" onClick={() => setDsCreating(true)} className="mt-1.5 self-start">
                    <Plus size={16} strokeWidth={2} /> {k('directionCreate', 'Créer une direction')}
                  </Button>
                </>
              )}

              {dsCreating && (
                <div className="flex flex-col gap-2 border border-border bg-card rounded-lg p-3">
                  <ToggleGroup
                    type="single"
                    value={dsSource}
                    onValueChange={(v) => { if (v) setDsSource(v as DesignSystemSource); }}
                    variant="outline"
                    size="sm"
                    className="flex-wrap"
                  >
                    {DS_SOURCES.map((s) => { const Icon = s.icon; return (
                      <ToggleGroupItem key={s.id} value={s.id} className="gap-1 px-[7.5px]"><Icon size={14} strokeWidth={2} /> {s.label}</ToggleGroupItem>
                    ); })}
                  </ToggleGroup>
                  <Input value={dsName} onChange={(e) => setDsName(e.target.value)} placeholder={k('directionName', 'Nom de la direction')} />
                  {dsSource === 'URL' && <Input value={dsUrl} onChange={(e) => setDsUrl(e.target.value)} placeholder="https://…" />}
                  {/* `field-sizing: content` du primitif neutralise `rows` : la hauteur
                      minimale se pose en lignes (`lh`) pour retrouver les minRows. */}
                  {dsSource === 'BRAND' && <Textarea value={dsBrand} onChange={(e) => setDsBrand(e.target.value)} placeholder={k('directionBrand', 'Décrivez la marque (ambiance, couleurs, voix…)')} className="min-h-[3lh]" />}
                  {(dsSource === 'PASTE' || dsSource === 'MANUAL') && <Textarea value={dsMarkdown} onChange={(e) => setDsMarkdown(e.target.value)} placeholder="# Design System…" className="min-h-[4lh] [font-family:ui-monospace,Menlo,monospace] text-xs" />}
                  <div className="flex justify-end gap-1.5">
                    <Button variant="outline" onClick={() => setDsCreating(false)} disabled={dsBusy}>{t('common.cancel', 'Annuler')}</Button>
                    <Button onClick={handleCreateDs} disabled={!canCreateDs || dsBusy}>
                      {dsBusy ? <><Spinner className="size-[15px]" /> {k('directionCreating', 'Création…')}</> : <><Sparkles size={16} strokeWidth={2} /> {k('directionDo', 'Créer')}</>}
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-lg font-bold tracking-tight text-balance text-foreground">Brief</div>
              <div className="text-xs text-muted-foreground mt-0.5 mb-3 leading-[1.55]">
                {k('intro', "Décrivez votre activité : l'IA rédige et structure un site complet (selon les pages choisies) et dérive un thème. Les pages sont créées en brouillon — à relire avant publication.")}
              </div>

              <div className="flex flex-col gap-3">
                <Field label={k('propertyTypeLabel', 'Type de biens')} required>
                  <Input value={propertyType} onChange={(e) => setPropertyType(e.target.value)} placeholder={k('propertyTypePlaceholder', 'Ex. riads de luxe à Marrakech, appartements urbains…')} autoFocus />
                </Field>
                <Field label={k('toneLabel', 'Ton souhaité')}>
                  <Input value={tone} onChange={(e) => setTone(e.target.value)} placeholder={k('tonePlaceholder', 'Ex. chaleureux et authentique, épuré et moderne…')} />
                </Field>
                <div className="flex gap-2 flex-wrap">
                  <Field label={k('brandLabel', 'Nom de marque')}>
                    <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder={k('brandPlaceholder', 'Optionnel')} />
                  </Field>
                  <Field label={k('colorLabel', 'Couleur principale')}>
                    <div className="flex items-center gap-1">
                      <input className="w-[38px] h-[38px] p-0 border border-solid border-field-line rounded-lg bg-field cursor-pointer shrink-0" type="color" value={/^#[0-9a-fA-F]{6}$/.test(primaryColorHint) ? primaryColorHint : '#5453D6'} onChange={(e) => setPrimaryColorHint((e.target as HTMLInputElement).value)} aria-label={k('colorPickerLabel', 'Choisir une couleur')} />
                      <Input value={primaryColorHint} onChange={(e) => setPrimaryColorHint(e.target.value)} placeholder={k('colorPlaceholder', 'Auto')} className="flex-1" />
                    </div>
                  </Field>
                </div>
                <Field label={k('languagesLabel', 'Langues à générer')} required>
                  <ToggleGroup
                    type="multiple"
                    value={languages}
                    onValueChange={setLanguages}
                    variant="outline"
                    className="flex-wrap"
                  >
                    {LANGUAGE_CHOICES.map((lang) => (
                      <ToggleGroupItem key={lang.code} value={lang.code}>
                        {t(`bookingEngine.studio.ai.locales.${lang.labelKey}`, lang.fallback)}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <div className="mt-1 text-2xs text-muted-foreground">{k('languagesHint', 'La première langue sélectionnée est rédigée par l’IA ; les autres sont produites par auto-traduction (à relire).')}</div>
                </Field>
              </div>
            </>
          )}

          {error && (
            <Alert variant="destructive" className="mt-3">
              <AlertTriangle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      {/* Paywall de rachat de crédits (402 AI_CREDITS_INSUFFICIENT / 429 quota) → packs Stripe existants. */}
      <AiCreditsPaywall open={paywallOpen} onClose={() => setPaywallOpen(false)} balanceMillicredits={paywallBalance} />
    </div>
  );
}

function DirectionRow({ selected, onClick, title, subtitle }: { selected: boolean; onClick: () => void; title: string; subtitle?: string }) {
  return (
    // Rangee de selection sur mesure (pas un gabarit de bouton du kit) : <button> nu
    // + classes. Les deux etats sont des branches litterales, une classe Tailwind ne
    // pouvant pas naitre d'une variable.
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center justify-between gap-2 text-start px-3 py-[6.6px] cursor-pointer',
        'rounded-lg border-[1.5px] border-solid',
        'transition-[border-color,background-color] duration-150 ease-out-quart motion-reduce:transition-none hover:border-primary',
        'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
        selected ? 'border-primary bg-primary-soft' : 'border-border bg-card',
      )}
    >
      <div className="min-w-0">
        <div className="text-xs font-semibold text-foreground">{title}</div>
        {subtitle && <div className="text-2xs text-muted-foreground">{subtitle}</div>}
      </div>
      {selected && <Check size={16} strokeWidth={2.4} className="text-primary shrink-0" />}
    </button>
  );
}

/** Champ de brief : le primitif `Field` du kit, avec la largeur fluide de cette grille. */
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <UiField className="flex-1 min-w-[200px]">
      <FieldLabel>
        {label}{required && <span className="text-primary ms-0.5">*</span>}
      </FieldLabel>
      {children}
    </UiField>
  );
}
