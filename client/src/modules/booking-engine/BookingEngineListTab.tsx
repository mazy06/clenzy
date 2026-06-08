import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Switch,
  Card,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Chip,
  Skeleton,
  Alert,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Edit,
  Delete,
  VpnKey,
  ContentCopy,
  Add,
  Check,
  Visibility,
  VisibilityOff,
  Public,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import {
  useBookingEngineConfigs,
  useAllBookingEngineConfigs,
  useDeleteBookingEngineConfig,
  useToggleBookingEngine,
} from '../../hooks/useBookingEngineConfig';
import type { BookingEngineConfig } from '../../services/api/bookingEngineApi';
import { semanticToHex, softChipSx } from '../../utils/statusUtils';

interface BookingEngineListTabProps {
  onEdit: (config: BookingEngineConfig) => void;
  onCreate: () => void;
  /** Search query — controlled by the parent so the search bar can live in the PageHeader. */
  search?: string;
  /** Reports the total number of configs (pre-filter) so the parent can decide whether
   *  to render the search bar at all. */
  onTotalCountChange?: (total: number) => void;
  /** Reports the count after filtering so the parent's count chip stays in sync. */
  onFilteredCountChange?: (count: number) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const FALLBACK_COLOR = '#6B8A9A';

/** Normalises any user-provided color to a hex string, falling back to brand slate. */
function normalizeColor(raw: string | null | undefined): string {
  if (!raw) return FALLBACK_COLOR;
  if (/^#?[0-9a-f]{3,8}$/i.test(raw.replace(/^#/, ''))) {
    return raw.startsWith('#') ? raw : `#${raw}`;
  }
  return raw;
}

/** Returns "8aff…42d3" — keeps the start + end so admins can match it visually. */
function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 12) return key;
  return `${key.substring(0, 4)}…${key.substring(key.length - 4)}`;
}

// ─── API key chip with reveal + copy ────────────────────────────────────────

const ApiKeyChip: React.FC<{ apiKey: string }> = ({ apiKey }) => {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(apiKey).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  return (
    <Box
      onClick={(e) => e.stopPropagation()}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        bgcolor: 'action.hover',
        borderRadius: 1,
        px: 0.75,
        py: 0.25,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: '0.75rem',
        color: 'text.secondary',
        maxWidth: '100%',
      }}
    >
      <Box
        component="span"
        sx={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 180,
        }}
      >
        {revealed ? apiKey : maskApiKey(apiKey)}
      </Box>
      <Tooltip title={revealed ? t('common.hide', 'Masquer') : t('common.show', 'Afficher')}>
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); setRevealed((v) => !v); }}
          sx={{ p: 0.25, color: 'text.disabled' }}
        >
          {revealed
            ? <VisibilityOff size={12} strokeWidth={1.75} />
            : <Visibility size={12} strokeWidth={1.75} />}
        </IconButton>
      </Tooltip>
      <Tooltip title={copied ? t('common.copied', 'Copié') : t('bookingEngine.fields.copyKey', 'Copier')}>
        <IconButton
          size="small"
          onClick={handleCopy}
          sx={{ p: 0.25, color: copied ? 'success.main' : 'text.disabled' }}
        >
          {copied
            ? <Check size={12} strokeWidth={2} />
            : <ContentCopy size={12} strokeWidth={1.75} />}
        </IconButton>
      </Tooltip>
    </Box>
  );
};

// ─── Card component ────────────────────────────────────────────────────────

interface TemplateCardProps {
  config: BookingEngineConfig;
  showOrg: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  toggleDisabled: boolean;
}

