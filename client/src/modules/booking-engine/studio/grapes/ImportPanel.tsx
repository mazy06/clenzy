import { useState, type ReactNode } from 'react';
import { cn } from '../../../../utils/cn';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui';
import { X, ClipboardPaste, FileUp, LayoutTemplate } from 'lucide-react';
import type { Editor } from 'grapesjs';
import type { GalleryTemplate } from './import/galleryTemplates';
import ImportPaste from './ImportPaste';
import ImportFile from './ImportFile';
import ImportGallery from './ImportGallery';

/**
 * Panneau « Importer » du Studio GrapesJS : modale multi-onglets qui rend l'un des 3 composants de slot
 * (« Coller », « Fichier », « Galerie »). On importe des EXPORTS de templates (fichiers issus de
 * générateurs/CMS : HTML/Bootstrap, Webflow, Gutenberg, Elementor, GrapesJS…), jamais une URL live
 * (le scraping live a été abandonné : fidélité non garantie). Chaque slot converge vers HTML+CSS via
 * la couche d'adaptation (`import/*`) puis injecte via `loadHtmlIntoEditor` et appelle `onDone`.
 */

type TabId = 'file' | 'paste' | 'gallery';

interface TabDef {
  id: TabId;
  label: string;
  icon: ReactNode;
}

const TABS: TabDef[] = [
  { id: 'file', label: 'Fichier', icon: <FileUp size={15} strokeWidth={2} /> },
  { id: 'paste', label: 'Coller', icon: <ClipboardPaste size={15} strokeWidth={2} /> },
  { id: 'gallery', label: 'Galerie', icon: <LayoutTemplate size={15} strokeWidth={2} /> },
];

export interface ImportPanelProps {
  /** Ouverture contrôlée par `GrapesStudio` (bouton « Importer » du panneau d'options). */
  open: boolean;
  /** Ferme le panneau (croix, backdrop, ou fin d'import via `onDone`). */
  onClose: () => void;
  /** Éditeur GrapesJS cible (transmis aux slots pour l'injection). `null` tant que non monté. */
  editor: Editor | null;
  /** Import d'un template natif multi-page (résolu par `GrapesStudio` : pages + thème + accueil). */
  onImportTemplate: (template: GalleryTemplate) => void;
}

export default function ImportPanel({ open, onClose, editor, onImportTemplate }: ImportPanelProps) {
  const [tab, setTab] = useState<TabId>('file');

  // Garde-fou : sans éditeur monté, aucun slot ne peut injecter — on ne rend pas le corps.
  const renderSlot = (): ReactNode => {
    if (!editor) {
      return (
        <div className="py-9 text-center text-[var(--faint)] text-[var(--text-sm)]">
          Éditeur non disponible.
        </div>
      );
    }
    switch (tab) {
      case 'file':
        return <ImportFile editor={editor} onDone={onClose} />;
      case 'paste':
        return <ImportPaste editor={editor} onDone={onClose} />;
      case 'gallery':
        return <ImportGallery onImportTemplate={onImportTemplate} onDone={onClose} />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="w-[min(680px,94vw)] sm:max-w-[680px] max-h-[88vh] flex flex-col gap-0 p-0 overflow-hidden bg-[var(--card)] text-[var(--ink)] border border-solid border-[var(--line)] rounded-[var(--radius-lg)] shadow-[var(--shadow-pop)]"
      >
        {/* En-tête */}
        <DialogHeader className="flex-row items-center gap-0 px-3.5 h-[64px] shrink-0 border-b border-solid border-[var(--line)]">
          <div>
            <DialogTitle
              className="font-[family-name:var(--font-display)]"
              style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-semibold)' }}
            >
              Importer un design
            </DialogTitle>
            <DialogDescription className="text-[var(--muted)]" style={{ fontSize: 'var(--text-sm)' }}>
              Charge un contenu HTML+CSS dans l'éditeur. Le canevas actuel sera remplacé.
            </DialogDescription>
          </div>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Fermer"
            className="size-[34px] rounded-[var(--radius-md)] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
          >
            <X size={20} strokeWidth={2} />
          </Button>
        </DialogHeader>

        {/* Onglets */}
        <div className="flex gap-0.5 px-3.5 pt-2 shrink-0 border-b border-solid border-[var(--line)]">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'inline-flex items-center gap-[4.5px] px-[9px] h-[38px] cursor-pointer',
                  'rounded-t-[var(--radius-md)] rounded-b-none border-b-2 border-solid',
                  'transition-[color,border-color] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
                  'hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2',
                  active ? 'text-[var(--ink)] border-b-[var(--accent)]' : 'text-[var(--muted)] border-b-transparent',
                )}
                style={{ fontWeight: 'var(--fw-medium)', fontSize: 'var(--text-sm)' }}
              >
                {t.icon}{t.label}
              </button>
            );
          })}
        </div>

        {/* Corps de l'onglet actif */}
        <div className="overflow-y-auto p-3.5">{renderSlot()}</div>
      </DialogContent>
    </Dialog>
  );
}
