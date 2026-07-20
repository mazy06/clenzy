import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Skeleton, ToggleButtonGroup, ToggleButton, Chip, CircularProgress } from '@mui/material';
import { Plus, Globe, FileText, Sparkles, SlidersHorizontal, AlertTriangle, Trash2 } from 'lucide-react';
import PageHeader from '../../../components/PageHeader';
import {
  designSystemsApi, type DesignSystem, type DesignSystemSource, type DesignSystemCreateRequest,
} from '../../../services/api/designSystemsApi';

/**
 * Menu « Systèmes de design » (direction de design réutilisable — modèle open-design). Colonne gauche :
 * liste des systèmes visibles (global + org). Panneau : soit l'assistant de création (4 sources : site web,
 * DESIGN.md collé, description de marque, manuel), soit l'aperçu d'un système sélectionné (sa prose DESIGN.md
 * + les swatches de tokens `--bt-*`). Les sources BRAND / PASTE / URL passent par l'IA (feature DESIGN).
 */

const SOURCES: { id: DesignSystemSource; label: string; icon: typeof Globe; hint: string }[] = [
  { id: 'URL', label: 'Site web', icon: Globe, hint: "Colle l'URL d'un site : l'IA en capture la direction (couleurs, typo, ambiance)." },
  { id: 'BRAND', label: 'Décrire la marque', icon: Sparkles, hint: "Décris la marque : l'IA génère le DESIGN.md + les tokens." },
  { id: 'PASTE', label: 'Coller un DESIGN.md', icon: FileText, hint: "Colle une prose de direction : l'IA en dérive les tokens." },
  { id: 'MANUAL', label: 'Manuel', icon: SlidersHorizontal, hint: 'Fournis directement la prose et/ou les tokens (JSON).' },
];

