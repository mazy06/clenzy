import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Button, InputBase, Switch, Select, MenuItem, FormControl, CircularProgress, Collapse, Chip, Divider,
} from '@mui/material';
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
  const brandRef = useRef<HTMLInputElement | null>(null);

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
    <Box className="od-canvas" sx={{ minHeight: '100vh', bgcolor: 'var(--bg)' }}>
      {/* Barre supérieure — sticky frostée, grille 1fr auto 1fr avec marque centrée (modèle .ds-setup-topbar). */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 20, height: 64, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 2, px: { xs: 2, md: '28px' }, borderBottom: '1px solid var(--line)', bgcolor: 'color-mix(in srgb, var(--bg) 88%, transparent)', backdropFilter: 'saturate(1.4) blur(10px)' }}>
        <Box sx={{ justifySelf: 'start' }}>
          <Button onClick={() => navigate(-1)} startIcon={<ArrowLeft size={16} strokeWidth={2} />} sx={{ textTransform: 'none', color: 'var(--muted)' }}>Retour</Button>
        </Box>
        <Box sx={{ justifySelf: 'center', display: 'grid', placeItems: 'center', width: 32, height: 32, color: 'var(--accent)' }}><LayoutGrid size={20} strokeWidth={2} /></Box>
        <Box sx={{ justifySelf: 'end' }}>
          <Button disableElevation onClick={handleCreate} disabled={!canCreate}
            startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <Sparkles size={16} strokeWidth={2} />}
            endIcon={!busy ? <ArrowRight size={16} strokeWidth={2} /> : undefined} sx={accentBtnSx}>
            {primaryLabel}
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(320px, 420px) minmax(0, 1fr)' }, gap: { xs: 3, md: '48px' }, alignItems: 'start', px: { xs: 2, md: 4 }, py: { xs: 3, md: 5 }, maxWidth: 1320, mx: 'auto' }}>
        {/* ─── Colonne gauche : cadrage + aperçu — épinglée au scroll (position: sticky, comme open-design) ─── */}
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
              Système de design
            </Box>
          </Box>
          <Box sx={{ fontFamily: 'var(--font-display)', fontSize: { xs: 30, md: 42 }, fontWeight: 700, lineHeight: 1.08, color: 'var(--ink)', letterSpacing: '-0.02em', textWrap: 'balance' }}>
            Concevez un système, en minutes
          </Box>
          <Box sx={{ fontSize: 'var(--text-md)', color: 'var(--muted)', lineHeight: 1.6, mt: 2, maxWidth: 460 }}>
            Un site, une marque ou un DESIGN.md — plus tout le contexte que vous avez — deviennent un système de design complet et on-brand, réutilisable partout.
          </Box>
          <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--muted)', mt: 2, fontWeight: 600, letterSpacing: '0.02em' }}>
            3 étapes · ~3 min · DESIGN.md · tokens · aperçu
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 3 }}>
            {[
              { n: 1, t: 'Site web ou DESIGN.md', d: 'Collez un lien, décrivez une marque, ou copiez des tokens' },
              { n: 2, t: 'Ajoutez du contexte', d: 'Réglages manuels, fichiers, dépôt — optionnel' },
              { n: 3, t: 'Générez', d: 'Extraction rapide d’abord ; l’IA affine ensuite' },
            ].map((s) => (
              <Box key={s.n} sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
                <Box sx={{ display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: '50%', bgcolor: 'color-mix(in srgb, var(--accent) 12%, var(--surface))', border: '1px solid', borderColor: 'color-mix(in srgb, var(--accent) 22%, var(--line))', color: 'var(--accent)', fontSize: 12.5, fontWeight: 700, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{s.n}</Box>
                <Box>
                  <Box sx={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--ink)' }}>{s.t}</Box>
                  <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--muted)' }}>{s.d}</Box>
                </Box>
              </Box>
            ))}
          </Box>

          {/* Aperçu live du système — halo diffus derrière la carte (modèle open-design .showcaseGlow, via ::before). */}
          <Box sx={{
            mt: 4, position: 'relative', border: '1px solid var(--line)', borderRadius: '16px', p: 2.5, bgcolor: 'var(--surface, #fff)', boxShadow: 'var(--shadow-card)',
            '&::before': {
              content: '""', position: 'absolute', inset: '-14% -8% -22%', zIndex: -1, borderRadius: '30px',
              background: 'radial-gradient(60% 60% at 30% 20%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 70%), radial-gradient(50% 50% at 85% 90%, color-mix(in srgb, #14b8a6 18%, transparent), transparent 70%)',
              filter: 'blur(22px)', opacity: 0.55, pointerEvents: 'none',
            },
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 2 }}>
              <Box sx={{ display: 'flex', gap: 0.5 }}>{['#ff5f57', '#febc2e', '#28c840'].map((c) => <Box key={c} sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: c }} />)}</Box>
              <Box sx={{ fontSize: 'var(--text-2xs)', fontWeight: 600, color: 'var(--muted)', ml: 0.5 }}>Votre système de design</Box>
            </Box>
            <Label>Palette</Label>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              {[preview.primary, preview.accent, '#2b2420', '#e8ddcb', '#faf6ef'].map((c, i) => (
                <Box key={i} sx={{ flex: 1, height: 40, borderRadius: '8px', bgcolor: c, border: '1px solid var(--line)' }} />
              ))}
            </Box>
            <Label>Échelle typographique</Label>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 2, fontFamily: preview.heading, color: 'var(--ink)' }}>
              <Box sx={{ fontSize: 40, fontWeight: 700, lineHeight: 1 }}>Aa</Box>
              <Box sx={{ fontSize: 26, fontWeight: 600, lineHeight: 1 }}>Aa</Box>
              <Box sx={{ fontSize: 17, color: 'var(--muted)', lineHeight: 1 }}>Aa</Box>
            </Box>
            <Label>Composants</Label>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ px: 1.75, py: 0.75, borderRadius: '8px', bgcolor: preview.primary, color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: preview.body }}>Primaire</Box>
              <Box sx={{ px: 1.75, py: 0.75, borderRadius: '8px', border: '1px solid var(--line)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, fontFamily: preview.body }}>Ghost</Box>
              <Box sx={{ flex: 1, height: 8, borderRadius: 999, bgcolor: 'var(--hover)' }} />
            </Box>
          </Box>
        </Box>

        {/* ─── Colonne droite : tableau de sources (libellé → champ) ─── */}
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {/* Flux « page vierge » : réutiliser une direction existante ou partir sans direction, sans rien créer. */}
          {isBlankFlow && (
            <Box sx={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', p: 2, mb: 3, display: 'flex', flexDirection: 'column', gap: 1.5, bgcolor: 'var(--surface, #fff)' }}>
              <Box sx={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--ink)' }}>Réutiliser une direction existante</Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 240, flex: 1 }}>
                  <Select<number | ''> displayEmpty value={reuseId ?? ''} disabled={busy}
                    onChange={(e) => setReuseId(e.target.value === '' ? null : Number(e.target.value))}
                    renderValue={(v) => (v === '' || v == null)
                      ? <Box sx={{ color: 'var(--muted)', fontSize: 13 }}>Choisir un système de design…</Box>
                      : <Box sx={{ fontSize: 13 }}>{systems.find((s) => s.id === v)?.name ?? 'Système'}</Box>}>
                    {systems.length === 0 && <MenuItem disabled value="">Aucun système pour l'instant</MenuItem>}
                    {systems.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <Button disableElevation disabled={reuseId == null || busy} onClick={() => continueWithDirection(reuseId)}
                  endIcon={<ArrowRight size={16} strokeWidth={2} />} sx={accentBtnSx}>Continuer</Button>
                <Button disabled={busy} onClick={() => continueWithDirection(null)} sx={{ textTransform: 'none', color: 'var(--muted)' }}>Sans direction</Button>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mt: 0.25 }}>
                <Divider sx={{ flex: 1, borderColor: 'var(--line)' }} />
                <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>ou créez-en une</Box>
                <Divider sx={{ flex: 1, borderColor: 'var(--line)' }} />
              </Box>
            </Box>
          )}

          <Box sx={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--ink)' }}>Extraire depuis un site, un dépôt ou vos éléments sources</Box>
          <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', mt: 0.5, lineHeight: 1.55 }}>
            Commencez avec un site, un DESIGN.md ou des éléments qui montrent votre style. Baitly crée d'abord un système utilisable, puis l'IA l'affine.
          </Box>

          {/* Tableau de sources dans une carte — lignes « libellé (gauche) → description + champ (droite) »
              séparées par des filets doux (modèle open-design .ds-resource-card / .ds-resource-row). */}
          <Box sx={{ mt: 1.5, border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', bgcolor: 'var(--surface)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', '& > .od-row + .od-row': { borderTop: '1px solid var(--line-soft)' } }}>
            <Row label="Nom du système" required>
              <InputBase value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Riad Marrakech" sx={inputSx} />
            </Row>

            <Row label="Site web" description="Collez l'URL d'un site dont vous aimez le style — l'IA en extrait couleurs, typo et ambiance.">
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <InputBase value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://votre-site.com" sx={{ ...inputSx, flex: 1, minWidth: 220 }} />
                <Button variant="outlined" onClick={() => brandRef.current?.focus()}
                  startIcon={<Sparkles size={15} strokeWidth={2} />}
                  sx={{ textTransform: 'none', borderColor: 'var(--line)', color: 'var(--body)', whiteSpace: 'nowrap', '&:hover': { borderColor: 'var(--accent)' } }}>
                  Partir d'une marque
                </Button>
              </Box>
            </Row>

            <Row label="Décrire la marque" optional description="Voix de marque, intro et contexte produit. Utilisé pour la génération et l'affinage IA.">
              <InputBase inputRef={brandRef} value={brandDescription} onChange={(e) => setBrandDescription(e.target.value)} multiline minRows={3}
                placeholder="Ex. conciergerie de riads à Marrakech, feutré, terracotta et zelliges, voix chaleureuse et raffinée…" sx={inputSx} />
            </Row>

            <Row label="Coller un DESIGN.md" optional
              description={<>Collez un DESIGN.md pour créer directement depuis tokens, rationale et guidage de composants. <Box component="a" href="/DESIGN-BAITLY.md" target="_blank" rel="noreferrer" sx={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Référence ↗</Box></>}>
              {systems.length > 0 && (
                <FormControl size="small" sx={{ mb: 1.25, minWidth: 260 }}>
                  <Select displayEmpty value="" onChange={(e) => e.target.value && handleCopyFrom(Number(e.target.value))}
                    renderValue={() => <Box sx={{ color: 'var(--muted)', fontSize: 13 }}>Copier depuis un système existant</Box>}>
                    {systems.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              <InputBase value={designMarkdown} onChange={(e) => setDesignMarkdown(e.target.value)} multiline minRows={5}
                placeholder={'# Riad Lune d\'Argile\n> Catégorie : conciergerie\n\n## Palette & rôles\nTerracotta (#c96442) en accent…\n\n## Typographie\nSerif éditorial…\n\n## Voix & ton\nChaleureuse, raffinée…'}
                sx={{ ...inputSx, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 'var(--text-sm)' }} />
            </Row>

            <Row label="Réglages manuels" optional description="Couleur et polices — priment sur les tokens dérivés par l'IA.">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Switch checked={manualOn} onChange={(e) => setManualOn(e.target.checked)} size="small" />
                <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--body)' }}>{manualOn ? 'Activés' : 'Définir manuellement couleur & typo'}</Box>
              </Box>
              <Collapse in={manualOn}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1.75 }}>
                  <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                    <ColorField label="Couleur principale" value={primaryColor} onChange={setPrimaryColor} />
                    <ColorField label="Couleur d'accent" value={accentColor} onChange={setAccentColor} />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                    <TextField label="Police des titres" value={headingFont} onChange={setHeadingFont} placeholder="Ex. Cormorant Garamond, serif" />
                    <TextField label="Police du corps" value={bodyFont} onChange={setBodyFont} placeholder="Ex. Inter, system-ui" />
                  </Box>
                </Box>
              </Collapse>
            </Row>

            {/* Sources à venir : présentes pour parité open-design, désactivées en attendant le backend. */}
            <Row label="Ajouter des fichiers" optional soon description="Images, logos, polices, PDF, HTML — jusqu'à 12 Mo chacun.">
              <Box sx={{ border: '1px dashed var(--line)', borderRadius: 'var(--radius-md)', py: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, color: 'var(--muted)', bgcolor: 'var(--field)' }}>
                <Upload size={20} strokeWidth={2} />
                <Box sx={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Glisser-déposer, coller ou parcourir</Box>
                <Box sx={{ fontSize: 'var(--text-2xs)' }}>Extraction en tokens & assets — bientôt</Box>
              </Box>
            </Row>

            <Row label="Dépôt GitHub" optional soon description="Analyse d'un repo pour en extraire le système existant.">
              <InputBase disabled placeholder="https://github.com/org/repo" sx={{ ...inputSx, opacity: 0.7 }} />
            </Row>

            <Row label="Figma / .fig" optional soon description="Décodage en tokens, composants & assets réels.">
              <InputBase disabled placeholder="https://figma.com/file/… ou un fichier .fig" sx={{ ...inputSx, opacity: 0.7 }} />
            </Row>

            <Row label="Code local" optional soon description="Un dossier ou des fichiers de votre machine.">
              <Button disabled variant="outlined" sx={{ textTransform: 'none', borderColor: 'var(--line)', color: 'var(--muted)' }}>Parcourir un dossier</Button>
            </Row>
          </Box>

          {error && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mt: 2, p: 1.25, borderRadius: 'var(--radius-md)', bgcolor: 'var(--err-soft)', color: 'var(--err)', fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap' }}>
              <AlertTriangle size={16} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} /> {error}
            </Box>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
            <Button disableElevation onClick={handleCreate} disabled={!canCreate}
              startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <Sparkles size={16} strokeWidth={2} />} sx={accentBtnSx}>
              {primaryLabel}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <Box sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', mb: 1 }}>{children}</Box>;
}

/** Ligne du tableau de sources : libellé (+ « optionnel » / « bientôt ») à gauche, description + champ à droite. */
function Row({ label, required, optional, soon, description, children }: {
  label: string; required?: boolean; optional?: boolean; soon?: boolean; description?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Box className="od-row" sx={{
      display: 'grid', gridTemplateColumns: { xs: '1fr', md: '220px minmax(0, 1fr)' }, gap: { xs: 1, md: '16px' },
      alignItems: 'start', px: '18px', py: '16px', opacity: soon ? 0.6 : 1,
    }}>
      <Box>
        <Box sx={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>
          {label}{required && <Box component="span" sx={{ color: 'var(--accent)', ml: 0.25 }}>*</Box>}
        </Box>
        {optional && <Box sx={{ fontSize: 11.5, fontWeight: 500, color: 'var(--muted)', mt: 0.25 }}>optionnel</Box>}
        {soon && <Chip label="Bientôt" size="small" sx={{ height: 18, mt: 0.5, fontSize: 10, fontWeight: 600, bgcolor: 'var(--hover)', color: 'var(--muted)' }} />}
      </Box>
      <Box>
        {description && <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', lineHeight: 1.5, mb: 1.25 }}>{description}</Box>}
        {children}
      </Box>
    </Box>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Box sx={{ flex: 1, minWidth: 200 }}>
      <Box component="label" sx={{ display: 'block', mb: 0.5, fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-medium)', color: 'var(--muted)' }}>{label}</Box>
      <InputBase value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} sx={inputSx} />
    </Box>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Box sx={{ flex: 1, minWidth: 200 }}>
      <Box component="label" sx={{ display: 'block', mb: 0.5, fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-medium)', color: 'var(--muted)' }}>{label}</Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box component="input" type="color" value={HEX.test(value) ? value : '#6B8A9A'} onChange={(e) => onChange((e.target as HTMLInputElement).value)}
          aria-label={label} sx={{ width: 40, height: 40, p: 0, border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', bgcolor: 'var(--field)', cursor: 'pointer', flexShrink: 0 }} />
        <InputBase value={value} onChange={(e) => onChange(e.target.value)} placeholder="#……" sx={{ ...inputSx, flex: 1 }} />
      </Box>
    </Box>
  );
}

// Champ open-design : fond panneau quasi-blanc + bordure + ombre discrète + anneau de focus accent.
const inputSx = {
  width: '100%', px: 1.5, py: 1, fontSize: 'var(--text-md)', color: 'var(--ink)',
  bgcolor: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '8px',
  boxShadow: '0 1px 0 rgba(28,27,26,0.04)',
  '&.Mui-focused': { borderColor: 'color-mix(in srgb, var(--accent) 48%, var(--line))', boxShadow: '0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent)' },
} as const;

// Bouton primaire = terracotta (MUI « contained » ignore nos variables CSS → on force via sx).
const accentBtnSx = {
  textTransform: 'none', bgcolor: 'var(--accent)', color: 'var(--on-accent)', borderRadius: '8px',
  boxShadow: '0 1px 0 rgba(28,27,26,0.04)',
  '&:hover': { bgcolor: 'var(--accent-deep)', boxShadow: 'none' },
  '&.Mui-disabled': { bgcolor: 'var(--accent)', opacity: 0.55, color: 'var(--on-accent)' },
} as const;
