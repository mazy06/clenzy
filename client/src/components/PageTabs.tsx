import React from 'react';
import { Box, Paper, Tabs, Tab, Badge } from '@mui/material';
import { useIconSize } from '../hooks/useResponsiveSize';

/**
 * Description d'un onglet pour PageTabs.
 *
 * Si `value` est omis, l'index dans le tableau d'options est utilisé.
 * `hidden` permet de gérer le filtrage par permissions sans React.Fragment.
 */
export interface PageTabItem<T extends string | number = number> {
  value?: T;
  label: string;
  icon?: React.ReactNode;
  /** Compteur affiché en badge à droite du label (notifications, demandes en attente, etc.). */
  badge?: number;
  badgeColor?: 'error' | 'warning' | 'primary' | 'info' | 'success';
  /** Hide la tab (permission gating). */
  hidden?: boolean;
  /** Désactiver la tab sans la masquer. */
  disabled?: boolean;
}

interface PageTabsProps<T extends string | number> {
  options: PageTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Slot rendu à droite des tabs (boutons d'action, filtres, etc.). */
  inlineActions?: React.ReactNode;
  /**
   * Densité :
   *   - 'comfortable' (default) — minHeight 38px, fontSize 0.75rem (style PropertiesPage)
   *   - 'compact' — minHeight 30px, fontSize 0.6875rem (style filter tabs)
   */
  size?: 'comfortable' | 'compact';
  /** Wrap dans `<Paper>`. Default true. False = box transparent (filter tabs autonomes). */
  paper?: boolean;
  /** Margin bottom sur le wrapper. Default 1.5 (12px). */
  mb?: number;
  /** ARIA label pour Tabs. */
  ariaLabel?: string;
}

/**
 * Composant de tabs standardisé pour le PMS.
 *
 * Visuellement aligné sur le pattern de PropertiesPage :
 *   - Conteneur `<Paper>` (option) avec borderBottom divider
 *   - Tabs scrollable + scrollButtons auto
 *   - Tab icon à gauche (start), label sans uppercase
 *   - Slot inline à droite pour actions contextuelles
 *
 * Les icônes passées dans `icon` sont automatiquement redimensionnées via
 * `useIconSize('section')` pour rester cohérentes avec le PMS.
 *
 * @example
 * ```tsx
 * <PageTabs
 *   options={[
 *     { value: 'properties', label: 'Propriétés', icon: <Home /> },
 *     { value: 'pricing',    label: 'Prix dynamique', icon: <TrendingUp /> },
 *   ]}
 *   value={activeTab}
 *   onChange={setActiveTab}
 *   inlineActions={<Button size="small">Action</Button>}
 * />
 * ```
 */
export default function PageTabs<T extends string | number = number>({
  options,
  value,
  onChange,
  inlineActions,
  size = 'comfortable',
  paper = true,
  mb = 1.5,
  ariaLabel,
}: PageTabsProps<T>) {
  const sectionIconSize = useIconSize('section');
  const compact = size === 'compact';
  const minHeight = compact ? 30 : 38;
  const fontSize = compact ? '0.6875rem' : '0.75rem';
  const xlFontSize = compact ? '0.75rem' : '0.8125rem';

  const visibleOptions = options.filter((o) => !o.hidden);

  const tabsRow = (
    <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
      <Tabs
        value={value}
        onChange={(_, v) => onChange(v as T)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label={ariaLabel}
        sx={{
          flex: 1,
          minHeight,
          '& .MuiTabs-flexContainer': { gap: 0.25 },
          '& .MuiTab-root': {
            minHeight,
            textTransform: 'none',
            fontSize,
            '@media (min-width:1536px)': { fontSize: xlFontSize },
            fontWeight: 600,
            py: compact ? 0.25 : 0.5,
            px: compact ? 1 : 1.5,
            gap: 0.5,
            '& .MuiTab-iconWrapper': {
              marginBottom: 0,
              marginRight: 0.5,
            },
          },
        }}
      >
        {visibleOptions.map((opt, idx) => {
          const tabValue = (opt.value !== undefined ? opt.value : idx) as T;

          // Inject responsive size into lucide-style icons.
          const iconNode = opt.icon && React.isValidElement(opt.icon)
            ? React.cloneElement(opt.icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
                size: sectionIconSize,
                strokeWidth: 1.75,
              })
            : opt.icon;

          // Label with optional badge.
          const labelNode = opt.badge != null && opt.badge > 0
            ? (
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                <span>{opt.label}</span>
                <Badge
                  badgeContent={opt.badge}
                  color={opt.badgeColor ?? 'error'}
                  max={99}
                  sx={{
                    '& .MuiBadge-badge': {
                      position: 'static',
                      transform: 'none',
                      fontSize: '0.5625rem',
                      height: 14,
                      minWidth: 14,
                      padding: '0 4px',
                    },
                  }}
                />
              </Box>
            )
            : opt.label;

          return (
            <Tab
              key={String(tabValue)}
              value={tabValue}
              icon={iconNode as React.ReactElement | undefined}
              iconPosition="start"
              label={labelNode}
              disabled={opt.disabled}
            />
          );
        })}
      </Tabs>
      {inlineActions && (
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1, pr: 1.25 }}>
          {inlineActions}
        </Box>
      )}
    </Box>
  );

  if (paper) {
    return <Paper sx={{ mb }} variant="outlined">{tabsRow}</Paper>;
  }
  return <Box sx={{ mb }}>{tabsRow}</Box>;
}
