import { Fragment, useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import { Box, ButtonBase, Modal } from '@mui/material';
import { X, Plus, LayoutTemplate, Palette, Trash2, Pencil, Save, Globe2, Lock } from 'lucide-react';
import type { SiteTemplate } from './siteTemplates';
import { DESIGN_PRESETS, type DesignPreset } from '../constants';
import type { SiteTemplateDto } from '../../../services/api/bookingEngineApi';

/**
 * Galerie « Choisir un design » (Studio). Deux notions DISTINCTES :
 *  1. TEMPLATES — designs complets (thème + pages). Catalogue persistant : global Clenzy + privés à
 *     l'org (backend). « Page vierge » repart de zéro ; « Enregistrer le design actuel » ajoute le
 *     design courant au catalogue. « Importer un JSON » colle un template.json.
 *  2. THÈMES DE COULEUR — juste une palette + typo, appliquée SANS toucher à la mise en page.
 */

/** « safariLodge » → « Safari Lodge ». */
function presetLabel(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
}

/** Extrait l'aperçu d'un template enregistré : blocs de l'accueil + couleur d'accent. */
function previewOf(contentJson: string): { blocks: { type: string }[]; accent: string } {
  try {
    const o = JSON.parse(contentJson) as { theme?: { primaryColor?: string }; pages?: { type?: string; blocks?: unknown }[] };
    const accent = o.theme?.primaryColor || '#6B8A9A';
    const home = Array.isArray(o.pages) ? (o.pages.find((p) => p.type === 'HOME') ?? o.pages[0]) : undefined;
    const blocks = Array.isArray(home?.blocks) ? (home!.blocks as { type: string }[]) : [];
    return { blocks, accent };
  } catch {
    return { blocks: [], accent: '#6B8A9A' };
  }
}

export interface SiteTemplatePickerProps {
  open: boolean;
  onClose: () => void;
  /** null = page vierge (custom). (Les templates sont désormais servis par le catalogue backend.) */
  onSelect: (template: SiteTemplate | null) => void;
  /** Applique UNIQUEMENT un thème de couleur (palette + typo), sans toucher à la mise en page. */
  onApplyTheme?: (preset: DesignPreset) => void;
  // ─── Catalogue de templates (backend) ───
  templates?: SiteTemplateDto[];
  onSelectSaved?: (template: SiteTemplateDto) => void;
  /**
   * Crée un template au catalogue. Source = le design courant (avec le thème `themeId` choisi si
   * fourni, sinon le thème courant), OU un template.json collé (`json`, qui embarque pages + thème +
   * customCss/customJs). Renvoie un message d'erreur, ou null si succès.
   */
  onSaveTemplate?: (input: { name: string; description: string; scope: 'ORG' | 'GLOBAL'; themeId?: string; logoUrl?: string; json?: string }) => Promise<string | null>;
  /** Modifie un template existant (métadonnées ; contenu remplacé seulement si `json`/`themeId`/`logoUrl`). */
  onUpdateTemplate?: (id: number, input: { name: string; description: string; scope: 'ORG' | 'GLOBAL'; themeId?: string; logoUrl?: string; json?: string }) => Promise<string | null>;
  onDeleteTemplate?: (id: number) => void;
  /** L'utilisateur peut-il publier dans le catalogue global (staff plateforme) ? */
  canPublishGlobal?: boolean;
}

export default function SiteTemplatePicker({
  open, onClose, onSelect, onApplyTheme,
  templates = [], onSelectSaved, onSaveTemplate, onUpdateTemplate, onDeleteTemplate, canPublishGlobal = false,
}: SiteTemplatePickerProps) {
  // Vue : galerie (catalogue + thèmes) ou formulaire de création/édition plein écran.
  const [view, setView] = useState<'gallery' | 'create'>('gallery');
  const [editingId, setEditingId] = useState<number | null>(null);
  // Formulaire « Créer un template » : nom + description + visibilité + thème + import JSON optionnel.
  const [saveName, setSaveName] = useState('');
  const [saveDesc, setSaveDesc] = useState('');
  const [saveScope, setSaveScope] = useState<'ORG' | 'GLOBAL'>('ORG');
  const [saveTheme, setSaveTheme] = useState<string | null>(null); // id de preset, ou null = design actuel
  const [saveLogo, setSaveLogo] = useState('');
  const [saveJson, setSaveJson] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Réinitialise la vue à la fermeture (pas le contenu du formulaire pendant qu'il est ouvert).
  useEffect(() => { if (!open) setView('gallery'); }, [open]);

  const resetSave = () => { setSaveName(''); setSaveDesc(''); setSaveJson(''); setSaveScope('ORG'); setSaveTheme(null); setSaveLogo(''); setSaveError(null); };
  const openCreate = () => { resetSave(); setEditingId(null); setView('create'); };
  const openEdit = (t: SiteTemplateDto) => {
    resetSave();
    setSaveName(t.name);
    setSaveDesc(t.description ?? '');
    setSaveScope(t.scope === 'GLOBAL' ? 'GLOBAL' : 'ORG');
    setEditingId(t.id);
    setView('create');
  };
  const closeCreate = () => { resetSave(); setEditingId(null); setView('gallery'); };

  const runSave = async () => {
    if (!saveName.trim() || saving) return;
    const input = { name: saveName.trim(), description: saveDesc.trim(), scope: saveScope, themeId: saveTheme ?? undefined, logoUrl: saveLogo.trim() || undefined, json: saveJson.trim() || undefined };
    const handler = editingId != null && onUpdateTemplate ? () => onUpdateTemplate(editingId, input) : (onSaveTemplate ? () => onSaveTemplate(input) : null);
    if (!handler) return;
    setSaving(true);
    setSaveError(null);
    const err = await handler();
    setSaving(false);
    if (err) setSaveError(err);
    else closeCreate();
  };

  return (
    <Modal open={open} onClose={onClose} aria-label="Choisir un design"
      sx={{ '& .MuiBackdrop-root': { bgcolor: 'rgba(21,36,45,.45)' } }}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(900px, 94vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        bgcolor: 'var(--card)', color: 'var(--ink)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-pop)', outline: 'none', overflow: 'hidden',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2.5, height: 64, borderBottom: '1px solid var(--line)' }}>
          <Box>
            <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-semibold)' }}>
              {view === 'create' ? (editingId != null ? 'Modifier le template' : 'Créer un template') : 'Choisir un design'}
            </Box>
            <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>
              {view === 'create'
                ? (editingId != null
                    ? 'Modifie le nom, la visibilité et le thème. Laisse le contenu vide pour garder le design actuel.'
                    : 'Nom, visibilité et thème de couleur du template — ou importe un template.json.')
                : 'Applique un thème + une mise en page. Remplace la page et le thème actuels — tu peux ensuite tout personnaliser.'}
            </Box>
          </Box>
          <Box sx={{ flex: 1 }} />
          <ButtonBase onClick={onClose} aria-label="Fermer"
            sx={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', color: 'var(--muted)', cursor: 'pointer',
              '&:hover': { bgcolor: 'var(--hover)', color: 'var(--ink)' },
              '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 } }}>
            <X size={20} strokeWidth={2} />
          </ButtonBase>
        </Box>

        <Box sx={{ overflowY: 'auto', p: 2.5 }}>
          {view === 'create' && onSaveTemplate ? (
            // ─── Vue CRÉATION : uniquement le formulaire (pas la liste des templates) ───
            <Box sx={{ maxWidth: 620, mx: 'auto' }}>
              <Box sx={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-semibold)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', mb: 0.5 }}>Nom</Box>
              <Box component="input" value={saveName} placeholder="Nom du template (ex. Riad Marrakech)"
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSaveName(e.target.value)}
                sx={{ width: '100%', height: 40, px: 1.25, mb: 1.5, fontSize: 'var(--text-md)', color: 'var(--ink)', bgcolor: 'var(--field)',
                  border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', outline: 'none', '&:focus': { borderColor: 'var(--accent)' } }} />

              <Box sx={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-semibold)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', mb: 0.5 }}>Description</Box>
              <Box component="input" value={saveDesc} placeholder="Courte description (optionnel)"
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSaveDesc(e.target.value)}
                sx={{ width: '100%', height: 40, px: 1.25, mb: 1.5, fontSize: 'var(--text-sm)', color: 'var(--ink)', bgcolor: 'var(--field)',
                  border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', outline: 'none', '&:focus': { borderColor: 'var(--accent)' } }} />

              <Box sx={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-semibold)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', mb: 0.5 }}>Logo (URL)</Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                {saveLogo.trim()
                  ? <Box component="img" src={saveLogo.trim()} alt="" sx={{ height: 28, width: 'auto', maxWidth: 80, objectFit: 'contain', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', flexShrink: 0 }} />
                  : null}
                <Box component="input" value={saveLogo} placeholder="https://… (sinon : logo actuel du site)"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSaveLogo(e.target.value)}
                  sx={{ flex: 1, height: 40, px: 1.25, fontSize: 'var(--text-sm)', color: 'var(--ink)', bgcolor: 'var(--field)',
                    border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', outline: 'none', '&:focus': { borderColor: 'var(--accent)' } }} />
              </Box>
              <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--faint)', mb: 1.5 }}>Affiché dans la barre de navigation du site. Vide = on garde le logo actuel.</Box>

              {canPublishGlobal ? (
                <>
                  <Box sx={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-semibold)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', mb: 0.5 }}>Visibilité</Box>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                    <ScopeToggle active={saveScope === 'ORG'} icon={<Lock size={14} strokeWidth={2} />} label="Privé (mon org)" onClick={() => setSaveScope('ORG')} />
                    <ScopeToggle active={saveScope === 'GLOBAL'} icon={<Globe2 size={14} strokeWidth={2} />} label="Catalogue Clenzy (tous)" onClick={() => setSaveScope('GLOBAL')} />
                  </Box>
                </>
              ) : null}

              {/* Thème de couleur du template — choix persistant (ignoré si import JSON). */}
              <Box sx={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-semibold)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', mb: 0.5 }}>Thème de couleur</Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1, mb: 0.5, opacity: saveJson.trim() ? 0.45 : 1, pointerEvents: saveJson.trim() ? 'none' : 'auto' }}>
                <ThemeChip label="Design actuel" selected={saveTheme === null} onClick={() => setSaveTheme(null)} />
                {DESIGN_PRESETS.map((preset) => (
                  <ThemeChip key={preset.id} label={presetLabel(preset.i18nKey)} swatch={preset.swatch}
                    selected={saveTheme === preset.id} onClick={() => setSaveTheme(preset.id)} />
                ))}
              </Box>
              <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--faint)', mb: 1.5 }}>
                Appliqué au template. « Design actuel » garde le thème courant. (Ignoré si tu importes un JSON ci-dessous.)
              </Box>

              {/* Import JSON optionnel (sinon : design actuel + thème choisi). */}
              <Box sx={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-semibold)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', mb: 0.5 }}>Importer un JSON (optionnel)</Box>
              <Box component="textarea" value={saveJson}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setSaveJson(e.target.value)}
                placeholder={editingId != null
                  ? 'Colle un template.json pour REMPLACER le design. Sinon : le design du template est conservé.'
                  : 'Colle un template.json (pages + thème + customCss + customJs). Sinon : design actuel.'}
                spellCheck={false}
                sx={{ width: '100%', minHeight: 130, resize: 'vertical', p: 1.25, mb: 1.5, fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                  fontSize: 'var(--text-xs)', lineHeight: 1.5, color: 'var(--ink)', bgcolor: 'var(--field)',
                  border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', outline: 'none', '&:focus': { borderColor: 'var(--accent)' } }} />

              {saveError ? <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--err)', mb: 1 }}>{saveError}</Box> : null}
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <ButtonBase onClick={closeCreate}
                  sx={{ px: 2, height: 38, borderRadius: 'var(--radius-md)', color: 'var(--muted)', cursor: 'pointer', '&:hover': { bgcolor: 'var(--hover)', color: 'var(--ink)' } }}>Annuler</ButtonBase>
                <ButtonBase onClick={runSave} disabled={saving || !saveName.trim()}
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 2.5, height: 38, borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent)', color: 'var(--on-accent)',
                    fontWeight: 'var(--fw-semibold)', cursor: 'pointer', '&.Mui-disabled': { opacity: 0.5 }, '&:hover': { bgcolor: 'var(--accent-deep, var(--accent))' } }}>
                  <Save size={15} strokeWidth={2} /> {saving ? 'Enregistrement…' : (editingId != null ? 'Enregistrer les modifications' : 'Créer le template')}
                </ButtonBase>
              </Box>
            </Box>
          ) : (
            // ─── Vue GALERIE : catalogue de templates + thèmes (re-style instantané) ───
            <>
              <SectionLabel hint="Designs complets (thème + pages) — catalogue Clenzy + tes templates.">Templates</SectionLabel>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2 }}>
                <Card label="Page vierge" sublabel="Design 100 % custom" blank onClick={() => onSelect(null)} />
                {templates.map((t) => (
                  <SavedCard key={t.id} template={t}
                    onClick={() => onSelectSaved?.(t)}
                    onEdit={onUpdateTemplate ? () => openEdit(t) : undefined}
                    onDelete={onDeleteTemplate ? () => onDeleteTemplate(t.id) : undefined} />
                ))}
                {onSaveTemplate ? (
                  <Card label="Créer un template" sublabel="Design actuel ou import JSON" action onClick={openCreate} />
                ) : null}
              </Box>

              {onApplyTheme ? (
                <Box sx={{ mt: 3 }}>
                  <SectionLabel hint="Re-style le design courant — la mise en page est conservée.">Thèmes de couleur</SectionLabel>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1.25 }}>
                    {DESIGN_PRESETS.map((preset) => (
                      <ThemeChip key={preset.id} label={presetLabel(preset.i18nKey)} swatch={preset.swatch} onClick={() => onApplyTheme(preset)} />
                    ))}
                  </Box>
                </Box>
              ) : null}
            </>
          )}
        </Box>

      </Box>
    </Modal>
  );
}

function SectionLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.25, flexWrap: 'wrap' }}>
      <Box sx={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-semibold)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{children}</Box>
      {hint ? <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--faint)' }}>{hint}</Box> : null}
    </Box>
  );
}

function ScopeToggle({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <ButtonBase onClick={onClick} sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.25, height: 34, borderRadius: 'var(--radius-md)', cursor: 'pointer',
      border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`, bgcolor: active ? 'var(--accent-soft, var(--field))' : 'var(--card)',
      color: active ? 'var(--ink)' : 'var(--muted)', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)',
    }}>{icon}{label}</ButtonBase>
  );
}

/**
 * Pastille de thème : aperçu de palette + libellé. Sans `selected` (galerie) → applique la palette
 * au clic. Avec `selected` (formulaire) → option sélectionnable (choix persistant). `swatch` absent
 * = option « Design actuel » (icône palette seule).
 */
function ThemeChip({ label, swatch, selected = false, onClick }: { label: string; swatch?: [string, string, string]; selected?: boolean; onClick: () => void }) {
  return (
    <ButtonBase onClick={onClick} sx={{
      display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.75, textAlign: 'left',
      borderRadius: 'var(--radius-md)', border: `1px solid ${selected ? 'var(--accent)' : 'var(--line)'}`,
      bgcolor: selected ? 'var(--accent-soft, var(--field))' : 'var(--card)', cursor: 'pointer',
      transition: 'border-color var(--duration-fast) var(--ease-out)',
      '&:hover': { borderColor: 'var(--accent)' },
      '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
    }}>
      {swatch ? (
        <Box sx={{ display: 'flex', width: 40, height: 24, borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--line)' }}>
          {swatch.map((c, i) => <Box key={i} sx={{ flex: i === 0 ? 1.4 : 1, bgcolor: c }} />)}
        </Box>
      ) : null}
      <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Palette size={13} strokeWidth={2} style={{ color: selected ? 'var(--accent)' : 'var(--muted)', flexShrink: 0 }} />
        <Box sx={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</Box>
      </Box>
    </ButtonBase>
  );
}

/** Vignette wireframe : silhouette des blocs de l'accueil, teintée par l'accent du template. */
function Wireframe({ blocks, accent }: { blocks: { type: string }[]; accent: string }) {
  const rows = blocks.slice(0, 5);
  return (
    <Box sx={{ height: 88, p: 0.75, display: 'flex', flexDirection: 'column', gap: '4px', bgcolor: 'var(--field)', overflow: 'hidden' }}>
      {rows.length ? rows.map((b, i) => <Fragment key={i}>{miniRow(b.type, accent)}</Fragment>)
        : <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 'var(--text-2xs)' }}>Aperçu</Box>}
    </Box>
  );
}

/** Un « bloc » réduit à sa silhouette (barre, grille, bouton…) pour la vignette. */
function miniRow(type: string, accent: string): ReactNode {
  const N = 'rgba(0,0,0,0.10)';
  const NS = 'rgba(0,0,0,0.06)';
  const D = 'rgba(0,0,0,0.45)';
  const boxes = (n: number, h: number, bg = N) => (
    <Box sx={{ display: 'flex', gap: '4px' }}>
      {Array.from({ length: n }, (_, j) => <Box key={j} sx={{ flex: 1, height: h, borderRadius: '2px', bgcolor: bg, border: `1px solid ${NS}` }} />)}
    </Box>
  );
  const line = (w: string, bg = N, h = 4) => <Box sx={{ width: w, height: h, borderRadius: 2, bgcolor: bg }} />;
  switch (type) {
    case 'hero':
      return (
        <Box sx={{ height: 28, borderRadius: '3px', bgcolor: accent, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
          {line('52%', 'rgba(255,255,255,0.85)')}
          <Box sx={{ width: '42%', height: 7, borderRadius: 99, bgcolor: 'rgba(255,255,255,0.95)' }} />
        </Box>
      );
    case 'propertyGrid': case 'gallery': case 'logos': return boxes(3, 16);
    case 'amenities': case 'stats': case 'pricing': return boxes(4, 8, NS);
    case 'bookingWidget': return <Box sx={{ height: 12, borderRadius: 99, bgcolor: accent, opacity: 0.85 }} />;
    case 'testimonial': case 'richText': case 'faq':
      return <Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>{line('70%')}{line('50%', NS)}</Box>;
    case 'cta':
      return <Box sx={{ display: 'flex', justifyContent: 'center' }}><Box sx={{ width: '38%', height: 9, borderRadius: 99, bgcolor: accent }} /></Box>;
    case 'footer': return <Box sx={{ height: 8, borderRadius: '2px', bgcolor: D, mt: 'auto', flexShrink: 0 }} />;
    case 'map': case 'video': return <Box sx={{ height: 18, borderRadius: '2px', bgcolor: N, border: `1px solid ${NS}` }} />;
    default: return line('80%', NS);
  }
}

/** Carte d'un template enregistré (catalogue). */
function SavedCard({ template, onClick, onEdit, onDelete }: { template: SiteTemplateDto; onClick: () => void; onEdit?: () => void; onDelete?: () => void }) {
  const { blocks, accent } = previewOf(template.contentJson);
  const global = template.scope === 'GLOBAL';
  return (
    <Box sx={{ position: 'relative', '&:hover .tpl-act': { opacity: 1 } }}>
      <ButtonBase onClick={onClick} sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'stretch', textAlign: 'left', width: '100%',
        borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', overflow: 'hidden', bgcolor: 'var(--card)', cursor: 'pointer',
        transition: 'border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)',
        '&:hover': { borderColor: 'var(--accent)', boxShadow: 'var(--shadow-card)' },
        '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
      }}>
        <Box sx={{ borderBottom: '1px solid var(--line)' }}><Wireframe blocks={blocks} accent={accent} /></Box>
        <Box sx={{ p: 1.5, display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
          <Box component="span" sx={{ display: 'inline-flex', color: global ? 'var(--muted)' : 'var(--accent)', mt: 0.25 }}>
            {global ? <Globe2 size={14} strokeWidth={2} /> : <Lock size={14} strokeWidth={2} />}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-semibold)', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{template.name}</Box>
            <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--faint)', lineHeight: 1.4 }}>{template.description || (global ? 'Catalogue Clenzy' : 'Template privé')}</Box>
          </Box>
        </Box>
      </ButtonBase>
      <Box sx={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 0.5 }}>
        {onEdit ? (
          <ButtonBase className="tpl-act" onClick={(e) => { e.stopPropagation(); onEdit(); }} aria-label="Modifier le template"
            sx={{ width: 26, height: 26, borderRadius: 'var(--radius-md)', bgcolor: 'rgba(21,36,45,.55)', color: '#fff',
              opacity: 0, transition: 'opacity var(--duration-fast) var(--ease-out)', '&:focus-visible': { opacity: 1, outline: '2px solid var(--accent)' }, '&:hover': { bgcolor: 'var(--accent)' } }}>
            <Pencil size={13} strokeWidth={2} />
          </ButtonBase>
        ) : null}
        {onDelete ? (
          <ButtonBase className="tpl-act" onClick={(e) => { e.stopPropagation(); onDelete(); }} aria-label="Supprimer le template"
            sx={{ width: 26, height: 26, borderRadius: 'var(--radius-md)', bgcolor: 'rgba(21,36,45,.55)', color: '#fff',
              opacity: 0, transition: 'opacity var(--duration-fast) var(--ease-out)', '&:focus-visible': { opacity: 1, outline: '2px solid var(--accent)' }, '&:hover': { bgcolor: 'var(--err, #c0392b)' } }}>
            <Trash2 size={13} strokeWidth={2} />
          </ButtonBase>
        ) : null}
      </Box>
    </Box>
  );
}

function Card({ label, sublabel, blank = false, action = false, onClick }: {
  label: string; sublabel: string; blank?: boolean; action?: boolean; onClick: () => void;
}) {
  return (
    <ButtonBase onClick={onClick} sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'stretch', textAlign: 'left',
      borderRadius: 'var(--radius-lg)', border: action ? '1px dashed var(--line-2)' : '1px solid var(--line)', overflow: 'hidden', bgcolor: 'var(--card)', cursor: 'pointer',
      transition: 'border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)',
      '&:hover': { borderColor: 'var(--accent)', boxShadow: action ? 'none' : 'var(--shadow-card)' },
      '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
    }}>
      <Box sx={{ height: 88, display: 'flex', borderBottom: '1px solid var(--line)' }}>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'var(--field)', color: 'var(--muted)' }}>
          {action ? <Save size={22} strokeWidth={1.75} /> : <Plus size={24} strokeWidth={1.75} />}
        </Box>
      </Box>
      <Box sx={{ p: 1.5, display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
        {!blank && !action && <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)', mt: 0.25 }}><LayoutTemplate size={14} strokeWidth={2} /></Box>}
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-semibold)', color: 'var(--ink)' }}>{label}</Box>
          <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--faint)', lineHeight: 1.4 }}>{sublabel}</Box>
        </Box>
      </Box>
    </ButtonBase>
  );
}
