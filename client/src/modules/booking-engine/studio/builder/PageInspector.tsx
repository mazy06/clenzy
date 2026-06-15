import { useEffect, useState } from 'react';
import { Box, InputBase } from '@mui/material';
import type { SitePage } from '../../../../services/api/sitesApi';

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

      <Box sx={{ mt: 0.5, pt: 1.5, borderTop: '1px solid var(--line)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-bold)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>
        SEO
      </Box>

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
