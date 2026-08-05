import { useEffect, useState } from 'react';
import { Alert, AlertDescription, Button, Skeleton } from '../../../../components/ui';
import EmptyState from '../../../../components/EmptyState';
import { Wand2, Search, Copy, Check, AlertTriangle, Sparkles } from 'lucide-react';
import { propertiesApi, type Property } from '../../../../services/api/propertiesApi';
import { propertyContentAiApi, type GeneratedContent } from '../../../../services/api/propertyContentAiApi';
import { SettingsPage, SettingCard, SettingRow, SelectControl } from './settingsControls';

/**
 * Section « Contenu » du Studio (F4) — génération IA branchée sur le vrai PropertyContentAiService.
 * L'hôte choisit une propriété, une langue et un ton, puis génère une description commerciale
 * ou des meta SEO (fr/en/ar). Le résultat est affiché et copiable.
 */

const LANGUAGES = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
];

const TONES = [
  { value: '', label: 'Ton par défaut' },
  { value: 'chaleureux', label: 'Chaleureux' },
  { value: 'professionnel', label: 'Professionnel' },
  { value: 'luxe', label: 'Haut de gamme' },
  { value: 'familial', label: 'Familial' },
  { value: 'concis', label: 'Concis' },
];

type GenKind = 'description' | 'seo';

export default function ContentAiPanel() {
  const [properties, setProperties] = useState<Property[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState<string>('');
  const [language, setLanguage] = useState('fr');
  const [tone, setTone] = useState('');
  const [generating, setGenerating] = useState<GenKind | null>(null);
  const [result, setResult] = useState<GeneratedContent | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    propertiesApi.getAll()
      .then((list) => {
        if (!alive) return;
        setProperties(list);
        if (list.length > 0) setPropertyId(String(list[0].id));
      })
      .catch((e) => { if (alive) setLoadError(e instanceof Error ? e.message : 'Chargement des propriétés impossible'); });
    return () => { alive = false; };
  }, []);

  const generate = async (kind: GenKind) => {
    if (!propertyId || generating) return;
    setGenerating(kind);
    setGenError(null);
    setResult(null);
    setCopied(false);
    try {
      const id = Number(propertyId);
      const dto = kind === 'description'
        ? await propertyContentAiApi.generateDescription(id, language, tone || undefined)
        : await propertyContentAiApi.generateSeoMeta(id, language);
      setResult(dto);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Génération impossible');
    } finally {
      setGenerating(null);
    }
  };

  const copy = () => {
    if (!result) return;
    const text = [result.title, result.content].filter(Boolean).join('\n\n');
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }).catch(() => { /* clipboard indisponible : on n'affiche pas de confirmation */ });
  };

  if (properties === null && !loadError) {
    return (
      <div className="max-w-[720px] mx-auto px-6 py-6">
        <Skeleton className="h-[220px] w-full rounded-xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertTriangle />
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    );
  }

  if (properties && properties.length === 0) {
    return (
      <div className="px-6 py-12">
        <EmptyState
          icon={<Sparkles />}
          title="Aucune propriété"
          description="Ajoutez une propriété pour générer son contenu avec l'IA."
        />
      </div>
    );
  }

  const propertyOptions = (properties ?? []).map((p) => ({ value: String(p.id), label: p.city ? `${p.name} — ${p.city}` : p.name }));

  return (
    <SettingsPage title="Contenu IA" description="Générez descriptions et meta SEO de vos biens, en français, anglais ou arabe.">
      <SettingCard title="Paramètres">
        <SettingRow label="Propriété" htmlFor="ai-property" control={
          <SelectControl id="ai-property" value={propertyId} onChange={setPropertyId} options={propertyOptions} />
        } />
        <SettingRow label="Langue" htmlFor="ai-lang" control={
          <SelectControl id="ai-lang" value={language} onChange={setLanguage} options={LANGUAGES} />
        } />
        <SettingRow label="Ton (description)" helper="Appliqué à la génération de description." htmlFor="ai-tone" control={
          <SelectControl id="ai-tone" value={tone} onChange={setTone} options={TONES} />
        } />
      </SettingCard>

      <div className="flex gap-2 flex-wrap mb-3.5">
        <GenButton icon={Wand2} label="Générer une description" loading={generating === 'description'} disabled={!propertyId || generating !== null} onClick={() => generate('description')} />
        <GenButton icon={Search} label="Générer le SEO" variant="outline" loading={generating === 'seo'} disabled={!propertyId || generating !== null} onClick={() => generate('seo')} />
      </div>

      {genError && (
        <Alert variant="destructive" className="mb-3.5">
          <AlertTriangle />
          <AlertDescription>{genError}</AlertDescription>
        </Alert>
      )}

      {result && (
        <SettingCard title={result.kind === 'SEO_META' ? 'Meta SEO générée' : 'Description générée'}>
          <div className="py-2">
            {result.title && (
              <div className="mb-2">
                <div className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Titre</div>
                <div className="text-sm font-semibold text-foreground">{result.title}</div>
              </div>
            )}
            <div className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
              {result.kind === 'SEO_META' ? 'Meta description' : 'Contenu'}
            </div>
            <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{result.content}</div>
            <div className="flex justify-end mt-3">
              <Button type="button" variant="outline" size="sm" onClick={copy} className="cursor-pointer">
                {copied ? <Check size={15} strokeWidth={2.4} /> : <Copy size={15} strokeWidth={2} />}
                {copied ? 'Copié' : 'Copier'}
              </Button>
            </div>
          </div>
        </SettingCard>
      )}
    </SettingsPage>
  );
}

function GenButton({ icon: Icon, label, onClick, loading, disabled, variant = 'default' }: {
  icon: typeof Wand2; label: string; onClick: () => void; loading: boolean; disabled: boolean; variant?: 'default' | 'outline';
}) {
  return (
    <Button type="button" variant={variant} onClick={onClick} disabled={disabled} className="cursor-pointer">
      <Icon size={16} strokeWidth={2} />
      {loading ? 'Génération…' : label}
    </Button>
  );
}
