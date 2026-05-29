import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { Add, Edit, Pause, PlayArrow as Play, Refresh, Delete as Trash } from '../../icons';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import {
  useBookingVouchersList,
  useDeleteBookingVoucher,
  usePauseBookingVoucher,
  useResumeBookingVoucher,
} from '../../hooks/useBookingVouchers';
import type {
  BookingVoucher,
  VoucherDiscountType,
  VoucherStatus,
} from '../../services/api/bookingVouchersApi';
import { softChipSx } from '../../utils/statusUtils';
import VoucherAnalyticsPanel from './VoucherAnalyticsPanel';
import VoucherEditorDialog from './VoucherEditorDialog';

// ─── Palette Baitly (alignee sur les autres surfaces) ───────────────────────

const ACCENT_TEAL = '#4A9B8E';
const WARM = '#D4A574';
const SOFT_BLUE = '#7BA3C2';
const NEUTRAL = '#8A8378';
const DANGER_SOFT = '#C97A7A';

/** Map status → couleur de chip (semantique : active=teal, pause=warm, draft=blue, expired=neutral). */
const STATUS_COLOR: Record<VoucherStatus, string> = {
  ACTIVE: ACCENT_TEAL,
  PAUSED: WARM,
  DRAFT: SOFT_BLUE,
  EXPIRED: NEUTRAL,
};

type FilterMode = 'all' | VoucherStatus;

/**
 * Page de gestion des {@link BookingVoucher} pour l'org courante.
 *
 * <h3>Architecture</h3>
 * Pattern table + dialog d'edition mutuelle (create/update). Le statut
 * controle visuellement la disponibilite (chips colores). Les pause/resume
 * sont des actions inline rapides (raccourci sans full edit).
 */
