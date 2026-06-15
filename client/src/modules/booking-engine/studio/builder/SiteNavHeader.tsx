import { Box } from '@mui/material';

/**
 * En-tête de navigation du site (miroir de la nav AUTO du SSR `SiteNav`). Rendu en tête du canvas
 * d'édition ET de l'aperçu pour que le Studio corresponde au site déployé. Inerte : la nav est
 * auto-générée depuis les pages (1 page = 1 entrée), donc non éditable comme un bloc.
 */

export interface PageNavItem {
  label: string;
  active: boolean;
}

export interface SiteNavHeaderProps {
  navItems: PageNavItem[];
  brandName?: string;
  logoUrl?: string | null;
  reserveLabel?: string;
}

export default function SiteNavHeader({ navItems, brandName, logoUrl, reserveLabel }: SiteNavHeaderProps) {
  if (!navItems.length) return null;
  return (
    <Box component="header" sx={{
      display: 'flex', alignItems: 'center', gap: 2, px: 3, py: 1.5,
      borderBottom: '1px solid var(--line)', bgcolor: 'var(--card)',
      position: 'sticky', top: 0, zIndex: 5,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mr: 'auto', minWidth: 0 }}>
        {logoUrl
          ? <Box component="img" src={logoUrl} alt={brandName || ''} sx={{ height: 26, width: 'auto', display: 'block' }} />
          : <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--ink)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>{brandName || 'Votre marque'}</Box>}
      </Box>
      <Box component="nav" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {navItems.map((it, i) => (
          <Box key={i} component="span" sx={{
            px: 1.25, py: 0.5, borderRadius: 'var(--radius-md)', fontSize: 14,
            fontWeight: it.active ? 600 : 500, color: it.active ? 'var(--accent)' : 'var(--muted)', whiteSpace: 'nowrap',
          }}>{it.label}</Box>
        ))}
        <Box component="span" sx={{
          ml: 1, px: 2, py: 0.6, borderRadius: 999, bgcolor: 'var(--accent)', color: 'var(--on-accent)',
          fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
        }}>{reserveLabel || 'Réserver'}</Box>
      </Box>
    </Box>
  );
}
