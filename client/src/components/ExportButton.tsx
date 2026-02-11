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
  data: any[];
  columns: ExportColumn[];
  fileName: string;
  disabled?: boolean;
  variant?: 'button' | 'icon' | 'menu';
  formats?: ('csv')[];
  onExport?: () => void;
}

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
            >
              <DownloadIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={3000}
          onClose={() => setSnackbarOpen(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setSnackbarOpen(false)} severity="success" variant="filled" sx={{ width: '100%' }}>
            {t('export.success')}
          </Alert>
        </Snackbar>
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
              sx={{ textTransform: 'none' }}
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
            <MenuItem onClick={handleExportCSV}>
              <ListItemIcon>
                <CsvIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t('export.csv')}</ListItemText>
            </MenuItem>
          )}
        </Menu>
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={3000}
          onClose={() => setSnackbarOpen(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setSnackbarOpen(false)} severity="success" variant="filled" sx={{ width: '100%' }}>
            {t('export.success')}
          </Alert>
        </Snackbar>
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
            sx={{ textTransform: 'none' }}
          >
            {t('export.button')}
          </Button>
        </span>
      </Tooltip>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="success" variant="filled" sx={{ width: '100%' }}>
          {t('export.success')}
        </Alert>
      </Snackbar>
    </>
  );
}
