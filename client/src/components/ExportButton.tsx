import React, { useState } from 'react';
import {
  Button,
  IconButton,
  Menu,
  MenuItem,
  Snackbar,
  Alert,
  Tooltip,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Description as CsvIcon,
} from '../icons';
import { exportToCSV, type ExportColumn } from '../utils/exportUtils';
import { useTranslation } from '../hooks/useTranslation';

interface ExportButtonProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
  columns: ExportColumn[];
  fileName: string;
  disabled?: boolean;
  variant?: 'button' | 'icon' | 'menu';
  formats?: ('csv')[];
  onExport?: () => void;
}

// ─── Stable sx constants ────────────────────────────────────────────────────

const MENU_ITEM_SX = {
  fontSize: '12.5px',
  py: 0.5,
  minHeight: 32,
} as const;

// Snackbar succès — alerte -soft hairline flottante (fond opaque + couche ok-soft)
const SNACKBAR_ALERT_SX = {
  width: '100%',
  fontSize: '12.5px',
  bgcolor: 'var(--card)',
  backgroundImage: 'linear-gradient(var(--ok-soft), var(--ok-soft))',
  border: '1px solid color-mix(in srgb, var(--ok) 30%, transparent)',
  borderRadius: '12px',
  color: 'var(--body)',
  boxShadow: 'var(--shadow-pop)',
  '& .MuiAlert-icon': { color: 'var(--ok)' },
} as const;

export default function ExportButton({
  data,
  columns,
  fileName,
  disabled = false,
  variant = 'button',
  formats = ['csv'],
  onExport,
}: ExportButtonProps) {
  const { t } = useTranslation();
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const isDataEmpty = !data || data.length === 0;
  const isDisabled = disabled || isDataEmpty;

  const handleExportCSV = () => {
    exportToCSV(data, columns, fileName);
    setSnackbarOpen(true);
    setMenuAnchorEl(null);
    onExport?.();
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const tooltipTitle = isDataEmpty ? t('export.noData') : '';

  const snackbarElement = (
    <Snackbar
      open={snackbarOpen}
      autoHideDuration={3000}
      onClose={() => setSnackbarOpen(false)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert onClose={() => setSnackbarOpen(false)} severity="success" sx={SNACKBAR_ALERT_SX}>
        {t('export.success')}
      </Alert>
    </Snackbar>
  );

  if (variant === 'icon') {
    return (
      <>
        <Tooltip title={isDataEmpty ? t('export.noData') : t('export.button')}>
          <span>
            <IconButton
              onClick={handleExportCSV}
              disabled={isDisabled}
              size="small"
              sx={{
                p: 0.5,
                borderRadius: '9px',
                border: '1px solid var(--line-2)',
                color: 'var(--muted)',
                '&:hover': { bgcolor: 'var(--hover)', borderColor: 'var(--faint)', color: 'var(--ink)' },
                '&.Mui-disabled': { opacity: 0.45 },
              }}
            >
              <DownloadIcon size={16} strokeWidth={1.75} />
            </IconButton>
          </span>
        </Tooltip>
        {snackbarElement}
      </>
    );
  }

  if (variant === 'menu') {
    return (
      <>
        <Tooltip title={tooltipTitle}>
          <span>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon size={13} strokeWidth={1.75} />}
              onClick={handleMenuOpen}
              disabled={isDisabled}
            >
              {t('export.button')}
            </Button>
          </span>
        </Tooltip>
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleMenuClose}
        >
          {formats.includes('csv') && (
            <MenuItem onClick={handleExportCSV} sx={MENU_ITEM_SX}>
              <ListItemIcon>
                <CsvIcon size={16} strokeWidth={1.75} />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: '0.8125rem' }}>{t('export.csv')}</ListItemText>
            </MenuItem>
          )}
        </Menu>
        {snackbarElement}
      </>
    );
  }

  // Default: variant === 'button'
  return (
    <>
      <Tooltip title={tooltipTitle}>
        <span>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon size={13} strokeWidth={1.75} />}
            onClick={handleExportCSV}
            disabled={isDisabled}
            title={t('export.button')}
          >
            {t('export.button')}
          </Button>
        </span>
      </Tooltip>
      {snackbarElement}
    </>
  );
}
