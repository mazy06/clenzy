import React, { useState, useCallback } from 'react';
import {
  Box, Grid, Paper, Typography, Chip, IconButton, Tooltip, Switch,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button,
  Skeleton, Alert, alpha,
} from '@mui/material';
import {
  Edit, Delete, VpnKey, ContentCopy, Add, Language, Payments,
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import {
  useBookingEngineConfigs,
  useDeleteBookingEngineConfig,
  useToggleBookingEngine,
} from '../../hooks/useBookingEngineConfig';
import type { BookingEngineConfig } from '../../services/api/bookingEngineApi';

// ─── Types ──────────────────────────────────────────────────────────────────

interface BookingEngineListTabProps {
  onEdit: (config: BookingEngineConfig) => void;
  onCreate: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

const BookingEngineListTab: React.FC<BookingEngineListTabProps> = React.memo(
  ({ onEdit, onCreate }) => {
    const { t } = useTranslation();
    const { data: configs, isLoading, error } = useBookingEngineConfigs();
    const deleteMutation = useDeleteBookingEngineConfig();
    const toggleMutation = useToggleBookingEngine();

    const [deleteTarget, setDeleteTarget] = useState<BookingEngineConfig | null>(null);

    const handleToggle = useCallback(
      (config: BookingEngineConfig) => {
        toggleMutation.mutate({ id: config.id, enabled: !config.enabled });
      },
      [toggleMutation]
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
      navigator.clipboard.writeText(apiKey).catch(() => {
        // Fallback silencieux — certains navigateurs bloquent clipboard en contexte non-securise
      });
    }, []);

    // Loading
    if (isLoading) {
      return (
        <Grid container spacing={2.5}>
          {[1, 2].map((i) => (
            <Grid item xs={12} sm={6} key={i}>
              <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 3 }} />
            </Grid>
          ))}
        </Grid>
      );
    }

    // Error
    if (error) {
      return <Alert severity="error">{t('bookingEngine.messages.error')}</Alert>;
    }

    // Empty state
    if (!configs || configs.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: 'primary.50',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
            }}
          >
            <VpnKey sx={{ fontSize: 36, color: 'primary.main' }} />
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
        <Grid container spacing={2.5}>
          {configs.map((config) => {
            const color = config.primaryColor || '#2563eb';
            return (
              <Grid item xs={12} sm={6} key={config.id}>
                <Paper
                  variant="outlined"
                  sx={{
                    borderRadius: 3,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                    '&:hover': {
                      boxShadow: 4,
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  {/* ── Color banner ──────────────────────────────────── */}
                  <Box
                    sx={{
                      height: 6,
                      background: `linear-gradient(90deg, ${color}, ${alpha(color, 0.5)})`,
                    }}
                  />

                  {/* ── Body ─────────────────────────────────────────── */}
                  <Box sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column' }}>

                    {/* Header: name + status */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: 1.5,
                            bgcolor: color,
                            flexShrink: 0,
                            boxShadow: `0 2px 8px ${alpha(color, 0.4)}`,
                          }}
                        />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.9375rem',
                              lineHeight: 1.3,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {config.name}
                          </Typography>
                          {config.fontFamily && (
                            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.25 }}>
                              {config.fontFamily}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      <Chip
                        size="small"
                        label={config.enabled ? t('bookingEngine.status.active') : t('bookingEngine.status.inactive')}
                        color={config.enabled ? 'success' : 'default'}
                        sx={{ fontSize: '0.75rem', height: 24, fontWeight: 600 }}
                      />
                    </Box>

                    {/* Info rows */}
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.25, mb: 2 }}>
                      {/* API Key */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          px: 1.5,
                          py: 0.75,
                          borderRadius: 1.5,
                          bgcolor: (theme) => alpha(theme.palette.text.primary, 0.04),
                        }}
                      >
                        <VpnKey sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography
                          sx={{
                            fontSize: '0.75rem',
                            color: 'text.secondary',
                            fontFamily: 'monospace',
                            letterSpacing: '0.02em',
                            flex: 1,
                          }}
                        >
                          {config.apiKey.substring(0, 12)}...
                        </Typography>
                        <Tooltip title={t('bookingEngine.fields.copyKey')}>
                          <IconButton
                            size="small"
                            onClick={() => handleCopyKey(config.apiKey)}
                            sx={{ p: 0.5 }}
                          >
                            <ContentCopy sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>

                      {/* Language & Currency */}
                      <Box sx={{ display: 'flex', gap: 1.5, px: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Language sx={{ fontSize: 14, color: 'text.secondary' }} />
                          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 500 }}>
                            {config.defaultLanguage.toUpperCase()}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Payments sx={{ fontSize: 14, color: 'text.secondary' }} />
                          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 500 }}>
                            {config.defaultCurrency}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    {/* Actions bar */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        pt: 1.5,
                        borderTop: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Switch
                        checked={config.enabled}
                        onChange={() => handleToggle(config)}
                        size="small"
                        color="success"
                        disabled={toggleMutation.isPending}
                      />
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title={t('bookingEngine.actions.editTemplate')}>
                          <IconButton
                            size="small"
                            onClick={() => onEdit(config)}
                            sx={{
                              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                              '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.16) },
                            }}
                          >
                            <Edit sx={{ fontSize: 16, color: 'primary.main' }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('bookingEngine.actions.deleteTemplate')}>
                          <IconButton
                            size="small"
                            onClick={() => setDeleteTarget(config)}
                            sx={{
                              bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
                              '&:hover': { bgcolor: (theme) => alpha(theme.palette.error.main, 0.16) },
                            }}
                          >
                            <Delete sx={{ fontSize: 16, color: 'error.main' }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>

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
            <Button
              onClick={handleDelete}
              color="error"
              variant="contained"
              disabled={deleteMutation.isPending}
            >
              {t('common.delete')}
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }
);

BookingEngineListTab.displayName = 'BookingEngineListTab';

export default BookingEngineListTab;
