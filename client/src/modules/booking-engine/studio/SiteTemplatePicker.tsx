import { useState, type ChangeEvent } from 'react';
import { Box, ButtonBase, Modal } from '@mui/material';
import { X, Plus, LayoutTemplate, FileJson } from 'lucide-react';
import { SITE_TEMPLATES, type SiteTemplate } from './siteTemplates';

/**
 * Galerie de templates de site hébergé (Studio). Sélectionner un template applique son thème +
 * sa composition de blocs. « Page vierge » = repartir de zéro pour un design 100 % custom.
 * « Importer un JSON » colle un template.json multi-page (sortie Claude Design).
 * Avertit que l'application remplace la page + le thème courants.
 */

export interface SiteTemplatePickerProps {
  open: boolean;
  onClose: () => void;
  /** template = appliquer ; null = page vierge (custom). */
  onSelect: (template: SiteTemplate | null) => void;
  /** Import d'un template.json multi-page collé. Renvoie un message d'erreur, ou null si succès. */
  onImport?: (jsonText: string) => Promise<string | null>;
}

export default function SiteTemplatePicker({ open, onClose, onSelect, onImport }: SiteTemplatePickerProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const runImport = async () => {
    if (!onImport || !importText.trim() || importing) return;
    setImporting(true);
    setImportError(null);
    const err = await onImport(importText);
    setImporting(false);
    if (err) {
      setImportError(err);
    } else {
      setImportText('');
      setImportOpen(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} aria-label="Choisir un template de site"
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
              Choisir un design
            </Box>
            <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>
              Applique un thème + une mise en page. Remplace la page et le thème actuels — tu peux ensuite tout personnaliser.
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

        <Box sx={{ overflowY: 'auto', p: 2.5, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2 }}>
          <Card label="Page vierge" sublabel="Design 100 % custom" blank onClick={() => onSelect(null)} />
          {SITE_TEMPLATES.map((tpl) => (
            <Card key={tpl.id} label={tpl.label} sublabel={tpl.description} swatch={tpl.preset.swatch} onClick={() => onSelect(tpl)} />
          ))}
        </Box>

        {onImport ? (
          <Box sx={{ borderTop: '1px solid var(--line)', p: 2.5, flexShrink: 0 }}>
            {!importOpen ? (
              <ButtonBase onClick={() => { setImportOpen(true); setImportError(null); }}
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 1.5, height: 38, borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--line-2)', color: 'var(--body)', cursor: 'pointer',
                  '&:hover': { borderColor: 'var(--accent)', color: 'var(--ink)' },
                  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 } }}>
                <FileJson size={16} strokeWidth={2} />
                <Box component="span" sx={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)' }}>Importer un template (JSON)</Box>
              </ButtonBase>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>
                  Colle un <code>template.json</code> multi-page (sortie Claude Design). Remplace l'accueil + le thème.
                </Box>
                <Box component="textarea" value={importText}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setImportText(e.target.value)}
                  placeholder='{ "id": "...", "name": "...", "theme": { ... }, "pages": [ ... ] }'
                  spellCheck={false}
                  sx={{ width: '100%', minHeight: 160, resize: 'vertical', p: 1.5, fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                    fontSize: 'var(--text-xs)', lineHeight: 1.5, color: 'var(--ink)', bgcolor: 'var(--field)',
                    border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', outline: 'none',
                    '&:focus': { borderColor: 'var(--accent)' } }} />
                {importError ? (
                  <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--err)' }}>{importError}</Box>
                ) : null}
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                  <ButtonBase onClick={() => { setImportOpen(false); setImportError(null); }}
                    sx={{ px: 2, height: 38, borderRadius: 'var(--radius-md)', color: 'var(--muted)', cursor: 'pointer',
                      '&:hover': { bgcolor: 'var(--hover)', color: 'var(--ink)' } }}>Annuler</ButtonBase>
                  <ButtonBase onClick={runImport} disabled={importing || !importText.trim()}
                    sx={{ px: 2.5, height: 38, borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent)', color: 'var(--on-accent)',
                      fontWeight: 'var(--fw-semibold)', cursor: 'pointer', '&.Mui-disabled': { opacity: 0.5 },
                      '&:hover': { bgcolor: 'var(--accent-deep, var(--accent))' } }}>
                    {importing ? 'Import…' : 'Importer'}
                  </ButtonBase>
                </Box>
              </Box>
            )}
          </Box>
        ) : null}
      </Box>
    </Modal>
  );
}

function Card({ label, sublabel, swatch, blank = false, onClick }: {
  label: string; sublabel: string; swatch?: [string, string, string]; blank?: boolean; onClick: () => void;
}) {
  return (
    <ButtonBase onClick={onClick} sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'stretch', textAlign: 'left',
      borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', overflow: 'hidden', bgcolor: 'var(--card)', cursor: 'pointer',
      transition: 'border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)',
      '&:hover': { borderColor: 'var(--accent)', boxShadow: 'var(--shadow-card)' },
      '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
    }}>
      <Box sx={{ height: 88, display: 'flex' }}>
        {blank || !swatch ? (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'var(--field)', color: 'var(--muted)' }}>
            <Plus size={24} strokeWidth={1.75} />
          </Box>
        ) : (
          swatch.map((c, i) => <Box key={i} sx={{ flex: i === 0 ? 1.4 : 1, bgcolor: c }} />)
        )}
      </Box>
      <Box sx={{ p: 1.5, display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
        {!blank && <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)', mt: 0.25 }}><LayoutTemplate size={14} strokeWidth={2} /></Box>}
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-semibold)', color: 'var(--ink)' }}>{label}</Box>
          <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--faint)', lineHeight: 1.4 }}>{sublabel}</Box>
        </Box>
      </Box>
    </ButtonBase>
  );
}
