import { useEffect, useState } from 'react';
import { Skeleton } from '../../../../components/ui';
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
        <Skeleton className="h-[220px] w-full rounded-[var(--radius-lg)] bg-[var(--hover)]" />
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
        <div className="text-[var(--text-lg)] font-[family-name:var(--fw-semibold)] mb-0.5">Aucune propriété</div>
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
                <div className="text-[var(--text-2xs)] font-[family-name:var(--fw-bold)] tracking-[.06em] uppercase text-[var(--faint)] mb-0.5">Titre</div>
                <div className="text-[var(--text-md)] font-[family-name:var(--fw-semibold)] text-[var(--ink)]">{result.title}</div>
              </div>
            )}
            <div className="text-[var(--text-2xs)] font-[family-name:var(--fw-bold)] tracking-[.06em] uppercase text-[var(--faint)] mb-0.5">
              {result.kind === 'SEO_META' ? 'Meta description' : 'Contenu'}
            </div>
            <div className="text-[var(--text-md)] text-[var(--body)] leading-[1.6] whitespace-pre-wrap">{result.content}</div>
            <div className="flex justify-end mt-3">
              <button type="button" onClick={copy} className={GHOST_BTN_CLASS}>
                {copied ? <Check size={15} strokeWidth={2.4} /> : <Copy size={15} strokeWidth={2} />}
                {copied ? 'Copié' : 'Copier'}
              </button>
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={variant === 'solid' ? SOLID_BTN_CLASS : GHOST_BTN_CLASS}
    >
      <Icon size={16} strokeWidth={2} />
      {loading ? 'Génération…' : label}
    </button>
  );
}

// Boutons maison du Studio (l'ancien ButtonBase + sx) : le kit n'a pas de
// variante calee sur les tokens `--text-sm`/`--fw-semibold` du Studio.
// `font-[number:…]` et la transition en propriete brute `[transition:…]` : Tailwind
// v4 n'infere pas le type derriere `var(`, ni pour une graisse ni pour une duree.
const BTN_BASE_CLASS =
  'inline-flex items-center gap-[4.5px] h-10 px-[13.5px] rounded-[var(--radius-md)] ' +
  'font-[number:var(--fw-semibold)] text-[var(--text-sm)] cursor-pointer ' +
  'focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2 ' +
  'disabled:opacity-45 disabled:cursor-default';

const SOLID_BTN_CLASS =
  `${BTN_BASE_CLASS} border-none bg-[var(--accent)] text-[var(--on-accent)] ` +
  '[transition:background_var(--duration-fast)_var(--ease-out)] ' +
  'hover:bg-[var(--accent-deep)]';

const GHOST_BTN_CLASS =
  `${BTN_BASE_CLASS} border border-solid border-[var(--line)] bg-[var(--card)] text-[var(--body)] ` +
  '[transition:border-color_var(--duration-fast)_var(--ease-out),color_var(--duration-fast)_var(--ease-out)] ' +
  'hover:border-[var(--accent)] hover:text-[var(--ink)]';
