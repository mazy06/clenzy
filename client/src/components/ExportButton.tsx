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
} from '@mui/icons-material';
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

const BUTTON_SX = {
  textTransform: 'none',
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.01em',
  height: 28,
  px: 1.5,
  '& .MuiButton-startIcon': { mr: 0.5 },
  '& .MuiSvgIcon-root': { fontSize: 14 },
} as const;

const MENU_ITEM_SX = {
  fontSize: '0.8125rem',
  py: 0.5,
  minHeight: 32,
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
      <Alert onClose={() => setSnackbarOpen(false)} severity="success" variant="filled" sx={{ width: '100%', fontSize: '0.75rem' }}>
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
              color="primary"
              sx={{ '& .MuiSvgIcon-root': { fontSize: 16 } }}
            >
              <DownloadIcon />
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
              startIcon={<DownloadIcon />}
              onClick={handleMenuOpen}
              disabled={isDisabled}
              sx={BUTTON_SX}
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
                <CsvIcon sx={{ fontSize: 16 }} />
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
            startIcon={<DownloadIcon />}
            onClick={handleExportCSV}
            disabled={isDisabled}
            sx={BUTTON_SX}
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
