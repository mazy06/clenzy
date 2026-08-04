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
        <div className="text-[var(--text-md)] font-[family-name:var(--fw-semibold)] text-[var(--ink)]">Galerie de templates</div>
        <div className="text-[var(--text-sm)] text-[var(--faint)]">Catalogue en cours de constitution.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[var(--text-sm)] text-[var(--muted)] leading-[1.5]">
        Choisissez un modèle de départ. Le canevas actuel sera remplacé ; vous pourrez tout éditer ensuite.
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,_minmax(180px,_1fr))] gap-[9px]">
        {GALLERY_TEMPLATES.map((tpl) => (
          <button
            type="button"
            key={tpl.id}
            onClick={() => choose(tpl)}
            className={
              'flex flex-col items-stretch text-left overflow-hidden cursor-pointer '
              + 'border border-solid border-[var(--line)] rounded-[var(--radius-md)] bg-[var(--card)] '
              + '[transition:border-color_var(--duration-fast)_var(--ease-out),box-shadow_var(--duration-fast)_var(--ease-out)] '
              + 'hover:border-[var(--accent)] hover:shadow-[var(--shadow-card)] '
              + 'focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px]'
            }
          >
            {/* Aperçu : vignette si fournie, sinon bande d'accent du template. */}
            <div
              className="h-24 bg-[var(--field)] bg-cover bg-center"
              style={{ backgroundImage: tpl.thumbnail ? `url("${tpl.thumbnail}")` : 'none' }}
            />
            <div className="p-2 flex flex-col gap-0.5">
              <div className="text-[var(--text-sm)] font-[family-name:var(--fw-semibold)] text-[var(--ink)]">{tpl.name}</div>
              {tpl.description ? <div className="text-[var(--text-2xs)] text-[var(--muted)]">{tpl.description}</div> : null}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
