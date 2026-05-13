import React, { useState, useCallback } from 'react';
import {
  Box, Typography, IconButton, Tooltip, Switch,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button,
  Skeleton, Alert, alpha,
} from '@mui/material';
import { Edit, Delete, VpnKey, ContentCopy, Add } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import {
  useBookingEngineConfigs,
  useAllBookingEngineConfigs,
  useDeleteBookingEngineConfig,
  useToggleBookingEngine,
} from '../../hooks/useBookingEngineConfig';
import type { BookingEngineConfig } from '../../services/api/bookingEngineApi';

interface BookingEngineListTabProps {
  onEdit: (config: BookingEngineConfig) => void;
  onCreate: () => void;
}

const BookingEngineListTab: React.FC<BookingEngineListTabProps> = React.memo(
  ({ onEdit, onCreate }) => {
    const { t } = useTranslation();
    const { isPlatformStaff } = useAuth();
    const showAllOrgs = isPlatformStaff();

    const orgQuery = useBookingEngineConfigs();
    const allQuery = useAllBookingEngineConfigs();
    const activeQuery = showAllOrgs ? allQuery : orgQuery;

    const configs = activeQuery.data;
    const isLoading = activeQuery.isLoading;
    const error = activeQuery.error;

    const deleteMutation = useDeleteBookingEngineConfig();
    const toggleMutation = useToggleBookingEngine();
    const [deleteTarget, setDeleteTarget] = useState<BookingEngineConfig | null>(null);

    const handleToggle = useCallback(
      (config: BookingEngineConfig) => {
        toggleMutation.mutate({ id: config.id, enabled: !config.enabled });
      },
      [toggleMutation],
    );

    const handleDelete = useCallback(async () => {
      if (!deleteTarget) return;
      try {
        await deleteMutation.mutateAsync(deleteTarget.id);
      } finally {
        setDeleteTarget(null);
      }
    }, [deleteTarget, deleteMutation]);

    const handleCopyKey = useCallback((apiKey: string) => {
      navigator.clipboard.writeText(apiKey).catch(() => {});
    }, []);

    // Loading
    if (isLoading) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 1 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
          ))}
        </Box>
      );
    }

    // Error
    if (error) {
      return <Alert severity="error" sx={{ mt: 1 }}>{t('bookingEngine.messages.error')}</Alert>;
    }

    // Empty state
    if (!configs || configs.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Box sx={{
            width: 64, height: 64, borderRadius: '50%', bgcolor: 'primary.50',
            display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2,
          }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><VpnKey size={28} strokeWidth={1.75} /></Box>
          </Box>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            {t('bookingEngine.list.empty')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t('bookingEngine.list.emptyDescription')}
          </Typography>
          <Button variant="contained" startIcon={<Add />} onClick={onCreate} sx={{ textTransform: 'none' }}>
            {t('bookingEngine.actions.newTemplate')}
          </Button>
        </Box>
      );
    }

    return (
      <>
        <TableContainer sx={{ mt: 1 }}>
          <Table size="small" sx={{
            '& .MuiTableCell-root': { borderColor: (theme) => alpha(theme.palette.divider, 0.6), py: 1.25 },
            '& .MuiTableRow-root:hover': { bgcolor: (theme) => alpha(theme.palette.action.hover, 0.04) },
          }}>
            <TableHead>
              <TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' } }}>
                <TableCell>{t('bookingEngine.fields.name', 'Nom')}</TableCell>
                {showAllOrgs && <TableCell>{t('bookingEngine.fields.organization', 'Organisation')}</TableCell>}
                <TableCell align="center">{t('bookingEngine.fields.primaryColor', 'Couleur')}</TableCell>
                <TableCell>{t('bookingEngine.fields.defaultLanguage', 'Langue')}</TableCell>
                <TableCell>{t('bookingEngine.fields.apiKey', 'Clé API')}</TableCell>
                <TableCell align="center">{t('bookingEngine.fields.status', 'Statut')}</TableCell>
                <TableCell align="right">{t('bookingEngine.fields.actions', 'Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {configs.map((config) => (
                <TableRow key={config.id} sx={{ cursor: 'pointer' }} onClick={() => onEdit(config)}>
                  {/* Name */}
                  <TableCell>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{config.name}</Typography>
                    {config.fontFamily && (
                      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{config.fontFamily}</Typography>
                    )}
                  </TableCell>

                  {/* Organization (platform staff only) */}
                  {showAllOrgs && (
                    <TableCell>
                      <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                        {config.organizationName || `Org #${config.organizationId}`}
                      </Typography>
                    </TableCell>
                  )}

                  {/* Color dot */}
                  <TableCell align="center">
                    <Box sx={{
                      width: 16, height: 16, borderRadius: '50%', mx: 'auto',
                      bgcolor: config.primaryColor || '#2563eb',
                      border: '1px solid', borderColor: (theme) => alpha(theme.palette.divider, 0.3),
                    }} />
                  </TableCell>

                  {/* Language */}
                  <TableCell>
                    <Typography sx={{ fontSize: '0.8125rem' }}>{config.defaultLanguage.toUpperCase()}</Typography>
                  </TableCell>

                  {/* API Key */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'text.secondary' }}>
                        {config.apiKey.substring(0, 8)}...
                      </Typography>
                      <Tooltip title={t('bookingEngine.fields.copyKey')}>
                        <IconButton size="small" onClick={() => handleCopyKey(config.apiKey)} sx={{ p: 0.25 }}>
                          <ContentCopy size={12} strokeWidth={1.75} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>

                  {/* Status */}
                  <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={config.enabled}
                      onChange={() => handleToggle(config)}
                      size="small"
                      color="success"
                      disabled={toggleMutation.isPending}
                    />
                  </TableCell>

                  {/* Actions */}
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                      <Tooltip title={t('bookingEngine.actions.editTemplate')}>
                        <IconButton size="small" onClick={() => onEdit(config)}>
                          <Edit size={16} strokeWidth={1.75} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('bookingEngine.actions.deleteTemplate')}>
                        <IconButton size="small" onClick={() => setDeleteTarget(config)} color="error">
                          <Delete size={16} strokeWidth={1.75} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Delete confirmation dialog */}
        <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs">
          <DialogTitle>{t('bookingEngine.actions.deleteTemplate')}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {t('bookingEngine.actions.deleteConfirm', { name: deleteTarget?.name ?? '' })}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleDelete} color="error" variant="contained" disabled={deleteMutation.isPending}>
              {t('common.delete')}
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  },
);

BookingEngineListTab.displayName = 'BookingEngineListTab';

export default BookingEngineListTab;
