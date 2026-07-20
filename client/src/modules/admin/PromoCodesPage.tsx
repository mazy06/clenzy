import React, { useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Typography,
  CircularProgress,
  TextField,
  MenuItem,
  Chip,
  Switch,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Skeleton,
  ToggleButtonGroup,
  ToggleButton,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Add, Percent, LocalOffer, Refresh, CheckCircle, TrendingUp } from '../../icons';
import PageHeader from '../../components/PageHeader';
import StatTile from '../../components/StatTile';
import EmptyState from '../../components/EmptyState';
import {
  promoCodesApi,
  type PromoCode,
  type PromoCodeCreatePayload,
} from '../../services/api/promoCodesApi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type FilterMode = 'active' | 'inactive' | 'expired' | 'all';

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return DATE_TIME_FORMATTER.format(new Date(iso));
  } catch {
    return iso;
  }
}

function isExpired(promo: PromoCode): boolean {
  if (!promo.validUntil) return false;
  return new Date(promo.validUntil).getTime() < Date.now();
}

function discountLabel(promo: PromoCode): string {
  if (promo.discountType === 'PERCENTAGE') {
    return `-${promo.discountValue}%`;
  }
  return `-${(promo.discountValue / 100).toFixed(2).replace('.', ',')}€`;
}

function usageLabel(promo: PromoCode): string {
  if (promo.maxUses === null) {
    return `${promo.usedCount} / ∞`;
  }
  return `${promo.usedCount} / ${promo.maxUses}`;
}

