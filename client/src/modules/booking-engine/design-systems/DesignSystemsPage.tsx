import { useEffect, useMemo, useState } from 'react';
import { cn } from '../../../utils/cn';
import { Badge } from '../../../components/ui';
import { Spinner } from '../../../components/ui';
import { useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Skeleton, ToggleButtonGroup, ToggleButton } from '@mui/material';
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
    <div className="min-h-[100vh] bg-[var(--bg)] px-3 min-[900px]:px-6 py-3 min-[900px]:py-[18px]">
      <PageHeader
        title="Systèmes de design"
        subtitle="Une direction réutilisable (tokens + DESIGN.md) que vos templates reprennent"
        iconBadge={<Sparkles />}
      />

      {error && (
        <div className="flex items-start gap-1.5 my-3 p-2 rounded-[var(--radius-md)] bg-[var(--err-soft)] text-[var(--err)] text-[13px] whitespace-pre-wrap">
          <AlertTriangle size={16} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} /> {error}
        </div>
      )}

      <div className="grid grid-cols-[1fr] min-[900px]:grid-cols-[280px_1fr] gap-[15px] mt-3">
        {/* Colonne liste */}
        <div>
          <Button fullWidth variant="contained" disableElevation startIcon={<Plus size={16} strokeWidth={2} />} onClick={startCreate} sx={{ textTransform: 'none', mb: 1.5 }}>
            Créer un système
          </Button>
          <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[var(--muted)] px-0.5 mb-1.5">
            Vos systèmes {systems && <span style={{ fontVariantNumeric: 'tabular-nums' }}>· {systems.length}</span>}
          </div>
          {systems === null && <Skeleton variant="rounded" height={120} sx={{ borderRadius: '12px', bgcolor: 'var(--hover)' }} />}
          {systems && systems.length === 0 && (
            <div className="text-[var(--muted)] text-[13px] px-0.5 py-3 leading-[1.6]">
              Aucun système pour l'instant. Créez-en un à partir d'un site, d'une marque ou d'un DESIGN.md.
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            {systems?.map((s) => (
              <div className="flex items-center gap-0.5" key={s.id}>
                <button className={cn('flex-1 text-start border border-solid rounded-[var(--radius-md)] px-[7.5px] py-1.5 cursor-pointer', s.id === selectedId ? 'border-[var(--accent)]' : 'border-[var(--line)]', s.id === selectedId ? 'bg-[var(--hover)]' : 'bg-[transparent]')} style={{ transition: 'background 150ms ease' }} type="button" onClick={() => { setSelectedId(s.id); setCreating(false); }}>
                  <div className="text-[13.5px] font-semibold text-[var(--ink)]">{s.name}</div>
                  <div className="flex gap-1 items-center mt-0.5">
                    {s.category && <div className="text-[11px] text-[var(--muted)]">{s.category}</div>}
                    <Badge variant="secondary" className="h-[16px] text-[9.5px]">{s.scope === 'GLOBAL' ? 'Baitly' : 'Privé'}</Badge>
                  </div>
                </button>
                <button className="bg-[transparent] text-[var(--muted)] cursor-pointer p-[3px] grid place-items-[center]" style={{ border: 0 }} type="button" aria-label="Supprimer" onClick={() => handleDelete(s.id)}>
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Panneau : création OU aperçu */}
        <div className="border border-solid border-[var(--line)] rounded-[var(--radius-lg,_14px)] p-[18px] min-h-[420px] bg-[var(--surface,_#fff)]">
          {creating ? (
            <div className="flex flex-col gap-3 max-w-[720px]">
              <div className="text-[17px] font-bold text-[var(--ink)]">Nouveau système de design</div>

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

              <div className="flex gap-2 flex-wrap">
                <TextField size="small" label="Nom" value={name} onChange={(e) => setName(e.target.value)} sx={{ flex: 1, minWidth: 220 }} />
                <TextField size="small" label="Catégorie (optionnel)" value={category} onChange={(e) => setCategory(e.target.value)} sx={{ flex: 1, minWidth: 220 }} />
              </div>

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

              <div className="flex gap-1.5 mt-1.5">
                <Button variant="contained" disableElevation onClick={handleCreate} disabled={!canCreate || busy}
                  startIcon={busy ? <Spinner className="size-[15px]" /> : <Sparkles size={16} strokeWidth={2} />} sx={{ textTransform: 'none' }}>
                  {busy ? (aiSource ? 'Génération…' : 'Création…') : aiSource ? 'Générer le système' : 'Créer'}
                </Button>
                <Button variant="text" onClick={() => setCreating(false)} disabled={busy} sx={{ textTransform: 'none', color: 'var(--muted)' }}>Annuler</Button>
              </div>
            </div>
          ) : selected ? (
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <div className="text-[18px] font-bold text-[var(--ink)]">{selected.name}</div>
                {selected.category && <Badge variant="secondary">{selected.category}</Badge>}
                {selected.sourceType && <Badge variant="outline">{selected.sourceType}</Badge>}
              </div>
              {swatches.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-3.5">
                  {swatches.map((sw) => (
                    <div className="w-[48px] h-[48px] rounded-[10px] border border-solid border-[var(--line)]" style={{ backgroundColor: sw.value }} key={sw.name} title={`${sw.name}: ${sw.value}`} />
                  ))}
                </div>
              )}
              {selected.designMarkdown ? (
                <div className="whitespace-pre-wrap text-[13.5px] leading-[1.65] text-[var(--ink)] max-h-[55vh] overflow-y-auto bg-[var(--bg)] rounded-[var(--radius-md)] p-3 border border-[var(--line)]">
                  {selected.designMarkdown}
                </div>
              ) : (
                <div className="text-[var(--muted)] text-[13px]">Pas de DESIGN.md — ce système ne porte que des tokens.</div>
              )}
            </div>
          ) : (
            <div className="h-full min-h-[360px] grid place-items-[center] text-center text-[var(--muted)]">
              <div>
                <Sparkles size={28} strokeWidth={1.5} style={{ opacity: 0.5 }} />
                <div className="text-[15px] font-semibold text-[var(--ink)] mt-1.5">Créer un système de design</div>
                <div className="text-[13px] mt-0.5 max-w-[420px]">À partir d'un site, d'une marque ou d'un DESIGN.md — une direction réutilisable pour vos templates.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
