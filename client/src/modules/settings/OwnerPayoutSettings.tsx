import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Snackbar,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  AccountBalance,
  Save,
  VerifiedUser,
  Warning,
  Edit as EditIcon,
  CheckCircle,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import {
  useAllOwnerPayoutConfigs,
  useUpdateSepaDetails,
  useVerifyOwnerConfig,
} from '../../hooks/useOwnerPayoutConfig';
import type { OwnerPayoutConfig, PayoutMethod } from '../../services/api/accountingApi';
import SettingsSection from './components/SettingsSection';

// ─── Constants ──────────────────────────────────────────────────────────────

const PAYOUT_METHOD_LABELS: Record<PayoutMethod, string> = {
  MANUAL: 'Manuel',
  STRIPE_CONNECT: 'Stripe Connect',
  SEPA_TRANSFER: 'Virement SEPA',
};

// Palette Clenzy tintée pour les chips de méthode
const PAYOUT_METHOD_COLORS: Record<PayoutMethod, string> = {
  MANUAL: '#8A8378',
  STRIPE_CONNECT: '#635BFF', // brand Stripe (preserved for recognizability)
  SEPA_TRANSFER: '#7BA3C2',
};

const CELL_SX = { fontSize: '0.8125rem', py: 1.25 } as const;
const HEAD_CELL_SX = {
  fontSize: '0.7rem',
  fontWeight: 700,
  py: 1,
  color: 'text.secondary',
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
} as const;

const IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

/** Estimated row height in px (py: 1.25 = 10px * 2 + ~21px content) */
const ROW_HEIGHT = 41;
/** Table header + pagination footer overhead */
const TABLE_OVERHEAD = 100;
/** Minimum rows per page */
const MIN_ROWS = 3;

// ─── Component ──────────────────────────────────────────────────────────────

