import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Button, InputBase, ButtonBase, CircularProgress, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { Sparkles, AlertTriangle, Globe, FileText, SlidersHorizontal, Plus, ArrowRight, ArrowLeft, Check, LayoutGrid } from 'lucide-react';
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

  const toggleLanguage = (code: string) =>
    setLanguages((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const canSubmit = propertyType.trim().length > 0 && languages.length > 0 && !generating;

  const { score: briefScore, hints: briefHints } = briefCompleteness({
    ...initialBrief, propertyType, tone: tone || null, brandName: brandName || null,
    primaryColorHint: primaryColorHint || null, languages,
  });
  const briefScoreColor = briefScore >= 80 ? 'var(--ok, #3E8E7E)' : briefScore >= 50 ? 'var(--accent)' : 'var(--warn, #D4A574)';

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

  const uniqueConfigName = async (base: string): Promise<string> => {
    try {
      const configs = await bookingEngineApi.listConfigs();
      const taken = new Set(configs.map((c) => c.name));
      if (!taken.has(base)) return base;
      for (let i = 2; i <= 99; i += 1) { const n = `${base} ${i}`; if (!taken.has(n)) return n; }
      return `${base} ${Date.now().toString(36)}`;
    } catch { return base; }
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
      <Box className="od-canvas" sx={{ minHeight: '100vh', bgcolor: 'var(--bg)', display: 'grid', placeItems: 'center', p: 3 }}>
        <Box sx={{ width: '100%', maxWidth: 560 }}><SiteGenerationProgress brandLabel={brandName.trim() || null} /></Box>
      </Box>
    );
  }
  if (unavailable) {
    return (
      <Box className="od-canvas" sx={{ minHeight: '100vh', bgcolor: 'var(--bg)', display: 'grid', placeItems: 'center', p: 3 }}>
        <Box sx={{ maxWidth: 420, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 48, height: 48, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'var(--err-soft)', color: 'var(--err)' }}><AlertTriangle size={26} strokeWidth={2} /></Box>
          <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--ink)' }}>{k('unavailableTitle', 'Génération IA indisponible')}</Box>
          <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', lineHeight: 1.55 }}>{k('unavailableBody', "Aucun modèle IA n'est disponible pour la génération de site pour le moment. Les administrateurs ont été notifiés et vont rétablir le service. Réessayez plus tard.")}</Box>
          <Button disableElevation onClick={() => navigate(-1)} sx={{ ...accentBtnSx, mt: 1 }}>{k('unavailableClose', 'Fermer')}</Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box className="od-canvas" sx={{ minHeight: '100vh', bgcolor: 'var(--bg)' }}>
      {/* Barre supérieure — sticky frostée, grille 1fr auto 1fr, marque centrée (modèle .ds-setup-topbar). */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 20, height: 64, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 2, px: { xs: 2, md: '28px' }, borderBottom: '1px solid var(--line)', bgcolor: 'color-mix(in srgb, var(--bg) 88%, transparent)', backdropFilter: 'saturate(1.4) blur(10px)' }}>
        <Box sx={{ justifySelf: 'start' }}>
          <Button onClick={() => (step === 2 ? (setError(null), setStep(1)) : navigate(-1))} startIcon={<ArrowLeft size={16} strokeWidth={2} />} sx={{ textTransform: 'none', color: 'var(--muted)' }}>
            {step === 2 ? k('back', 'Direction') : 'Retour'}
          </Button>
        </Box>
        <Box sx={{ justifySelf: 'center', display: 'grid', placeItems: 'center', width: 32, height: 32, color: 'var(--accent)' }}><LayoutGrid size={20} strokeWidth={2} /></Box>
        <Box sx={{ justifySelf: 'end' }}>
          {step === 1 ? (
            <Button disableElevation onClick={() => { setError(null); setStep(2); }}
              endIcon={<ArrowRight size={16} strokeWidth={2} />} sx={accentBtnSx}>{k('continue', 'Continuer vers le brief')}</Button>
          ) : (
            <Button disableElevation onClick={handleSubmit} disabled={!canSubmit}
              startIcon={<Sparkles size={16} strokeWidth={2} />} sx={accentBtnSx}>{k('submit', 'Générer le site')}</Button>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(320px, 420px) minmax(0, 1fr)' }, gap: { xs: 3, md: '48px' }, alignItems: 'start', px: { xs: 2, md: 4 }, py: { xs: 3, md: 5 }, maxWidth: 1320, mx: 'auto' }}>
        {/* ─── Colonne gauche : cadrage + étapes — épinglée au scroll (position: sticky, comme open-design) ─── */}
        <Box sx={{ position: { md: 'sticky' }, top: { md: 84 }, alignSelf: 'start' }}>
          <Box sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.75, mb: 2.5, pl: 0.5, pr: 1.5, py: 0.5,
            borderRadius: 'var(--radius-pill, 999px)',
            bgcolor: 'color-mix(in srgb, var(--accent) 7%, var(--surface))',
            border: '1px solid', borderColor: 'color-mix(in srgb, var(--accent) 18%, var(--line))',
            boxShadow: '0 1px 2px color-mix(in srgb, var(--accent) 8%, transparent)',
          }}>
            <Box aria-hidden sx={{
              display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: '50%',
              bgcolor: 'var(--accent)', color: 'var(--on-accent)', flexShrink: 0,
              boxShadow: '0 1px 4px color-mix(in srgb, var(--accent) 40%, transparent)',
            }}>
              <Sparkles size={12} strokeWidth={2.4} />
            </Box>
            <Box component="span" sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--accent)' }}>
              Génération IA
            </Box>
          </Box>
          <Box sx={{ fontFamily: 'var(--font-display)', fontSize: { xs: 30, md: 42 }, fontWeight: 700, lineHeight: 1.08, color: 'var(--ink)', letterSpacing: '-0.02em', textWrap: 'balance' }}>
            Générez votre site, en minutes
          </Box>
          <Box sx={{ fontSize: 'var(--text-md)', color: 'var(--muted)', lineHeight: 1.6, mt: 2, maxWidth: 460 }}>
            L'IA rédige et structure un site complet à partir de votre brief, puis en dérive un thème on-brand. Les pages sont créées en brouillon — à relire avant publication.
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 3 }}>
            {[
              { n: 1, t: 'Direction de design', d: 'Réutilisez ou créez une direction — optionnel' },
              { n: 2, t: 'Brief', d: 'Type de biens, ton, marque, langues' },
            ].map((s) => {
              const active = step === s.n;
              return (
                <Box key={s.n} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
                  <Box sx={{ display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: '50%', flexShrink: 0, mt: 0.2, fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', bgcolor: active ? 'var(--accent)' : 'var(--accent-soft)', color: active ? 'var(--on-accent)' : 'var(--accent)' }}>{s.n}</Box>
                  <Box>
                    <Box sx={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: active ? 'var(--ink)' : 'var(--body)' }}>{s.t}</Box>
                    <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--muted)' }}>{s.d}</Box>
                  </Box>
                </Box>
              );
            })}
          </Box>

          {/* Récap direction + complétude (étape 2) */}
          {step === 2 && (
            <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {selectedDsName && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 'var(--text-2xs)', color: 'var(--body)', bgcolor: 'var(--accent-soft)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', px: 1.25, py: 1 }}>
                  <Check size={14} strokeWidth={2.4} style={{ color: 'var(--accent)' }} /> {k('directionApplied', 'Direction')} : <b>{selectedDsName}</b>
                </Box>
              )}
              {recap && (
                <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--body)', bgcolor: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', px: 1.25, py: 1, lineHeight: 1.5 }}>
                  <Box component="span" sx={{ fontWeight: 600, color: 'var(--ink)' }}>{k('briefRecap', 'Brief')} : </Box>{recap}
                </Box>
              )}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-2xs)', color: 'var(--muted)', mb: 0.5 }}>
                  <span>{k('completeness', 'Complétude du brief')}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: briefScoreColor }}>{briefScore}%</span>
                </Box>
                <Box sx={{ height: 6, borderRadius: 999, bgcolor: 'var(--line)', overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: `${briefScore}%`, bgcolor: briefScoreColor, transition: 'width var(--duration-fast) var(--ease-out)' }} />
                </Box>
                {briefScore < 100 && briefHints.length > 0 && (
                  <Box sx={{ mt: 0.5, fontSize: 'var(--text-2xs)', color: 'var(--muted)' }}>{k('completenessHint', 'Pour un meilleur résultat')} : {briefHints.join(' · ')}</Box>
                )}
              </Box>
            </Box>
          )}
        </Box>

        {/* ─── Colonne droite : contenu d'étape ─── */}
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {step === 1 ? (
            <>
              <Box sx={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--ink)' }}>Direction de design</Box>
              <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', mt: 0.5, mb: 2, lineHeight: 1.55 }}>
                {k('directionIntro', "Choisissez la DIRECTION (identité visuelle + voix) que l'IA suivra, ou créez-en une. Optionnel : sans direction, l'IA choisit un style.")}
              </Box>

              {!dsCreating && (
                <>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    <DirectionRow selected={selectedDsId === null} onClick={() => setSelectedDsId(null)}
                      title={k('directionNone', 'Sans direction')} subtitle={k('directionNoneSub', "L'IA choisit un style adapté au brief")} />
                    {systems === null && <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', px: 1, py: 1 }}>Chargement…</Box>}
                    {systems?.map((s) => (
                      <DirectionRow key={s.id} selected={selectedDsId === s.id} onClick={() => setSelectedDsId(s.id)}
                        title={s.name} subtitle={[s.category, s.scope === 'GLOBAL' ? 'Baitly' : 'Privé'].filter(Boolean).join(' · ')} />
                    ))}
                  </Box>
                  <ButtonBase onClick={() => setDsCreating(true)} sx={{ ...ghostBtnSx, mt: 1.5, alignSelf: 'flex-start' }}>
                    <Plus size={16} strokeWidth={2} /> {k('directionCreate', 'Créer une direction')}
                  </ButtonBase>
                </>
              )}

              {dsCreating && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', p: 2 }}>
                  <ToggleButtonGroup value={dsSource} exclusive onChange={(_, v) => v && setDsSource(v)} size="small"
                    sx={{ flexWrap: 'wrap', gap: 0.5, '& .MuiToggleButton-root': { border: '1px solid var(--line)', borderRadius: 'var(--radius-md) !important', color: 'var(--body)', '&.Mui-selected': { bgcolor: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--accent)' } } }}>
                    {DS_SOURCES.map((s) => { const Icon = s.icon; return (
                      <ToggleButton key={s.id} value={s.id} sx={{ textTransform: 'none', gap: 0.5, px: 1.25 }}><Icon size={14} strokeWidth={2} /> {s.label}</ToggleButton>
                    ); })}
                  </ToggleButtonGroup>
                  <InputBase value={dsName} onChange={(e) => setDsName(e.target.value)} placeholder={k('directionName', 'Nom de la direction')} sx={inputSx} />
                  {dsSource === 'URL' && <InputBase value={dsUrl} onChange={(e) => setDsUrl(e.target.value)} placeholder="https://…" sx={inputSx} />}
                  {dsSource === 'BRAND' && <InputBase value={dsBrand} onChange={(e) => setDsBrand(e.target.value)} placeholder={k('directionBrand', 'Décrivez la marque (ambiance, couleurs, voix…)')} multiline minRows={3} sx={inputSx} />}
                  {(dsSource === 'PASTE' || dsSource === 'MANUAL') && <InputBase value={dsMarkdown} onChange={(e) => setDsMarkdown(e.target.value)} placeholder="# Design System…" multiline minRows={4} sx={{ ...inputSx, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 'var(--text-sm)' }} />}
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    <ButtonBase onClick={() => setDsCreating(false)} disabled={dsBusy} sx={ghostBtnSx}>{t('common.cancel', 'Annuler')}</ButtonBase>
                    <ButtonBase onClick={handleCreateDs} disabled={!canCreateDs || dsBusy} sx={primaryBtnSx}>
                      {dsBusy ? <><CircularProgress size={15} thickness={5} sx={{ color: 'var(--on-accent)' }} /> {k('directionCreating', 'Création…')}</> : <><Sparkles size={16} strokeWidth={2} /> {k('directionDo', 'Créer')}</>}
                    </ButtonBase>
                  </Box>
                </Box>
              )}
            </>
          ) : (
            <>
              <Box sx={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--ink)' }}>Brief</Box>
              <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', mt: 0.5, mb: 2, lineHeight: 1.55 }}>
                {k('intro', "Décrivez votre activité : l'IA rédige et structure un site complet (selon les pages choisies) et dérive un thème. Les pages sont créées en brouillon — à relire avant publication.")}
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Field label={k('propertyTypeLabel', 'Type de biens')} required>
                  <InputBase value={propertyType} onChange={(e) => setPropertyType(e.target.value)} placeholder={k('propertyTypePlaceholder', 'Ex. riads de luxe à Marrakech, appartements urbains…')} sx={inputSx} autoFocus />
                </Field>
                <Field label={k('toneLabel', 'Ton souhaité')}>
                  <InputBase value={tone} onChange={(e) => setTone(e.target.value)} placeholder={k('tonePlaceholder', 'Ex. chaleureux et authentique, épuré et moderne…')} sx={inputSx} />
                </Field>
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                  <Field label={k('brandLabel', 'Nom de marque')}>
                    <InputBase value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder={k('brandPlaceholder', 'Optionnel')} sx={inputSx} />
                  </Field>
                  <Field label={k('colorLabel', 'Couleur principale')}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box component="input" type="color" value={/^#[0-9a-fA-F]{6}$/.test(primaryColorHint) ? primaryColorHint : '#5453D6'} onChange={(e) => setPrimaryColorHint((e.target as HTMLInputElement).value)} aria-label={k('colorPickerLabel', 'Choisir une couleur')} sx={{ width: 38, height: 38, p: 0, border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', bgcolor: 'var(--field)', cursor: 'pointer', flexShrink: 0 }} />
                      <InputBase value={primaryColorHint} onChange={(e) => setPrimaryColorHint(e.target.value)} placeholder={k('colorPlaceholder', 'Auto')} sx={{ ...inputSx, flex: 1 }} />
                    </Box>
                  </Field>
                </Box>
                <Field label={k('languagesLabel', 'Langues à générer')} required>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {LANGUAGE_CHOICES.map((lang) => {
                      const selected = languages.includes(lang.code);
                      return (
                        <ButtonBase key={lang.code} onClick={() => toggleLanguage(lang.code)} aria-pressed={selected}
                          sx={{ height: 34, px: 1.5, borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', cursor: 'pointer', border: '1px solid', borderColor: selected ? 'var(--accent)' : 'var(--line)', color: selected ? 'var(--on-accent)' : 'var(--body)', bgcolor: selected ? 'var(--accent)' : 'transparent', transition: 'background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out)', '&:hover': { borderColor: 'var(--accent)' } }}>
                          {t(`bookingEngine.studio.ai.locales.${lang.labelKey}`, lang.fallback)}
                        </ButtonBase>
                      );
                    })}
                  </Box>
                  <Box sx={{ mt: 0.75, fontSize: 'var(--text-2xs)', color: 'var(--muted)' }}>{k('languagesHint', 'La première langue sélectionnée est rédigée par l’IA ; les autres sont produites par auto-traduction (à relire).')}</Box>
                </Field>
              </Box>
            </>
          )}

          {error && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, p: 1.25, borderRadius: 'var(--radius-md)', bgcolor: 'var(--err-soft)', color: 'var(--err)', fontSize: 'var(--text-sm)' }}>
              <AlertTriangle size={16} strokeWidth={2} style={{ flexShrink: 0 }} /> {error}
            </Box>
          )}
        </Box>
      </Box>

      {/* Paywall de rachat de crédits (402 AI_CREDITS_INSUFFICIENT / 429 quota) → packs Stripe existants. */}
      <AiCreditsPaywall open={paywallOpen} onClose={() => setPaywallOpen(false)} balanceMillicredits={paywallBalance} />
    </Box>
  );
}

