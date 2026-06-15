import { useEffect, useState } from 'react';
import { Box, ButtonBase, CircularProgress, InputBase, Tooltip } from '@mui/material';
import { Sparkles } from 'lucide-react';
import { sitesApi, type SitePage } from '../../../../services/api/sitesApi';

/**
 * Inspecteur de la page active (multi-page 2.2) : titre, chemin, statut (brouillon/publiée) et SEO.
 * Brouillon local synchronisé sur la page sélectionnée ; chaque champ est persisté au blur via
 * `onSave` (PUT page côté hook). Le chemin de la page d'accueil est figé (« / »). Style aligné sur
 * BlockInspector (tokens var(--*)).
 */

export interface PageInspectorProps {
  page: SitePage;
  onSave: (changes: Partial<SitePage>) => void;
}

export default function PageInspector({ page, onSave }: PageInspectorProps) {
  const isHome = page.type === 'HOME';
  const [title, setTitle] = useState(page.title ?? '');
  const [path, setPath] = useState(page.path ?? '');
  const [status, setStatus] = useState(page.status ?? 'DRAFT');
  const [seoTitle, setSeoTitle] = useState(page.seoTitle ?? '');
  const [seoDescription, setSeoDescription] = useState(page.seoDescription ?? '');
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Re-synchronise quand on change de page (l'id devient la clé).
  useEffect(() => {
    setTitle(page.title ?? '');
    setPath(page.path ?? '');
    setStatus(page.status ?? 'DRAFT');
    setSeoTitle(page.seoTitle ?? '');
    setSeoDescription(page.seoDescription ?? '');
  }, [page.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveIfChanged = (key: keyof SitePage, value: string, current: string | null | undefined) => {
    if (value !== (current ?? '')) onSave({ [key]: value } as Partial<SitePage>);
  };

  // Génère titre + meta SEO via l'IA (2.13) à partir du contenu de la page, puis persiste.
  const handleGenerateSeo = () => {
    setGenerating(true);
    setAiError(null);
    sitesApi.generatePageSeo(page.siteId, page.id)
      .then((res) => {
        const t = res.seoTitle ?? '';
        const d = res.seoDescription ?? '';
        setSeoTitle(t);
        setSeoDescription(d);
        onSave({ seoTitle: t, seoDescription: d });
      })
      .catch((e) => setAiError(e instanceof Error ? e.message : 'Génération impossible'))
      .finally(() => setGenerating(false));
  };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-bold)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>
        Page
      </Box>

      <Field label="Titre">
        <InputBase value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => saveIfChanged('title', title, page.title)} sx={inputSx} />
      </Field>

      <Field label="Chemin">
        <InputBase
          value={path}
          disabled={isHome}
          placeholder="/a-propos"
          onChange={(e) => setPath(e.target.value)}
          onBlur={() => saveIfChanged('path', path, page.path)}
          sx={{ ...inputSx, fontFamily: 'var(--font-mono, monospace)', '&.Mui-disabled': { opacity: 0.6 } }}
        />
      </Field>
      {isHome && <Box sx={{ mt: -1.25, fontSize: 'var(--text-2xs)', color: 'var(--faint)' }}>Le chemin de la page d’accueil est figé.</Box>}

      <Field label="Statut">
        <Box
          component="select"
          value={status}
          onChange={(e) => { const v = (e.target as HTMLSelectElement).value; setStatus(v); if (v !== page.status) onSave({ status: v }); }}
          sx={{
            width: '100%', height: 36, px: 1, fontSize: 'var(--text-md)', color: 'var(--ink)',
            bgcolor: 'var(--field)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', cursor: 'pointer',
            '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 1 },
          }}
        >
          <option value="DRAFT">Brouillon</option>
          <option value="PUBLISHED">Publiée</option>
        </Box>
      </Field>

      <Box sx={{ mt: 0.5, pt: 1.5, borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-bold)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>
          SEO
        </Box>
        <Tooltip title="Générer le SEO depuis le contenu de la page">
          <ButtonBase
            onClick={handleGenerateSeo}
            disabled={generating}
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 26, px: 1,
              borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', color: 'var(--accent)',
              fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-semibold)', cursor: 'pointer',
              '&:hover': { borderColor: 'var(--accent)', bgcolor: 'var(--accent-soft)' },
              '&.Mui-disabled': { opacity: 0.5 },
            }}
          >
            {generating ? <CircularProgress size={12} color="inherit" /> : <Sparkles size={12} strokeWidth={2} />}
            {generating ? 'Génération…' : 'Générer (IA)'}
          </ButtonBase>
        </Tooltip>
      </Box>
      {aiError && <Box sx={{ mt: -1, fontSize: 'var(--text-2xs)', color: 'var(--err)' }}>{aiError}</Box>}

      <Field label="Titre SEO">
        <InputBase value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} onBlur={() => saveIfChanged('seoTitle', seoTitle, page.seoTitle)} sx={inputSx} />
      </Field>

      <Field label="Description SEO">
        <InputBase
          value={seoDescription}
          multiline
          minRows={3}
          onChange={(e) => setSeoDescription(e.target.value)}
          onBlur={() => saveIfChanged('seoDescription', seoDescription, page.seoDescription)}
          sx={{ ...inputSx, '& textarea': { lineHeight: 1.5 } }}
        />
      </Field>
    </Box>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Box component="label" sx={{ display: 'block', mb: 0.75, fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--body)' }}>{label}</Box>
      {children}
    </Box>
  );
}

const inputSx = {
  width: '100%', px: 1.25, py: 0.75, fontSize: 'var(--text-md)', color: 'var(--ink)',
  bgcolor: 'var(--field)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)',
  transition: 'border-color var(--duration-fast) var(--ease-out)',
  '&.Mui-focused': { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft)' },
} as const;
