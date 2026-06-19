import { Box, ButtonBase } from '@mui/material';
import { LayoutTemplate } from 'lucide-react';
import { GALLERY_TEMPLATES, type GalleryTemplate } from './import/galleryTemplates';

/**
 * Onglet « Galerie » de l'Importer : grille de templates NATIFS multi-page. Au clic, le template est
 * importé via `onImportTemplate` (géré par `GrapesStudio` : crée une `SitePage` par page, charge
 * l'accueil dans le canvas, applique le thème), puis `onDone()` ferme le panneau.
 */
export interface ImportGalleryProps {
  /** Importe un template multi-page (résolu par `GrapesStudio` : pages + thème + chargement accueil). */
  onImportTemplate: (template: GalleryTemplate) => void;
  /** Appelé après le déclenchement de l'import (ferme le panneau). */
  onDone: () => void;
}

export default function ImportGallery({ onImportTemplate, onDone }: ImportGalleryProps) {
  const choose = (tpl: GalleryTemplate) => {
    onImportTemplate(tpl);
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
            <Box sx={{ p: 1.25, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              <Box sx={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--ink)' }}>{tpl.name}</Box>
              {tpl.description ? <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--muted)' }}>{tpl.description}</Box> : null}
            </Box>
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
}