function DirectionRow({ selected, onClick, title, subtitle }: { selected: boolean; onClick: () => void; title: string; subtitle?: string }) {
  return (
    <ButtonBase onClick={onClick} sx={{
      justifyContent: 'space-between', textAlign: 'left', width: '100%', px: 1.5, py: 1.1,
      borderRadius: 'var(--radius-md)', border: '1.5px solid', borderColor: selected ? 'var(--accent)' : 'var(--line)',
      bgcolor: selected ? 'var(--accent-soft)' : 'var(--surface)', cursor: 'pointer',
      transition: 'border-color var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out)',
      '&:hover': { borderColor: 'var(--accent)' },
    }}>
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)' }}>{title}</Box>
        {subtitle && <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--muted)' }}>{subtitle}</Box>}
      </Box>
      {selected && <Check size={16} strokeWidth={2.4} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
    </ButtonBase>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <Box sx={{ flex: 1, minWidth: 200 }}>
      <Box component="label" sx={{ display: 'block', mb: 0.5, fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--body)' }}>
        {label}{required && <Box component="span" sx={{ color: 'var(--accent)', ml: 0.25 }}>*</Box>}
      </Box>
      {children}
    </Box>
  );
}

const inputSx = {
  width: '100%', px: 1.5, py: 1, fontSize: 'var(--text-md)', color: 'var(--ink)',
  bgcolor: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '8px',
  boxShadow: '0 1px 0 rgba(28,27,26,0.04)',
  '&.Mui-focused': { borderColor: 'color-mix(in srgb, var(--accent) 48%, var(--line))', boxShadow: '0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent)' },
} as const;
// Bouton primaire terracotta (MUI « contained » ignore nos variables CSS → forcé via sx).
const accentBtnSx = {
  textTransform: 'none', bgcolor: 'var(--accent)', color: 'var(--on-accent)', borderRadius: '8px',
  boxShadow: '0 1px 0 rgba(28,27,26,0.04)',
  '&:hover': { bgcolor: 'var(--accent-deep)', boxShadow: 'none' },
  '&.Mui-disabled': { bgcolor: 'var(--accent)', opacity: 0.55, color: 'var(--on-accent)' },
} as const;
const primaryBtnSx = {
  display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 38, px: 2, flexShrink: 0,
  borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent)', color: 'var(--on-accent)',
  fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-sm)', cursor: 'pointer',
  transition: 'background var(--duration-fast) var(--ease-out)',
  '&:hover': { bgcolor: 'var(--accent-deep)' }, '&.Mui-disabled': { opacity: 0.5, cursor: 'not-allowed' },
} as const;
const ghostBtnSx = {
  display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 38, px: 1.75, flexShrink: 0,
  borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', color: 'var(--body)',
  fontWeight: 'var(--fw-medium)', fontSize: 'var(--text-sm)', cursor: 'pointer',
  transition: 'border-color var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)',
  '&:hover': { borderColor: 'var(--accent)', color: 'var(--ink)' }, '&.Mui-disabled': { opacity: 0.5 },
} as const;
