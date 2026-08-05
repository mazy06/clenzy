import { LayoutTemplate } from 'lucide-react';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../../components/ui';
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
      <Empty className="py-9">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LayoutTemplate strokeWidth={1.75} />
          </EmptyMedia>
          <EmptyTitle>Galerie de templates</EmptyTitle>
          <EmptyDescription>Catalogue en cours de constitution.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm leading-normal text-muted-foreground">
        Choisissez un modèle de départ. Le canevas actuel sera remplacé ; vous pourrez tout éditer ensuite.
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,_minmax(180px,_1fr))] gap-2.5">
        {GALLERY_TEMPLATES.map((tpl) => (
          <button
            type="button"
            key={tpl.id}
            onClick={() => choose(tpl)}
            className={
              'flex cursor-pointer flex-col items-stretch overflow-hidden rounded-lg border border-border bg-card text-start '
              + 'transition-[border-color,box-shadow] duration-150 ease-out-quart motion-reduce:transition-none '
              + 'hover:border-primary hover:shadow-sm '
              + 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
            }
          >
            {/* Aperçu : vignette si fournie, sinon fond de champ neutre. */}
            <div
              className="h-24 bg-field bg-cover bg-center"
              style={{ backgroundImage: tpl.thumbnail ? `url("${tpl.thumbnail}")` : 'none' }}
            />
            <div className="flex flex-col gap-0.5 p-2">
              <span className="text-sm font-semibold text-foreground">{tpl.name}</span>
              {tpl.description ? (
                <span className="text-2xs text-muted-foreground">{tpl.description}</span>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