// ─── Modal de creation ────────────────────────────────────────────────────────

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function CreateCodeDialog({ open, onClose, onCreated }: CreateDialogProps) {
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (payload: PromoCodeCreatePayload) => promoCodesApi.create(payload),
    onSuccess: () => {
      onCreated();
      handleClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'Erreur lors de la création du code.');
    },
  });

  const handleClose = () => {
    setCode('');
    setDiscountType('PERCENTAGE');
    setDiscountValue('');
    setMaxUses('');
    setValidFrom('');
    setValidUntil('');
    setDescription('');
    setError(null);
    onClose();
  };

  const handleSubmit = () => {
    setError(null);
    if (!code.trim()) {
      setError('Le code est requis.');
      return;
    }
    const valueNum = parseInt(discountValue, 10);
    if (isNaN(valueNum) || valueNum <= 0) {
      setError('La valeur de réduction doit être un entier positif.');
      return;
    }
    if (discountType === 'PERCENTAGE' && (valueNum < 1 || valueNum > 100)) {
      setError('Un pourcentage doit être entre 1 et 100.');
      return;
    }
    const payload: PromoCodeCreatePayload = {
      code: code.trim().toUpperCase(),
      discountType,
      discountValue: valueNum,
      maxUses: maxUses ? parseInt(maxUses, 10) : null,
      validFrom: validFrom ? `${validFrom}T00:00:00` : null,
      validUntil: validUntil ? `${validUntil}T23:59:59` : null,
      description: description.trim() || null,
    };
    createMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Add size={20} strokeWidth={1.75} />
        Nouveau code promo
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <TextField
            label="Code *"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="WELCOME2026"
            inputProps={{ style: { textTransform: 'uppercase' }, maxLength: 50 }}
            helperText="Sera normalisé en majuscules"
            autoFocus
            fullWidth
            size="small"
          />

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField
              select
              label="Type de réduction *"
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as 'PERCENTAGE' | 'FIXED')}
              size="small"
            >
              <MenuItem value="PERCENTAGE">Pourcentage (%)</MenuItem>
              <MenuItem value="FIXED">Montant fixe (€)</MenuItem>
            </TextField>

            <TextField
              label={discountType === 'PERCENTAGE' ? 'Pourcentage *' : 'Montant en centimes *'}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder={discountType === 'PERCENTAGE' ? '30' : '500'}
              helperText={
                discountType === 'PERCENTAGE'
                  ? 'Entre 1 et 100'
                  : "Centimes (500 = 5,00€)"
              }
              size="small"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {discountType === 'PERCENTAGE' ? '%' : 'centimes'}
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <TextField
            label="Nombre maximum d'utilisations"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="Laisser vide pour illimité"
            helperText="Vide = utilisations illimitées"
            size="small"
            fullWidth
          />

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField
              label="Valide à partir du"
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
              helperText="Optionnel"
            />
            <TextField
              label="Valide jusqu'au"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
              helperText="Optionnel"
            />
          </Box>

          <TextField
            label="Description (interne)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex : campagne lancement Q3 2026"
            multiline
            rows={2}
            inputProps={{ maxLength: 255 }}
            size="small"
            fullWidth
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={createMutation.isPending}>
          Annuler
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={createMutation.isPending}
          startIcon={createMutation.isPending ? <CircularProgress size={16} /> : <Add size={16} />}
        >
          Créer
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function PromoCodesPage() {
  const queryClient = useQueryClient();
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const {
    data: promoCodes,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['promoCodes', 'list'],
    queryFn: () => promoCodesApi.list(),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, activate }: { id: number; activate: boolean }) =>
      activate ? promoCodesApi.activate(id) : promoCodesApi.deactivate(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['promoCodes', 'list'] });
      setSnackbar({
        open: true,
        message: variables.activate ? 'Code activé.' : 'Code désactivé.',
        severity: 'success',
      });
    },
    onError: () => {
      setSnackbar({
        open: true,
        message: 'Erreur lors de la modification du code.',
        severity: 'error',
      });
    },
  });

  // Filtrage
  const filtered = useMemo(() => {
    if (!promoCodes) return [];
    return promoCodes.filter((p) => {
      const expired = isExpired(p);
      switch (filterMode) {
        case 'active':
          return p.active && !expired;
        case 'inactive':
          return !p.active;
        case 'expired':
          return expired;
        case 'all':
        default:
          return true;
      }
    });
  }, [promoCodes, filterMode]);

  // KPIs
  const stats = useMemo(() => {
    if (!promoCodes) return null;
    const active = promoCodes.filter((p) => p.active && !isExpired(p)).length;
    const totalUses = promoCodes.reduce((s, p) => s + p.usedCount, 0);
    const topUsed = [...promoCodes].sort((a, b) => b.usedCount - a.usedCount)[0];
    return { total: promoCodes.length, active, totalUses, topUsed };
  }, [promoCodes]);

  return (
    <Box>
      <PageHeader
        title="Codes promo"
        subtitle="Gestion centralisée des codes promo / cooptation utilisés à l'inscription"
        iconBadge={<LocalOffer />}
        showBackButton={false}
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<Refresh size={16} />}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['promoCodes', 'list'] })}
              disabled={isLoading}
            >
              Rafraîchir
            </Button>
            <Button
              variant="contained"
              startIcon={<Add size={16} />}
              onClick={() => setCreateOpen(true)}
            >
              Créer un code
            </Button>
          </Box>
        }
      />

      {/* KPIs */}
      {stats && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
            gap: 2,
            mb: 3,
          }}
        >
          <StatTile icon={<LocalOffer />} label="Total" value={stats.total} color="#6B8A9A" />
          <StatTile icon={<CheckCircle />} label="Actifs" value={stats.active} color="#4A9B8E" />
          <StatTile icon={<Percent />} label="Utilisations totales" value={stats.totalUses} color="#7BA3C2" />
          <StatTile
            icon={<TrendingUp />}
            label="Top code"
            value={stats.topUsed?.code ?? '—'}
            color="#D4A574"
            hint={stats.topUsed ? `${stats.topUsed.usedCount} usages` : undefined}
          />
        </Box>
      )}

      {/* Filtre — segmented stylé par le thème global MuiToggleButtonGroup */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography
          sx={{
            fontSize: '10.5px',
            fontWeight: 700,
            letterSpacing: '.05em',
            textTransform: 'uppercase',
            color: 'var(--faint)',
          }}
        >
          Filtre
        </Typography>
        <ToggleButtonGroup
          value={filterMode}
          exclusive
          onChange={(_, v) => v && setFilterMode(v)}
          size="small"
        >
          <ToggleButton value="all">Tous ({promoCodes?.length ?? 0})</ToggleButton>
          <ToggleButton value="active">Actifs ({stats?.active ?? 0})</ToggleButton>
          <ToggleButton value="inactive">Inactifs</ToggleButton>
          <ToggleButton value="expired">Expirés</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Impossible de charger les codes promo : {(error as Error).message}
        </Alert>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={44} sx={{ borderRadius: '9px' }} />
          ))}
        </Box>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<LocalOffer />}
          title="Aucun code promo"
          description={
            filterMode !== 'all'
              ? `Aucun code ne correspond au filtre « ${filterMode} ».`
              : 'Créez votre premier code promo avec le bouton « Créer un code ».'
          }
        />
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '14px', borderColor: 'var(--line)' }}>
          <Table size="small">
            {/* Entêtes overline via le thème global MuiTableCell */}
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Réduction</TableCell>
                <TableCell>Utilisations</TableCell>
                <TableCell>Validité</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Créé le</TableCell>
                <TableCell align="center">Actif</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((promo) => {
                const expired = isExpired(promo);
                return (
                  <TableRow key={promo.id} hover>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: 'monospace', fontWeight: 600 }}
                      >
                        {promo.code}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {/* Chip -soft : actif = accent, sinon neutre muted */}
                      <Chip
                        size="small"
                        label={discountLabel(promo)}
                        icon={
                          promo.discountType === 'PERCENTAGE' ? (
                            <Percent size={12} strokeWidth={2} />
                          ) : undefined
                        }
                        sx={
                          promo.active && !expired
                            ? {
                                color: 'var(--accent)',
                                backgroundColor: 'var(--accent-soft)',
                                '& .MuiChip-icon': { color: 'var(--accent)' },
                              }
                            : {
                                color: 'var(--muted)',
                                backgroundColor: 'var(--hover)',
                                '& .MuiChip-icon': { color: 'var(--muted)' },
                              }
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {usageLabel(promo)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', color: 'text.secondary' }}
                      >
                        Du {formatDate(promo.validFrom)}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          color: expired ? 'var(--err)' : 'text.secondary',
                          fontWeight: expired ? 600 : 400,
                        }}
                      >
                        Au {formatDate(promo.validUntil)}
                        {expired && ' (expiré)'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {promo.description || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {formatDate(promo.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip
                        title={
                          expired
                            ? "Code expiré — le toggle n'a pas d'effet"
                            : promo.active
                              ? 'Désactiver'
                              : 'Activer'
                        }
                      >
                        <span>
                          <Switch
                            size="small"
                            checked={promo.active}
                            disabled={toggleMutation.isPending}
                            onChange={(e) =>
                              toggleMutation.mutate({ id: promo.id, activate: e.target.checked })
                            }
                          />
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <CreateCodeDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['promoCodes', 'list'] });
          setSnackbar({ open: true, message: 'Code promo créé.', severity: 'success' });
        }}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
