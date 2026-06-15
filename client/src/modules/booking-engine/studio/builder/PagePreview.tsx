import { Box } from '@mui/material';
import { renderBlock, visibilityClassName } from './blockRegistry';
import { FRAME_WIDTH, themeStyle, type CanvasTheme } from './BuilderCanvas';
import SiteNavHeader, { type PageNavItem } from './SiteNavHeader';
import type { BlockInstance } from './DesignBuilder';
import type { Breakpoint } from '../StudioShell';

/**
 * Rendu PROPRE de la page composée (sans chrome d'édition) via le registre de blocs.
 * Utilisé par le mode « Aperçu » du Studio ; conçu pour être réutilisé tel quel par le futur
 * rendu public (route hébergée), puisqu'il ne dépend que des blocs + du thème.
 *
 * En multi-page, un en-tête de navigation est rendu en tête (miroir de la nav AUTO du SSR `SiteNav`)
 * pour que l'aperçu corresponde au site déployé. Inerte (la nav est auto-générée depuis les pages).
 */

export type { PageNavItem };

export interface PagePreviewProps {
  blocks: BlockInstance[];
  theme?: CanvasTheme;
  breakpoint: Breakpoint;
  /** Items de nav (multi-page) — miroir de la nav auto du SSR. Vide = pas d'en-tête. */
  navItems?: PageNavItem[];
  brandName?: string;
  logoUrl?: string | null;
  reserveLabel?: string;
}

export default function PagePreview({ blocks, theme, breakpoint, navItems, brandName, logoUrl, reserveLabel }: PagePreviewProps) {
  const width = FRAME_WIDTH[breakpoint];
  const showNav = !!navItems && navItems.length > 0;

  return (
    <Box
      // Aperçu inerte : les ancres des blocs (ex. CTA → #reserver) ne naviguent pas dans le Studio.
      onClickCapture={(e) => { if ((e.target as HTMLElement).closest('a')) e.preventDefault(); }}
      sx={{ flex: 1, minWidth: 0, height: '100%', overflowY: 'auto', bgcolor: 'var(--bg-2, var(--bg))', display: 'flex', justifyContent: 'center', p: breakpoint === 'desktop' ? 0 : 3 }}>
      <Box
        style={themeStyle(theme)}
        sx={{
          width, maxWidth: '100%', minHeight: '100%', bgcolor: 'var(--card)',
          containerType: 'inline-size',
          ...(breakpoint !== 'desktop' && {
            my: 'auto', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
            border: '1px solid var(--line)', boxShadow: 'var(--shadow-card)', minHeight: 'auto',
          }),
        }}
      >
        {showNav ? (
          <SiteNavHeader navItems={navItems!} brandName={brandName} logoUrl={logoUrl} reserveLabel={reserveLabel} />
        ) : null}

        {blocks.length === 0 ? (
          <Box sx={{ minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--text-md)', p: 4 }}>
            Page vide — ajoutez des blocs en mode édition.
          </Box>
        ) : (
          blocks.map((b) => <Box key={b.id} className={visibilityClassName(b.props)}>{renderBlock(b, breakpoint)}</Box>)
        )}
      </Box>
    </Box>
  );
}