const TemplateRow: React.FC<TemplateCardProps> = ({
  config,
  showOrg,
  onEdit,
  onDelete,
  onToggle,
  toggleDisabled,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const accent = normalizeColor(config.primaryColor);
  const isActive = config.enabled;

  return (
    <Box
      onClick={onEdit}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1, sm: 1.5 },
        flexWrap: 'wrap',
        px: { xs: 1.5, sm: 2 },
        py: 1.25,
        cursor: 'pointer',
        transition: 'background-color 150ms ease',
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      {/* Identité couleur du template : simple pastille (accent), jamais de side-stripe */}
      <Box
        aria-hidden
        sx={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          bgcolor: accent,
          flexShrink: 0,
          border: '1px solid',
          borderColor: alpha(theme.palette.divider, 0.5),
        }}
      />

      {/* Nom · organisation + langue · devise · police */}
      <Box sx={{ flex: '1 1 240px', minWidth: 0 }}>
        <Typography
          component="div"
          sx={{
            fontSize: '0.875rem',
            fontWeight: 600,
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {config.name}
          {showOrg ? (
            <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
              {' · '}
              {config.organizationName || `Org #${config.organizationId}`}
            </Box>
          ) : null}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mt: 0.25,
            color: 'text.secondary',
            fontSize: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, fontVariantNumeric: 'tabular-nums' }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: accent }} />
            {accent.toUpperCase()}
          </Box>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
            <Public size={12} strokeWidth={1.75} />
            {config.defaultLanguage.toUpperCase()} · {config.defaultCurrency}
          </Box>
          {config.fontFamily ? (
            <Box
              component="span"
              sx={{ fontFamily: config.fontFamily, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}
              title={config.fontFamily}
            >
              {config.fontFamily}
            </Box>
          ) : null}
        </Box>
      </Box>

      {/* Clé API (masquée + révéler + copier) — gère son propre stopPropagation */}
      <ApiKeyChip apiKey={config.apiKey} />

      {/* Statut */}
      <Chip
        label={isActive ? t('bookingEngine.status.active', 'Actif') : t('bookingEngine.status.inactive', 'Inactif')}
        size="small"
        sx={{ ...softChipSx(semanticToHex(isActive ? 'success' : 'default')), flexShrink: 0 }}
      />

      {/* Toggle + actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        <Tooltip
          arrow
          title={isActive
            ? t('bookingEngine.status.disableTooltip', 'Désactiver ce template')
            : t('bookingEngine.status.enableTooltip', 'Activer ce template')}
        >
          <Switch checked={isActive} onChange={onToggle} size="small" color="success" disabled={toggleDisabled} />
        </Tooltip>
        <Tooltip title={t('bookingEngine.actions.editTemplate', 'Modifier')}>
          <IconButton size="small" onClick={onEdit} sx={{ color: 'text.secondary' }}>
            <Edit size={16} strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('bookingEngine.actions.deleteTemplate', 'Supprimer')}>
          <IconButton size="small" onClick={onDelete} color="error">
            <Delete size={16} strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

// ─── List tab ──────────────────────────────────────────────────────────────

const BookingEngineListTab: React.FC<BookingEngineListTabProps> = React.memo(
  ({ onEdit, onCreate, search = '', onTotalCountChange, onFilteredCountChange }) => {
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

    const filteredConfigs = useMemo(() => {
      if (!configs) return [];
      const q = search.trim().toLowerCase();
      if (!q) return configs;
      return configs.filter((c) =>
        c.name.toLowerCase().includes(q)
        || (c.organizationName ?? '').toLowerCase().includes(q)
        || c.apiKey.toLowerCase().includes(q),
      );
    }, [configs, search]);

    // Push counts to the parent so the PageHeader filters slot stays in sync.
    useEffect(() => {
      onTotalCountChange?.(configs?.length ?? 0);
    }, [configs?.length, onTotalCountChange]);
    useEffect(() => {
      onFilteredCountChange?.(filteredConfigs.length);
    }, [filteredConfigs.length, onFilteredCountChange]);

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

    // ── Loading ──────────────────────────────────────────────────────────────
    if (isLoading) {
      return (
        <Card variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', mt: 1 }}>
          {[1, 2, 3, 4].map((i) => (
            <React.Fragment key={i}>
              {i > 1 ? <Divider /> : null}
              <Box sx={{ px: 2, py: 1.25 }}>
                <Skeleton variant="text" width="38%" height={20} />
                <Skeleton variant="text" width="22%" height={16} />
              </Box>
            </React.Fragment>
          ))}
        </Card>
      );
    }

    // ── Error ────────────────────────────────────────────────────────────────
    if (error) {
      return <Alert severity="error" sx={{ mt: 1 }}>{t('bookingEngine.messages.error')}</Alert>;
    }

    // ── Empty (no configs at all) ────────────────────────────────────────────
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
          <Button
            variant="contained"
            size="small"
            startIcon={<Add size={14} strokeWidth={1.75} />}
            onClick={onCreate}
          >
            {t('bookingEngine.actions.newTemplate')}
          </Button>
        </Box>
      );
    }

    // ── Main render — search lives in the PageHeader (controlled via props) ──
    return (
      <>
        {/* No results for the current search (the search bar itself is in the PageHeader) */}
        {filteredConfigs.length === 0 ? (
          <Alert severity="info" sx={{ mt: 1, fontSize: '0.8125rem' }}>
            {t('bookingEngine.list.noResults', 'Aucun template ne correspond à la recherche.')}
          </Alert>
        ) : (
          <Card variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', mt: 1 }}>
            {filteredConfigs.map((config, i) => (
              <React.Fragment key={config.id}>
                {i > 0 ? <Divider /> : null}
                <TemplateRow
                  config={config}
                  showOrg={showAllOrgs}
                  onEdit={() => onEdit(config)}
                  onDelete={() => setDeleteTarget(config)}
                  onToggle={() => handleToggle(config)}
                  toggleDisabled={toggleMutation.isPending}
                />
              </React.Fragment>
            ))}
          </Card>
        )}

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
