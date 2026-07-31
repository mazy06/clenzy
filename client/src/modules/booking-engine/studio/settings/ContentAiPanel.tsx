import { useEffect, useState } from 'react';
import { ButtonBase, Skeleton } from '@mui/material';
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
        <Skeleton variant="rounded" height={220} sx={{ borderRadius: 'var(--radius-lg)', bgcolor: 'var(--hover)' }} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center gap-1.5 m-6 p-3 rounded-[var(--radius-md)] bg-[var(--err-soft)] text-[var(--err)] text-[var(--text-sm)]">
        <AlertTriangle size={18} strokeWidth={2} /> {loadError}
      </div>
    );
  }

  if (properties && properties.length === 0) {
    return (
      <div className="text-center py-12 px-6">
        <div className="w-[56px] h-[56px] mx-auto mb-3 flex items-center justify-center rounded-[var(--radius-lg)] bg-[var(--accent-soft)] text-[var(--accent)]">
          <Sparkles size={26} strokeWidth={1.85} />
        </div>
        <div className="text-[var(--text-lg)] font-[var(--fw-semibold)] mb-0.5">Aucune propriété</div>
        <div className="text-[var(--text-md)] text-[var(--muted)]">Ajoutez une propriété pour générer son contenu avec l'IA.</div>
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
        <GenButton icon={Search} label="Générer le SEO" variant="ghost" loading={generating === 'seo'} disabled={!propertyId || generating !== null} onClick={() => generate('seo')} />
      </div>

      {genError && (
        <div className="flex items-center gap-1.5 mb-3.5 p-2 rounded-[var(--radius-md)] bg-[var(--err-soft)] text-[var(--err)] text-[var(--text-sm)]">
          <AlertTriangle size={16} strokeWidth={2} /> {genError}
        </div>
      )}

      {result && (
        <SettingCard title={result.kind === 'SEO_META' ? 'Meta SEO générée' : 'Description générée'}>
          <div className="py-2">
            {result.title && (
              <div className="mb-2">
                <div className="text-[var(--text-2xs)] font-[var(--fw-bold)] tracking-[.06em] uppercase text-[var(--faint)] mb-0.5">Titre</div>
                <div className="text-[var(--text-md)] font-[var(--fw-semibold)] text-[var(--ink)]">{result.title}</div>
              </div>
            )}
            <div className="text-[var(--text-2xs)] font-[var(--fw-bold)] tracking-[.06em] uppercase text-[var(--faint)] mb-0.5">
              {result.kind === 'SEO_META' ? 'Meta description' : 'Contenu'}
            </div>
            <div className="text-[var(--text-md)] text-[var(--body)] leading-[1.6] whitespace-pre-wrap">{result.content}</div>
            <div className="flex justify-end mt-3">
              <ButtonBase onClick={copy} sx={ghostBtnSx}>
                {copied ? <Check size={15} strokeWidth={2.4} /> : <Copy size={15} strokeWidth={2} />}
                {copied ? 'Copié' : 'Copier'}
              </ButtonBase>
            </div>
          </div>
        </SettingCard>
      )}
    </SettingsPage>
  );
}

function GenButton({ icon: Icon, label, onClick, loading, disabled, variant = 'solid' }: {
  icon: typeof Wand2; label: string; onClick: () => void; loading: boolean; disabled: boolean; variant?: 'solid' | 'ghost';
}) {
  return (
    <ButtonBase onClick={onClick} disabled={disabled} sx={variant === 'solid' ? solidBtnSx : ghostBtnSx}>
      <Icon size={16} strokeWidth={2} />
      {loading ? 'Génération…' : label}
    </ButtonBase>
  );
}

const solidBtnSx = {
  display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 40, px: 2.25,
  borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent)', color: 'var(--on-accent)',
  fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-sm)', cursor: 'pointer',
  transition: 'background var(--duration-fast) var(--ease-out)',
  '&:hover': { bgcolor: 'var(--accent-deep)' },
  '&.Mui-disabled': { opacity: 0.45, cursor: 'default' },
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
} as const;

const ghostBtnSx = {
  display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 40, px: 2.25,
  borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', bgcolor: 'var(--card)', color: 'var(--body)',
  fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-sm)', cursor: 'pointer',
  transition: 'border-color var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)',
  '&:hover': { borderColor: 'var(--accent)', color: 'var(--ink)' },
  '&.Mui-disabled': { opacity: 0.45, cursor: 'default' },
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
} as const;