export default function VouchersPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterMode>('all');
  const [editing, setEditing] = useState<BookingVoucher | null>(null);
  const [creating, setCreating] = useState(false);
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  const statusFilter = filter === 'all' ? undefined : filter;
  const { data: vouchers = [], isLoading, error, refetch } = useBookingVouchersList(statusFilter);

  const pauseMutation = usePauseBookingVoucher();
  const resumeMutation = useResumeBookingVoucher();
  const deleteMutation = useDeleteBookingVoucher();

  const sortedVouchers = useMemo(() => {
    // ACTIVE en premier (operationnel), puis DRAFT, PAUSED, EXPIRED en dernier.
    const statusOrder: Record<VoucherStatus, number> = {
      ACTIVE: 0, DRAFT: 1, PAUSED: 2, EXPIRED: 3,
    };
    return [...vouchers].sort((a, b) => {
      const so = statusOrder[a.status] - statusOrder[b.status];
      if (so !== 0) return so;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [vouchers]);

  const handlePause = async (v: BookingVoucher) => {
    try {
      await pauseMutation.mutateAsync(v.id);
      setSnackbar({ msg: t('vouchers.pauseSuccess'), severity: 'success' });
    } catch (e: any) {
      setSnackbar({ msg: e?.message ?? t('vouchers.pauseError'), severity: 'error' });
    }
  };

  const handleResume = async (v: BookingVoucher) => {
    try {
      await resumeMutation.mutateAsync(v.id);
      setSnackbar({ msg: t('vouchers.resumeSuccess'), severity: 'success' });
    } catch (e: any) {
      setSnackbar({ msg: e?.message ?? t('vouchers.resumeError'), severity: 'error' });
    }
  };

  const handleDelete = async (v: BookingVoucher) => {
    if (v.usageCount > 0) {
      setSnackbar({
        msg: t('vouchers.deleteRefusedUsed', { count: v.usageCount }),
        severity: 'error',
      });
      return;
    }
    if (!window.confirm(t('vouchers.deleteConfirm', { name: v.name }))) return;
    try {
      await deleteMutation.mutateAsync(v.id);
      setSnackbar({ msg: t('vouchers.deleteSuccess'), severity: 'success' });
    } catch (e: any) {
      setSnackbar({ msg: e?.message ?? t('vouchers.deleteError'), severity: 'error' });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title={t('vouchers.title')}
        subtitle={t('vouchers.subtitle')}
        actions={
          <Stack direction="row" spacing={1}>
            <Tooltip title={t('common.refresh')}>
              <IconButton onClick={() => refetch()} size="small" sx={{ cursor: 'pointer' }}>
                <Refresh size={18} strokeWidth={1.75} />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              size="small"
              startIcon={<Add size={16} strokeWidth={2} />}
              onClick={() => setCreating(true)}
              sx={{
                bgcolor: ACCENT_TEAL,
                textTransform: 'none',
                '&:hover': { bgcolor: '#3d8276' },
              }}
            >
              {t('vouchers.createButton')}
            </Button>
          </Stack>
        }
      />

      <VoucherAnalyticsPanel />

      <ToggleButtonGroup
        value={filter}
        exclusive
        onChange={(_, v) => v && setFilter(v)}
        size="small"
        sx={{ mb: 2 }}
      >
        <ToggleButton value="all">{t('vouchers.filter.all')}</ToggleButton>
        <ToggleButton value="ACTIVE">{t('vouchers.filter.active')}</ToggleButton>
        <ToggleButton value="DRAFT">{t('vouchers.filter.draft')}</ToggleButton>
        <ToggleButton value="PAUSED">{t('vouchers.filter.paused')}</ToggleButton>
        <ToggleButton value="EXPIRED">{t('vouchers.filter.expired')}</ToggleButton>
      </ToggleButtonGroup>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('vouchers.loadError')}
        </Alert>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
          <CircularProgress />
        </Box>
      ) : sortedVouchers.length === 0 ? (
        <Alert severity="info">{t('vouchers.empty')}</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('vouchers.table.name')}</TableCell>
                <TableCell>{t('vouchers.table.code')}</TableCell>
                <TableCell>{t('vouchers.table.type')}</TableCell>
                <TableCell>{t('vouchers.table.discount')}</TableCell>
                <TableCell>{t('vouchers.table.validity')}</TableCell>
                <TableCell align="center">{t('vouchers.table.usage')}</TableCell>
                <TableCell align="center">{t('vouchers.table.status')}</TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedVouchers.map((v) => (
                <VoucherRow
                  key={v.id}
                  voucher={v}
                  onEdit={() => setEditing(v)}
                  onPause={() => handlePause(v)}
                  onResume={() => handleResume(v)}
                  onDelete={() => handleDelete(v)}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {(creating || editing) && (
        <VoucherEditorDialog
          voucher={editing}
          open={true}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            setSnackbar({ msg: t('vouchers.saveSuccess'), severity: 'success' });
          }}
        />
      )}

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbar ? (
          <Alert severity={snackbar.severity} onClose={() => setSnackbar(null)}>
            {snackbar.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}

// ─── Row component ───────────────────────────────────────────────────────────

interface RowProps {
  voucher: BookingVoucher;
  onEdit: () => void;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
}

const VoucherRow: React.FC<RowProps> = ({ voucher, onEdit, onPause, onResume, onDelete }) => {
  const { t } = useTranslation();
  const formatDiscount = makeFormatDiscount(t);
  const v = voucher;
  const isAuto = v.type === 'AUTO_CAMPAIGN';
  const canPause = v.status === 'ACTIVE';
  const canResume = v.status === 'PAUSED';
  const canDelete = v.usageCount === 0;

  return (
    <TableRow hover>
      <TableCell>
        <Stack spacing={0.25}>
          <Typography variant="body2" fontWeight={600}>{v.name}</Typography>
          {v.description && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              {v.description.slice(0, 80)}{v.description.length > 80 ? '…' : ''}
            </Typography>
          )}
        </Stack>
      </TableCell>
      <TableCell>
        {v.code ? (
          <Typography variant="body2" sx={{ fontFamily: 'monospace', letterSpacing: 0.5 }}>
            {v.code}
          </Typography>
        ) : (
          <Chip label={t('vouchers.autoCampaign')} size="small" sx={softChipSx(SOFT_BLUE)} />
        )}
      </TableCell>
      <TableCell>
        <Chip
          label={isAuto ? t('vouchers.typeAuto') : t('vouchers.typeManual')}
          size="small"
          variant="outlined"
          sx={softChipSx(isAuto ? SOFT_BLUE : NEUTRAL)}
        />
      </TableCell>
      <TableCell>
        <Typography variant="body2" fontWeight={500}>
          {formatDiscount(v.discountType, v.discountValue)}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="caption" color="text.secondary">
          {formatValidity(v.validFrom, v.validUntil)}
        </Typography>
      </TableCell>
      <TableCell align="center">
        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {v.usageCount}
          {v.maxUsesTotal !== null && (
            <Typography component="span" variant="caption" color="text.secondary"> / {v.maxUsesTotal}</Typography>
          )}
        </Typography>
      </TableCell>
      <TableCell align="center">
        <Chip
          label={t(`vouchers.status.${v.status}`)}
          size="small"
          sx={softChipSx(STATUS_COLOR[v.status])}
        />
      </TableCell>
      <TableCell align="right">
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          {canPause && (
            <Tooltip title={t('vouchers.pause')} arrow>
              <IconButton size="small" onClick={onPause} sx={{ cursor: 'pointer' }}>
                <Pause size={16} strokeWidth={1.75} />
              </IconButton>
            </Tooltip>
          )}
          {canResume && (
            <Tooltip title={t('vouchers.resume')} arrow>
              <IconButton size="small" onClick={onResume} sx={{ cursor: 'pointer' }}>
                <Play size={16} strokeWidth={1.75} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={t('common.edit')} arrow>
            <IconButton size="small" onClick={onEdit} sx={{ cursor: 'pointer', '&:hover': { color: ACCENT_TEAL } }}>
              <Edit size={16} strokeWidth={1.75} />
            </IconButton>
          </Tooltip>
          {canDelete && (
            <Tooltip title={t('common.delete')} arrow>
              <IconButton size="small" onClick={onDelete} sx={{ cursor: 'pointer', '&:hover': { color: DANGER_SOFT } }}>
                <Trash size={16} strokeWidth={1.75} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </TableCell>
    </TableRow>
  );
};

// ─── Format helpers ──────────────────────────────────────────────────────────

/**
 * Format helper pour le discount selon le type. Le mot "nuit/nuits" passe par
 * une closure i18n pour eviter le hardcode FR (fix M4 review).
 */
function makeFormatDiscount(t: (key: string, opts?: object) => string) {
  return (type: VoucherDiscountType, value: string): string => {
    const n = Number(value);
    if (type === 'PERCENTAGE') return `−${n}%`;
    if (type === 'FIXED_AMOUNT') return `−${n.toFixed(2).replace('.', ',')} €`;
    // FREE_NIGHTS : la pluralisation est gerée par i18n
    return `−${n} ${t('vouchers.editor.nights', { count: n })}`;
  };
}

function formatValidity(from: string | null, until: string | null): string {
  const fmt = (iso: string) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' }).format(new Date(iso));
  if (from && until) return `${fmt(from)} → ${fmt(until)}`;
  if (until) return `→ ${fmt(until)}`;
  if (from) return `${fmt(from)} → ∞`;
  return '—';
}