/** Extrait les tokens couleur d'une map JSON pour l'aperçu (swatches). */
function colorSwatches(tokensJson: string | null): { name: string; value: string }[] {
  if (!tokensJson) return [];
  try {
    const map = JSON.parse(tokensJson) as Record<string, string>;
    return Object.entries(map).flatMap(([name, value]) =>
      name.includes('color') && /^(#|rgb|hsl|oklch)/i.test(value) ? [{ name, value }] : [],
    );
  } catch {
    return [];
  }
}

export default function DesignSystemsPage() {
  const [systems, setSystems] = useState<DesignSystem[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formulaire de création
  const [source, setSource] = useState<DesignSystemSource>('URL');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [brandDescription, setBrandDescription] = useState('');
  const [designMarkdown, setDesignMarkdown] = useState('');
  const [tokensJson, setTokensJson] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = () => {
    designSystemsApi.list()
      .then((data) => setSystems(data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Chargement impossible'));
  };
  useEffect(reload, []);

  const selected = useMemo(() => systems?.find((s) => s.id === selectedId) ?? null, [systems, selectedId]);
  const swatches = useMemo(() => colorSwatches(selected?.tokensJson ?? null), [selected]);

  const navigate = useNavigate();
  // La création se fait désormais sur la page riche dédiée (formulaire multi-sources + aperçu).
  const startCreate = () => navigate('/booking-engine/design-systems/new');
  const resetForm = () => {
    setName(''); setCategory(''); setWebsiteUrl(''); setBrandDescription(''); setDesignMarkdown(''); setTokensJson('');
  };

  const handleCreate = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    const body: DesignSystemCreateRequest = {
      name: name.trim(), category: category.trim() || undefined, sourceType: source,
      websiteUrl: source === 'URL' ? websiteUrl.trim() : undefined,
      brandDescription: source === 'BRAND' ? brandDescription.trim() : undefined,
      designMarkdown: (source === 'PASTE' || source === 'MANUAL') ? designMarkdown : undefined,
      tokensJson: source === 'MANUAL' ? (tokensJson.trim() || undefined) : undefined,
    };
    try {
      const created = await designSystemsApi.create(body);
      setSystems((prev) => (prev ? [created, ...prev] : [created]));
      setCreating(false);
      setSelectedId(created.id);
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La création a échoué.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await designSystemsApi.delete(id);
      setSystems((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
      if (selectedId === id) setSelectedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suppression impossible');
    }
  };

  const aiSource = source !== 'MANUAL';
  const canCreate = name.trim() && (
    (source === 'URL' && websiteUrl.trim()) ||
    (source === 'BRAND' && brandDescription.trim()) ||
    (source === 'PASTE' && designMarkdown.trim()) ||
    (source === 'MANUAL' && (designMarkdown.trim() || tokensJson.trim()))
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'var(--bg)', px: { xs: 2, md: 4 }, py: { xs: 2, md: 3 } }}>
      <PageHeader
        title="Systèmes de design"
        subtitle="Une direction réutilisable (tokens + DESIGN.md) que vos templates reprennent"
        iconBadge={<Sparkles />}
      />

      {error && (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, my: 2, p: 1.5, borderRadius: 'var(--radius-md)', bgcolor: 'var(--err-soft)', color: 'var(--err)', fontSize: 13, whiteSpace: 'pre-wrap' }}>
          <AlertTriangle size={16} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} /> {error}
        </Box>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '280px 1fr' }, gap: 2.5, mt: 2 }}>
        {/* Colonne liste */}
        <Box>
          <Button fullWidth variant="contained" disableElevation startIcon={<Plus size={16} strokeWidth={2} />} onClick={startCreate} sx={{ textTransform: 'none', mb: 1.5 }}>
            Créer un système
          </Button>
          <Box sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', px: 0.5, mb: 1 }}>
            Vos systèmes {systems && <span style={{ fontVariantNumeric: 'tabular-nums' }}>· {systems.length}</span>}
          </Box>
          {systems === null && <Skeleton variant="rounded" height={120} sx={{ borderRadius: '12px', bgcolor: 'var(--hover)' }} />}
          {systems && systems.length === 0 && (
            <Box sx={{ color: 'var(--muted)', fontSize: 13, px: 0.5, py: 2, lineHeight: 1.6 }}>
              Aucun système pour l'instant. Créez-en un à partir d'un site, d'une marque ou d'un DESIGN.md.
            </Box>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {systems?.map((s) => (
              <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box
                  component="button" type="button" onClick={() => { setSelectedId(s.id); setCreating(false); }}
                  sx={{
                    flex: 1, textAlign: 'left', border: '1px solid', borderColor: s.id === selectedId ? 'var(--accent)' : 'var(--line)',
                    bgcolor: s.id === selectedId ? 'var(--hover)' : 'transparent', borderRadius: 'var(--radius-md)', px: 1.25, py: 1, cursor: 'pointer',
                    transition: 'background 150ms ease',
                  }}
                >
                  <Box sx={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{s.name}</Box>
                  <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', mt: 0.25 }}>
                    {s.category && <Box sx={{ fontSize: 11, color: 'var(--muted)' }}>{s.category}</Box>}
                    <Chip size="small" label={s.scope === 'GLOBAL' ? 'Baitly' : 'Privé'} sx={{ height: 16, fontSize: 9.5 }} />
                  </Box>
                </Box>
                <Box component="button" type="button" aria-label="Supprimer" onClick={() => handleDelete(s.id)} sx={{ border: 0, bgcolor: 'transparent', color: 'var(--muted)', cursor: 'pointer', p: 0.5, display: 'grid', placeItems: 'center' }}>
                  <Trash2 size={14} strokeWidth={2} />
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Panneau : création OU aperçu */}
        <Box sx={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-lg, 14px)', p: 3, minHeight: 420, bgcolor: 'var(--surface, #fff)' }}>
          {creating ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 720 }}>
              <Box sx={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>Nouveau système de design</Box>

              <ToggleButtonGroup value={source} exclusive onChange={(_, v) => v && setSource(v)} size="small" sx={{ flexWrap: 'wrap' }}>
                {SOURCES.map((s) => {
                  const Icon = s.icon;
                  return (
                    <ToggleButton key={s.id} value={s.id} sx={{ textTransform: 'none', gap: 0.75, px: 1.5 }}>
                      <Icon size={15} strokeWidth={2} /> {s.label}
                    </ToggleButton>
                  );
                })}
              </ToggleButtonGroup>
              <Box sx={{ fontSize: 13, color: 'var(--muted)', mt: -1 }}>{SOURCES.find((s) => s.id === source)?.hint}</Box>

              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <TextField size="small" label="Nom" value={name} onChange={(e) => setName(e.target.value)} sx={{ flex: 1, minWidth: 220 }} />
                <TextField size="small" label="Catégorie (optionnel)" value={category} onChange={(e) => setCategory(e.target.value)} sx={{ flex: 1, minWidth: 220 }} />
              </Box>

              {source === 'URL' && (
                <TextField size="small" label="URL du site" placeholder="https://…" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
              )}
              {source === 'BRAND' && (
                <TextField multiline minRows={4} label="Description de la marque" placeholder="Ex. Riad de luxe à Marrakech, ambiance feutrée, terracotta et zelliges…" value={brandDescription} onChange={(e) => setBrandDescription(e.target.value)} />
              )}
              {(source === 'PASTE' || source === 'MANUAL') && (
                <TextField multiline minRows={8} label="DESIGN.md" placeholder="# Design System…" value={designMarkdown} onChange={(e) => setDesignMarkdown(e.target.value)} sx={{ '& textarea': { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5 } }} />
              )}
              {source === 'MANUAL' && (
                <TextField multiline minRows={4} label="Tokens --bt-* (JSON, optionnel)" placeholder='{"--bt-color-primary":"#…"}' value={tokensJson} onChange={(e) => setTokensJson(e.target.value)} sx={{ '& textarea': { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5 } }} />
              )}

              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Button variant="contained" disableElevation onClick={handleCreate} disabled={!canCreate || busy}
                  startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <Sparkles size={16} strokeWidth={2} />} sx={{ textTransform: 'none' }}>
                  {busy ? (aiSource ? 'Génération…' : 'Création…') : aiSource ? 'Générer le système' : 'Créer'}
                </Button>
                <Button variant="text" onClick={() => setCreating(false)} disabled={busy} sx={{ textTransform: 'none', color: 'var(--muted)' }}>Annuler</Button>
              </Box>
            </Box>
          ) : selected ? (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
                <Box sx={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{selected.name}</Box>
                {selected.category && <Chip size="small" label={selected.category} />}
                {selected.sourceType && <Chip size="small" variant="outlined" label={selected.sourceType} />}
              </Box>
              {swatches.length > 0 && (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2.5 }}>
                  {swatches.map((sw) => (
                    <Box key={sw.name} title={`${sw.name}: ${sw.value}`} sx={{ width: 48, height: 48, borderRadius: '10px', bgcolor: sw.value, border: '1px solid var(--line)' }} />
                  ))}
                </Box>
              )}
              {selected.designMarkdown ? (
                <Box sx={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.65, color: 'var(--ink)', maxHeight: '55vh', overflowY: 'auto', bgcolor: 'var(--bg)', borderRadius: 'var(--radius-md)', p: 2, border: '1px solid var(--line)' }}>
                  {selected.designMarkdown}
                </Box>
              ) : (
                <Box sx={{ color: 'var(--muted)', fontSize: 13 }}>Pas de DESIGN.md — ce système ne porte que des tokens.</Box>
              )}
            </Box>
          ) : (
            <Box sx={{ height: '100%', minHeight: 360, display: 'grid', placeItems: 'center', textAlign: 'center', color: 'var(--muted)' }}>
              <Box>
                <Sparkles size={28} strokeWidth={1.5} style={{ opacity: 0.5 }} />
                <Box sx={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', mt: 1 }}>Créer un système de design</Box>
                <Box sx={{ fontSize: 13, mt: 0.5, maxWidth: 420 }}>À partir d'un site, d'une marque ou d'un DESIGN.md — une direction réutilisable pour vos templates.</Box>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
