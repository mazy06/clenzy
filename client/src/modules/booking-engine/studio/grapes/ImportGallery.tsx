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
      <div className="flex flex-col items-center gap-1.5 py-9 text-center text-[var(--muted)]">
        <LayoutTemplate size={28} strokeWidth={1.75} style={{ color: 'var(--faint)' }} />
        <div className="text-[var(--text-md)] font-[var(--fw-semibold)] text-[var(--ink)]">Galerie de templates</div>
        <div className="text-[var(--text-sm)] text-[var(--faint)]">Catalogue en cours de constitution.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[var(--text-sm)] text-[var(--muted)] leading-[1.5]">
        Choisissez un modèle de départ. Le canevas actuel sera remplacé ; vous pourrez tout éditer ensuite.
      </div>
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
            <div className="p-2 flex flex-col gap-0.5">
              <div className="text-[var(--text-sm)] font-[var(--fw-semibold)] text-[var(--ink)]">{tpl.name}</div>
              {tpl.description ? <div className="text-[var(--text-2xs)] text-[var(--muted)]">{tpl.description}</div> : null}
            </div>
          </ButtonBase>
        ))}
      </Box>
    </div>
  );
}
