import { Box, ButtonBase, Modal } from '@mui/material';
import { X, Plus, LayoutTemplate } from 'lucide-react';
import { SITE_TEMPLATES, type SiteTemplate } from './siteTemplates';

/**
 * Galerie de templates de site hébergé (Studio). Sélectionner un template applique son thème +
 * sa composition de blocs. « Page vierge » = repartir de zéro pour un design 100 % custom.
 * Avertit que l'application remplace la page + le thème courants.
 */

export interface SiteTemplatePickerProps {
  open: boolean;
  onClose: () => void;
  /** template = appliquer ; null = page vierge (custom). */
  onSelect: (template: SiteTemplate | null) => void;
}

export default function SiteTemplatePicker({ open, onClose, onSelect }: SiteTemplatePickerProps) {
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
