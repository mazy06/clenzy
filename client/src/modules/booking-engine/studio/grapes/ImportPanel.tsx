import { useState, type ReactNode } from 'react';
import { Box, ButtonBase, Modal } from '@mui/material';
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
        <Box sx={{ py: 6, textAlign: 'center', color: 'var(--faint)', fontSize: 'var(--text-sm)' }}>
          Éditeur non disponible.
        </Box>
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
    <Modal open={open} onClose={onClose} aria-label="Importer un design"
      sx={{ '& .MuiBackdrop-root': { bgcolor: 'rgba(21,36,45,.45)' } }}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(680px, 94vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        bgcolor: 'var(--card)', color: 'var(--ink)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-pop)', outline: 'none', overflow: 'hidden',
      }}>
        {/* En-tête */}
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2.5, height: 64, borderBottom: '1px solid var(--line)' }}>
          <Box>
            <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-semibold)' }}>
              Importer un design
            </Box>
            <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>
              Charge un contenu HTML+CSS dans l'éditeur. Le canevas actuel sera remplacé.
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

        {/* Onglets */}
        <Box sx={{ display: 'flex', gap: 0.5, px: 2.5, pt: 1.5, borderBottom: '1px solid var(--line)' }}>
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <ButtonBase key={t.id} onClick={() => setTab(t.id)}
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.5, height: 38,
                  borderRadius: 'var(--radius-md) var(--radius-md) 0 0', cursor: 'pointer',
                  color: active ? 'var(--ink)' : 'var(--muted)', fontWeight: 'var(--fw-medium)', fontSize: 'var(--text-sm)',
                  borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                  transition: 'color var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out)',
                  '&:hover': { color: 'var(--ink)' },
                  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
                }}>
                {t.icon}{t.label}
              </ButtonBase>
            );
          })}
        </Box>

        {/* Corps de l'onglet actif */}
        <Box sx={{ overflowY: 'auto', p: 2.5 }}>{renderSlot()}</Box>
      </Box>
    </Modal>
  );
}
