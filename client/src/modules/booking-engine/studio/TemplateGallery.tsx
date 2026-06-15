import { Box, ButtonBase, Modal } from '@mui/material';
import { X, Sparkles, Plus } from 'lucide-react';
import { DESIGN_PRESETS, type DesignPreset } from '../constants';

/**
 * Galerie de templates du Baitly Studio (F1). Cartes preview (swatch + nom) à partir des design
 * presets existants, + une option « Vierge ». La sélection crée un nouveau booking engine.
 * Le catalogue de templates de site complet (par vertical) arrivera avec le backend SiteTemplate.
 */

const PRESET_LABELS: Record<string, string> = {
  'safari-lodge': 'Safari Lodge',
  'stripe-minimal': 'Stripe Minimal',
  'ocean-breeze': 'Ocean Breeze',
  'urban-chic': 'Urban Chic',
  'provencal': 'Provençal',
  'nordic': 'Nordic',
};

export interface TemplateGalleryProps {
  open: boolean;
  onClose: () => void;
  /** preset = template choisi ; null = projet vierge. */
  onSelect: (preset: DesignPreset | null) => void;
  creating?: boolean;
}

export default function TemplateGallery({ open, onClose, onSelect, creating = false }: TemplateGalleryProps) {
  return (
    <Modal open={open} onClose={creating ? undefined : onClose} aria-label="Galerie de templates"
      sx={{ '& .MuiBackdrop-root': { bgcolor: 'rgba(21,36,45,.45)' } }}>
      <Box
        sx={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 'min(880px, 94vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column',
          bgcolor: 'var(--card)', color: 'var(--ink)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-pop)', outline: 'none', overflow: 'hidden',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2.5, height: 60, borderBottom: '1px solid var(--line)' }}>
          <Box>
            <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-semibold)' }}>
              Choisir un point de départ
            </Box>
            <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>
              Un template, ou une page vierge — tout reste personnalisable ensuite.
            </Box>
          </Box>
          <Box sx={{ flex: 1 }} />
          <ButtonBase onClick={onClose} disabled={creating} aria-label="Fermer"
            sx={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', color: 'var(--muted)', cursor: 'pointer',
              '&:hover': { bgcolor: 'var(--hover)', color: 'var(--ink)' },
              '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 } }}>
            <X size={20} strokeWidth={2} />
          </ButtonBase>
        </Box>

        <Box sx={{ overflowY: 'auto', p: 2.5, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
          {/* Vierge */}
          <TemplateCard
            label="Page vierge"
            sublabel="Partir de zéro"
            swatch={['var(--accent)', 'var(--line-2)', 'var(--field)']}
            blank
            disabled={creating}
            onClick={() => onSelect(null)}
          />
          {DESIGN_PRESETS.map((p) => (
            <TemplateCard
              key={p.id}
              label={PRESET_LABELS[p.id] ?? p.id}
              sublabel={p.fontFamily}
              swatch={p.swatch}
              disabled={creating}
              onClick={() => onSelect(p)}
            />
          ))}
        </Box>
      </Box>
    </Modal>
  );
}

function TemplateCard({
  label, sublabel, swatch, blank = false, disabled = false, onClick,
}: { label: string; sublabel: string; swatch: [string, string, string] | string[]; blank?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'stretch', textAlign: 'left',
        borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', overflow: 'hidden',
        bgcolor: 'var(--card)', cursor: 'pointer',
        transition: 'border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)',
        '&:hover': { borderColor: 'var(--accent)', boxShadow: 'var(--shadow-card)' },
        '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
        '&.Mui-disabled': { opacity: 0.55 },
      }}
    >
      <Box sx={{ height: 96, display: 'flex', position: 'relative' }}>
        {blank ? (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'var(--field)', color: 'var(--muted)' }}>
            <Plus size={26} strokeWidth={1.75} />
          </Box>
        ) : (
          swatch.map((c, i) => <Box key={i} sx={{ flex: i === 0 ? 1.4 : 1, bgcolor: c }} />)
        )}
      </Box>
      <Box sx={{ p: 1.25, display: 'flex', alignItems: 'center', gap: 0.75 }}>
        {!blank && <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Sparkles size={13} strokeWidth={2} /></Box>}
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-semibold)', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</Box>
          <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--faint)' }}>{sublabel}</Box>
        </Box>
      </Box>
    </ButtonBase>
  );
}