export default function OwnerPayoutSettings() {
  const { t } = useTranslation();
  const { data: configs = [], isLoading } = useAllOwnerPayoutConfigs();
  const updateSepaMutation = useUpdateSepaDetails();
  const verifyMutation = useVerifyOwnerConfig();

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const containerRef = useRef<HTMLDivElement>(null);

  const computeRowsPerPage = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const availableHeight = window.innerHeight - rect.top;
    const rows = Math.max(MIN_ROWS, Math.floor((availableHeight - TABLE_OVERHEAD) / ROW_HEIGHT));
    setRowsPerPage(rows);
  }, []);

  useEffect(() => {
    computeRowsPerPage();
    window.addEventListener('resize', computeRowsPerPage);
    return () => window.removeEventListener('resize', computeRowsPerPage);
  }, [computeRowsPerPage]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(configs.length / rowsPerPage) - 1);
    if (page > maxPage) setPage(maxPage);
  }, [configs.length, rowsPerPage, page]);

  const paginatedConfigs = useMemo(
    () => configs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [configs, page, rowsPerPage],
  );

  // SEPA edit dialog
  const [sepaOpen, setSepaOpen] = useState(false);
  const [sepaTarget, setSepaTarget] = useState<OwnerPayoutConfig | null>(null);
  const [sepaIban, setSepaIban] = useState('');
  const [sepaBic, setSepaBic] = useState('');
  const [sepaHolder, setSepaHolder] = useState('');
  const [ibanError, setIbanError] = useState('');

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const openSepaDialog = (config: OwnerPayoutConfig) => {
    setSepaTarget(config);
    setSepaIban('');
    setSepaBic(config.bic ?? '');
    setSepaHolder(config.bankAccountHolder ?? '');
    setIbanError('');
    setSepaOpen(true);
  };

  const handleSaveSepa = async () => {
    if (!sepaTarget) return;
    const cleanIban = sepaIban.replace(/\s+/g, '').toUpperCase();
    if (!IBAN_REGEX.test(cleanIban)) {
      setIbanError(t('settings.ownerPayout.ibanInvalid', 'Format IBAN invalide'));
      return;
    }

    try {
      await updateSepaMutation.mutateAsync({
        ownerId: sepaTarget.ownerId,
        data: { iban: cleanIban, bic: sepaBic.trim(), bankAccountHolder: sepaHolder.trim() },
      });
      setSepaOpen(false);
      setSnackbar({ open: true, message: t('settings.ownerPayout.sepaSaved', 'Coordonnées SEPA enregistrées'), severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: t('settings.ownerPayout.sepaError', "Erreur lors de l'enregistrement"), severity: 'error' });
    }
  };

  const handleVerify = async (ownerId: number) => {
    try {
      await verifyMutation.mutateAsync(ownerId);
      setSnackbar({ open: true, message: t('settings.ownerPayout.verified', 'Configuration vérifiée'), severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: t('settings.ownerPayout.verifyError', 'Erreur lors de la vérification'), severity: 'error' });
    }
  };

  if (isLoading) {
    return (
      <SettingsSection
        title={t('settings.ownerPayout.title', 'Configuration des reversements propriétaires')}
        icon={AccountBalance}
        accent="accent"
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      </SettingsSection>
    );
  }

  return (
    <Box ref={containerRef}>
      <SettingsSection
        title={t('settings.ownerPayout.title', 'Configuration des reversements propriétaires')}
        icon={AccountBalance}
        accent="accent"
        description={t(
          'settings.ownerPayout.subtitle',
          'Configurez la méthode de paiement pour chaque propriétaire (Stripe Connect, virement SEPA ou manuel).',
        )}
      >
        {configs.length === 0 ? (
          <Box
            sx={{
              p: 4,
              borderRadius: '8px',
              border: '1px dashed',
              borderColor: 'divider',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#4A9B8E14',
                color: '#4A9B8E',
                border: '1px solid #4A9B8E33',
              }}
            >
              <AccountBalance size={22} strokeWidth={1.75} />
            </Box>
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', maxWidth: 480 }}>
              {t(
                'settings.ownerPayout.empty',
                'Aucune configuration trouvée. Les configurations sont créées automatiquement lors de la première génération de payout.',
              )}
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ overflowX: 'hidden' }}>
            <Table size="small" sx={{ width: '100%' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={HEAD_CELL_SX}>{t('settings.ownerPayout.col.owner', 'Propriétaire')}</TableCell>
                  <TableCell sx={HEAD_CELL_SX}>{t('settings.ownerPayout.col.method', 'Méthode')}</TableCell>
                  <TableCell sx={HEAD_CELL_SX}>{t('settings.ownerPayout.col.details', 'Détails')}</TableCell>
                  <TableCell sx={HEAD_CELL_SX} align="center">{t('settings.ownerPayout.col.status', 'Statut')}</TableCell>
                  <TableCell sx={{ ...HEAD_CELL_SX, pr: 1.25 }} align="right">{t('common.actions', 'Actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedConfigs.map((config) => {
                  const methodColor = PAYOUT_METHOD_COLORS[config.payoutMethod];
                  return (
                    <TableRow key={config.id} hover>
                      <TableCell sx={CELL_SX}>
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'text.primary' }}>
                          {t('settings.ownerPayout.ownerLabel', 'Propriétaire')} #{config.ownerId}
                        </Typography>
                      </TableCell>
                      <TableCell sx={CELL_SX}>
                        <Chip
                          label={PAYOUT_METHOD_LABELS[config.payoutMethod]}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            letterSpacing: '0.01em',
                            backgroundColor: `${methodColor}14`,
                            color: methodColor,
                            border: `1px solid ${methodColor}33`,
                            borderRadius: '6px',
                            '& .MuiChip-label': { px: 0.875 },
                          }}
                        />
                      </TableCell>
                      <TableCell sx={CELL_SX}>
                        {config.payoutMethod === 'SEPA_TRANSFER' && config.maskedIban && (
                          <Typography
                            component="span"
                            sx={{
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              fontVariantNumeric: 'tabular-nums',
                              color: 'text.primary',
                            }}
                          >
                            {config.maskedIban}
                            {config.bic ? ` / ${config.bic}` : ''}
                          </Typography>
                        )}
                        {config.payoutMethod === 'STRIPE_CONNECT' && (
                          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                            {config.stripeOnboardingComplete
                              ? t('settings.ownerPayout.stripeConnected', 'Compte connecté')
                              : t('settings.ownerPayout.stripeNotConnected', 'Onboarding en cours...')}
                          </Typography>
                        )}
                        {config.payoutMethod === 'MANUAL' && (
                          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                            {t('settings.ownerPayout.manualNote', 'Virement manuel')}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={CELL_SX} align="center">
                        {config.verified ? (
                          <Chip
                            icon={<VerifiedUser size={11} strokeWidth={2} />}
                            label={t('settings.ownerPayout.verifiedLabel', 'Vérifié')}
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              letterSpacing: '0.01em',
                              backgroundColor: '#4A9B8E14',
                              color: '#4A9B8E',
                              border: '1px solid #4A9B8E33',
                              borderRadius: '6px',
                              px: 0.25,
                              '& .MuiChip-icon': {
                                color: '#4A9B8E !important',
                                ml: '6px',
                                mr: '-2px',
                              },
                              '& .MuiChip-label': { px: 0.875 },
                            }}
                          />
                        ) : (
                          <Chip
                            icon={<Warning size={11} strokeWidth={2} />}
                            label={t('settings.ownerPayout.pendingLabel', 'En attente')}
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              letterSpacing: '0.01em',
                              backgroundColor: '#D4A57414',
                              color: '#D4A574',
                              border: '1px solid #D4A57433',
                              borderRadius: '6px',
                              px: 0.25,
                              '& .MuiChip-icon': {
                                color: '#D4A574 !important',
                                ml: '6px',
                                mr: '-2px',
                              },
                              '& .MuiChip-label': { px: 0.875 },
                            }}
                          />
                        )}
                      </TableCell>
                      <TableCell sx={{ ...CELL_SX, pr: 1.25 }} align="right">
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
                          {config.payoutMethod === 'SEPA_TRANSFER' && (
                            <Tooltip title={t('settings.ownerPayout.editSepa', 'Modifier SEPA')}>
                              <IconButton
                                size="small"
                                onClick={() => openSepaDialog(config)}
                                aria-label={t('settings.ownerPayout.editSepa', 'Modifier SEPA')}
                                sx={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: '7px',
                                  color: 'text.secondary',
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  transition:
                                    'border-color 150ms cubic-bezier(0.22, 1, 0.36, 1), background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), color 150ms cubic-bezier(0.22, 1, 0.36, 1)',
                                  '&:hover': {
                                    color: '#6B8A9A',
                                    borderColor: '#6B8A9A66',
                                    backgroundColor: '#6B8A9A0F',
                                  },
                                  '&:focus-visible': { outline: '2px solid #6B8A9A', outlineOffset: 2 },
                                }}
                              >
                                <EditIcon size={13} strokeWidth={1.75} />
                              </IconButton>
                            </Tooltip>
                          )}
                          {!config.verified && (
                            <Tooltip title={t('settings.ownerPayout.verify', 'Vérifier')}>
                              <IconButton
                                size="small"
                                onClick={() => handleVerify(config.ownerId)}
                                disabled={verifyMutation.isPending}
                                aria-label={t('settings.ownerPayout.verify', 'Vérifier')}
                                sx={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: '7px',
                                  color: 'text.secondary',
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  transition:
                                    'border-color 150ms cubic-bezier(0.22, 1, 0.36, 1), background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), color 150ms cubic-bezier(0.22, 1, 0.36, 1)',
                                  '&:hover': {
                                    color: '#4A9B8E',
                                    borderColor: '#4A9B8E66',
                                    backgroundColor: '#4A9B8E0F',
                                  },
                                  '&:focus-visible': { outline: '2px solid #4A9B8E', outlineOffset: 2 },
                                }}
                              >
                                <CheckCircle size={13} strokeWidth={1.75} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={configs.length}
              page={page}
              onPageChange={(_e, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[rowsPerPage]}
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
              sx={{
                borderTop: '1px solid',
                borderColor: 'divider',
                mt: 1,
                '& .MuiTablePagination-toolbar': { minHeight: 40, px: 0 },
                '& .MuiTablePagination-displayedRows': {
                  fontSize: '0.72rem',
                  color: 'text.secondary',
                  fontVariantNumeric: 'tabular-nums',
                },
                '& .MuiTablePagination-actions': { ml: 1 },
              }}
            />
          </TableContainer>
        )}
      </SettingsSection>

      {/* ── SEPA Edit Dialog ── */}
      <Dialog
        open={sepaOpen}
        onClose={() => setSepaOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ fontSize: '0.95rem', fontWeight: 700, letterSpacing: '-0.005em' }}>
          {t('settings.ownerPayout.editSepaTitle', 'Coordonnées bancaires SEPA')}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '16px !important' }}>
          <TextField
            label={t('settings.ownerPayout.iban', 'IBAN')}
            value={sepaIban}
            onChange={(e) => {
              setSepaIban(e.target.value);
              setIbanError('');
            }}
            error={!!ibanError}
            helperText={ibanError || (sepaTarget?.maskedIban ? `${t('settings.ownerPayout.current', 'Actuel')} : ${sepaTarget.maskedIban}` : '')}
            size="small"
            fullWidth
            InputProps={{
              sx: { fontFamily: 'monospace', fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' },
            }}
          />
          <TextField
            label={t('settings.ownerPayout.bic', 'BIC/SWIFT')}
            value={sepaBic}
            onChange={(e) => setSepaBic(e.target.value)}
            size="small"
            fullWidth
            InputProps={{
              sx: { fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em', textTransform: 'uppercase' },
            }}
          />
          <TextField
            label={t('settings.ownerPayout.holder', 'Titulaire du compte')}
            value={sepaHolder}
            onChange={(e) => setSepaHolder(e.target.value)}
            size="small"
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setSepaOpen(false)}
            size="small"
            sx={{
              textTransform: 'none',
              fontSize: '0.78rem',
              fontWeight: 600,
              borderRadius: '8px',
              color: 'text.secondary',
            }}
          >
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button
            variant="contained"
            disableElevation
            size="small"
            onClick={handleSaveSepa}
            disabled={updateSepaMutation.isPending || !sepaIban.trim() || !sepaHolder.trim()}
            startIcon={
              updateSepaMutation.isPending ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <Save size={14} strokeWidth={1.75} />
              )
            }
            sx={{
              textTransform: 'none',
              fontSize: '0.78rem',
              fontWeight: 600,
              letterSpacing: '0.01em',
              borderRadius: '8px',
              py: 0.625,
              px: 1.5,
              bgcolor: '#6B8A9A',
              boxShadow: 'none',
              '&:hover': { bgcolor: '#6B8A9A', filter: 'brightness(0.94)', boxShadow: 'none' },
              '&.Mui-disabled': { bgcolor: 'rgba(107, 138, 154, 0.32)', color: '#fff' },
            }}
          >
            {t('common.save', 'Enregistrer')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ borderRadius: '8px' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
