import { Box, ButtonBase } from '@mui/material';
import { LayoutTemplate } from 'lucide-react';
import type { Editor } from 'grapesjs';
import { GALLERY_TEMPLATES, type GalleryTemplate } from './import/galleryTemplates';
import { loadHtmlIntoEditor } from './loadIntoEditor';

/**
 * Onglet « Galerie » de l'Importer : grille de templates de démarrage (HTML+CSS). Au clic, le template
 * est chargé dans l'éditeur via `loadHtmlIntoEditor` (canevas remplacé + CSS ajouté), puis `onDone()`.
 */
export interface ImportGalleryProps {
  /** Éditeur GrapesJS cible. */
  editor: Editor;
  /** Appelé après le chargement d'un template (ferme le panneau). */
  onDone: () => void;
}

export default function ImportGallery({ editor, onDone }: ImportGalleryProps) {
  const choose = (tpl: GalleryTemplate) => {
    loadHtmlIntoEditor(editor, { html: tpl.html, css: tpl.css });
    onDone();
  };

  if (GALLERY_TEMPLATES.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, py: 6, textAlign: 'center', color: 'var(--muted)' }}>
        <LayoutTemplate size={28} strokeWidth={1.75} style={{ color: 'var(--faint)' }} />
        <Box sx={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-semibold)', color: 'var(--ink)' }}>Galerie de templates</Box>
        <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--faint)' }}>Catalogue en cours de constitution.</Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', lineHeight: 1.5 }}>
        Choisissez un modèle de départ. Le canevas actuel sera remplacé ; vous pourrez tout éditer ensuite.
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1.5 }}>
        {GALLERY_TEMPLATES.map((tpl) => (
          <ButtonBase
            key={tpl.id}
            onClick={() => choose(tpl)}
            sx={{
              display: 'flex', flexDirection: 'column', alignItems: 'stretch', textAlign: 'left',
              border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', overflow: 'hidden', cursor: 'pointer',
              bgcolor: 'var(--card)', transition: 'border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)',
              '&:hover': { borderColor: 'var(--accent)', boxShadow: 'var(--shadow-card)' },
              '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
            }}
          >
            {/* Aperçu : vignette si fournie, sinon bande d'accent du template. */}
            <Box sx={{ height: 96, bgcolor: 'var(--field)', backgroundImage: tpl.thumbnail ? `url("${tpl.thumbnail}")` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }} />
            <Box sx={{ p: 1.25, fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--ink)' }}>{tpl.name}</Box>
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
}
