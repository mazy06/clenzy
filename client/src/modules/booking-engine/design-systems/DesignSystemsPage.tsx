import { useEffect, useMemo, useState } from 'react';
import { cn } from '../../../utils/cn';
import { Alert, AlertDescription, Badge, Button } from '../../../components/ui';
import { Spinner } from '../../../components/ui';
import { Field, FieldLabel, Input, Textarea } from '../../../components/ui';
import { useNavigate } from 'react-router-dom';
import { Skeleton, ToggleGroup, ToggleGroupItem } from '../../../components/ui';
import { Plus, Globe, FileText, Sparkles, SlidersHorizontal, AlertTriangle, Trash2 } from 'lucide-react';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
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
    <div className="min-h-[100vh] bg-background px-3 min-[900px]:px-6 py-3 min-[900px]:py-[18px]">
      <PageHeader
        title="Systèmes de design"
        subtitle="Une direction réutilisable (tokens + DESIGN.md) que vos templates reprennent"
        iconBadge={<Sparkles />}
      />

      {error && (
        <Alert variant="destructive" className="my-3">
          <AlertTriangle />
          <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-[1fr] min-[900px]:grid-cols-[280px_1fr] gap-[15px] mt-3">
        {/* Colonne liste */}
        <div>
          {/* mb-[9px] : `mb: 1.5` MUI vaut 9 px ici (spacing = 6 px). */}
          <Button className="w-full mb-[9px] shrink" onClick={startCreate}>
            <Plus size={16} strokeWidth={2} />
            Créer un système
          </Button>
          <div className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground px-0.5 mb-1.5">
            Vos systèmes {systems && <span className="tabular-nums">· {systems.length}</span>}
          </div>
          {systems === null && <Skeleton className="h-[120px] rounded-xl" />}
          {systems && systems.length === 0 && (
            <div className="text-muted-foreground text-xs px-0.5 py-3 leading-[1.6]">
              Aucun système pour l'instant. Créez-en un à partir d'un site, d'une marque ou d'un DESIGN.md.
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            {systems?.map((s) => (
              <div className="flex items-center gap-0.5" key={s.id}>
                {/* L'etat actif se dit par le fond, pas par un lisere : cf. contrat Baitly UI. */}
                <button
                  className={cn(
                    'flex-1 text-start border rounded-lg px-[7.5px] py-1.5 cursor-pointer transition-colors duration-150 ease-out-quart motion-reduce:transition-none',
                    s.id === selectedId
                      ? 'border-primary/40 bg-primary-soft'
                      : 'border-border bg-transparent hover:bg-muted',
                  )}
                  type="button"
                  aria-pressed={s.id === selectedId}
                  onClick={() => { setSelectedId(s.id); setCreating(false); }}
                >
                  <div className="text-sm font-semibold text-foreground">{s.name}</div>
                  <div className="flex gap-1 items-center mt-0.5">
                    {s.category && <div className="text-2xs text-muted-foreground">{s.category}</div>}
                    <Badge variant="secondary" className="h-[16px] text-2xs">{s.scope === 'GLOBAL' ? 'Baitly' : 'Privé'}</Badge>
                  </div>
                </button>
                <Button variant="ghost" size="icon-xs" type="button" aria-label="Supprimer" onClick={() => handleDelete(s.id)} className="text-muted-foreground">
                  <Trash2 size={14} strokeWidth={2} />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Panneau : création OU aperçu */}
        <div className="border border-border rounded-xl p-[18px] min-h-[420px] bg-card shadow-sm">
          {creating ? (
            <div className="flex flex-col gap-3 max-w-[720px]">
              <div className="text-base font-semibold tracking-tight text-foreground text-balance">Nouveau système de design</div>

              <ToggleGroup
                type="single"
                size="sm"
                variant="outline"
                className="flex-wrap"
                value={source}
                onValueChange={(v) => v && setSource(v as DesignSystemSource)}
              >
                {SOURCES.map((s) => {
                  const Icon = s.icon;
                  return (
                    <ToggleGroupItem key={s.id} value={s.id} className="gap-1 px-2.5 normal-case">
                      <Icon size={15} strokeWidth={2} /> {s.label}
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
              {/* mt: -1 = -6px (theme.spacing vaut 6 dans ce projet). */}
              <div className="text-xs text-muted-foreground -mt-1.5">{SOURCES.find((s) => s.id === source)?.hint}</div>

              <div className="flex gap-2 flex-wrap">
                <Field className="flex-1 min-w-[220px]">
                  <FieldLabel htmlFor="ds-name">Nom</FieldLabel>
                  <Input id="ds-name" value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field className="flex-1 min-w-[220px]">
                  <FieldLabel htmlFor="ds-category">Catégorie (optionnel)</FieldLabel>
                  <Input id="ds-category" value={category} onChange={(e) => setCategory(e.target.value)} />
                </Field>
              </div>

              {source === 'URL' && (
                <Field>
                  <FieldLabel htmlFor="ds-website-url">URL du site</FieldLabel>
                  <Input id="ds-website-url" placeholder="https://…" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
                </Field>
              )}
              {source === 'BRAND' && (
                <Field>
                  <FieldLabel htmlFor="ds-brand-description">Description de la marque</FieldLabel>
                  <Textarea id="ds-brand-description" rows={4} placeholder="Ex. Riad de luxe à Marrakech, ambiance feutrée, terracotta et zelliges…" value={brandDescription} onChange={(e) => setBrandDescription(e.target.value)} />
                </Field>
              )}
              {(source === 'PASTE' || source === 'MANUAL') && (
                <Field>
                  <FieldLabel htmlFor="ds-design-markdown">DESIGN.md</FieldLabel>
                  {/* Pile monospace explicite : la prose DESIGN.md se relit en colonnes alignees. */}
                  <Textarea id="ds-design-markdown" rows={8} className="text-[12.5px]" style={{ fontFamily: 'ui-monospace, Menlo, monospace' }} placeholder="# Design System…" value={designMarkdown} onChange={(e) => setDesignMarkdown(e.target.value)} />
                </Field>
              )}
              {source === 'MANUAL' && (
                <Field>
                  <FieldLabel htmlFor="ds-tokens-json">Tokens --bt-* (JSON, optionnel)</FieldLabel>
                  <Textarea id="ds-tokens-json" rows={4} className="text-[12.5px]" style={{ fontFamily: 'ui-monospace, Menlo, monospace' }} placeholder='{"--bt-color-primary":"#…"}' value={tokensJson} onChange={(e) => setTokensJson(e.target.value)} />
                </Field>
              )}

              <div className="flex gap-1.5 mt-1.5">
                <Button onClick={handleCreate} disabled={!canCreate || busy}>
                  {busy ? <Spinner className="size-[15px]" /> : <Sparkles size={16} strokeWidth={2} />}
                  {busy ? (aiSource ? 'Génération…' : 'Création…') : aiSource ? 'Générer le système' : 'Créer'}
                </Button>
                <Button variant="ghost" onClick={() => setCreating(false)} disabled={busy}>Annuler</Button>
              </div>
            </div>
          ) : selected ? (
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <div className="text-lg font-semibold tracking-tight text-foreground text-balance">{selected.name}</div>
                {selected.category && <Badge variant="secondary">{selected.category}</Badge>}
                {selected.sourceType && <Badge variant="outline">{selected.sourceType}</Badge>}
              </div>
              {swatches.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-3.5">
                  {swatches.map((sw) => (
                    <div className="w-[48px] h-[48px] rounded-lg border border-border" style={{ backgroundColor: sw.value }} key={sw.name} title={`${sw.name}: ${sw.value}`} />
                  ))}
                </div>
              )}
              {selected.designMarkdown ? (
                <div className="whitespace-pre-wrap text-sm leading-[1.65] text-foreground max-h-[55vh] overflow-y-auto bg-muted rounded-lg p-3 border border-border">
                  {selected.designMarkdown}
                </div>
              ) : (
                <div className="text-muted-foreground text-xs">Pas de DESIGN.md — ce système ne porte que des tokens.</div>
              )}
            </div>
          ) : (
            <EmptyState
              variant="transparent"
              minHeight={360}
              icon={<Sparkles />}
              title="Créer un système de design"
              description="À partir d'un site, d'une marque ou d'un DESIGN.md — une direction réutilisable pour vos templates."
            />
          )}
        </div>
      </div>
    </div>
  );
}
