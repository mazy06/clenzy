import { Box, InputBase } from '@mui/material';
import type { BookingEngineConfig } from '../../../../services/api/bookingEngineApi';

/**
 * Corps de l'inspecteur de thème (onglet « Thème » du pane droit, F2b). Édite les champs config
 * réels primaryColor + fontFamily ; les changements se répercutent en direct dans le canvas et
 * se persistent via la barre d'enregistrement du pane (DesignBuilder).
 */

const FONTS = [
  'Inter', 'Poppins', 'Montserrat', 'Playfair Display', 'Lora', 'Merriweather', 'Work Sans', 'system-ui',
];

const SWATCHES = ['#5453D6', '#0F7A6B', '#C2410C', '#B91C6B', '#1D4ED8', '#15803D', '#7C3AED', '#0E7490'];

export interface ThemeInspectorProps {
  config: BookingEngineConfig | null;
  patch: (changes: Partial<BookingEngineConfig>) => void;
}

export default function ThemeInspector({ config, patch }: ThemeInspectorProps) {
  if (!config) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3, color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>
        Chargement du thème…
      </Box>
    );
  }

  const primary = config.primaryColor || '#5453D6';
  const font = config.fontFamily || 'Inter';

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box>
        <Box component="label" htmlFor="theme-primary" sx={labelSx}>Couleur principale</Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
          <Box
            component="input"
            id="theme-primary"
            type="color"
            value={primary}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => patch({ primaryColor: e.target.value })}
            sx={{ width: 38, height: 38, p: 0, border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', bgcolor: 'transparent', cursor: 'pointer', flexShrink: 0, '&::-webkit-color-swatch-wrapper': { p: '3px' }, '&::-webkit-color-swatch': { border: 'none', borderRadius: 6 } }}
          />
          <InputBase
            value={primary}
            onChange={(e) => patch({ primaryColor: e.target.value })}
            sx={{ flex: 1, px: 1.25, py: 0.75, fontSize: 'var(--text-md)', fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink)', bgcolor: 'var(--field)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', '&.Mui-focused': { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft)' } }}
          />
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
          {SWATCHES.map((c) => (
            <Box
              key={c}
              component="button"
              type="button"
              aria-label={`Couleur ${c}`}
              onClick={() => patch({ primaryColor: c })}
              sx={{
                width: 22, height: 22, borderRadius: '50%', bgcolor: c, cursor: 'pointer', p: 0,
                border: primary.toLowerCase() === c.toLowerCase() ? '2px solid var(--ink)' : '2px solid transparent',
                boxShadow: '0 0 0 1px var(--line)',
                '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
              }}
            />
          ))}
        </Box>
      </Box>

      <Box>
        <Box component="label" htmlFor="theme-font" sx={{ ...labelSx, display: 'block', mb: 0.75 }}>Police</Box>
        <Box
          component="select"
          id="theme-font"
          value={font}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => patch({ fontFamily: e.target.value })}
          sx={{
            width: '100%', px: 1.25, height: 36, fontSize: 'var(--text-md)', color: 'var(--ink)',
            bgcolor: 'var(--field)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)',
            appearance: 'none', cursor: 'pointer',
            backgroundImage: 'linear-gradient(45deg, transparent 50%, var(--muted) 50%), linear-gradient(135deg, var(--muted) 50%, transparent 50%)',
            backgroundPosition: 'calc(100% - 16px) 15px, calc(100% - 11px) 15px',
            backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat',
            '&:focus-visible': { borderColor: 'var(--accent)', outline: 'none', boxShadow: '0 0 0 3px var(--accent-soft)' },
          }}
        >
          {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
        </Box>
      </Box>

      <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--faint)', lineHeight: 1.5 }}>
        L’aperçu reflète la couleur en direct. Les polices web s’appliquent pleinement sur le site publié.
      </Box>
    </Box>
  );
}

const labelSx = {
  fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--body)',
} as const;
