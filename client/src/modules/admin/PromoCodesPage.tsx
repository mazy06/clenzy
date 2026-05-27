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
  ToggleButtonGroup,
  ToggleButton,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Add, Percent, LocalOffer, Refresh } from '../../icons';
import PageHeader from '../../components/PageHeader';
import {
  promoCodesApi,
  type PromoCode,
  type PromoCodeCreatePayload,
} from '../../services/api/promoCodesApi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type FilterMode = 'active' | 'inactive' | 'expired' | 'all';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
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
      <DialogActions sx={{ px: 3, pb: 2 }}>
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
          <StatTile label="Total" value={stats.total} />
          <StatTile label="Actifs" value={stats.active} color="success" />
          <StatTile label="Utilisations totales" value={stats.totalUses} color="primary" />
          <StatTile
            label="Top code"
            value={stats.topUsed?.code ?? '—'}
            sub={stats.topUsed ? `${stats.topUsed.usedCount} usages` : undefined}
          />
        </Box>
      )}

      {/* Filtre */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
          Filtre :
        </Typography>
        <ToggleButtonGroup
          value={filterMode}
          exclusive
          onChange={(_, v) => v && setFilterMode(v)}
          size="small"
        >
          <ToggleButton value="all" sx={{ textTransform: 'none', px: 1.5 }}>
            Tous ({promoCodes?.length ?? 0})
          </ToggleButton>
          <ToggleButton value="active" sx={{ textTransform: 'none', px: 1.5 }}>
            Actifs ({stats?.active ?? 0})
          </ToggleButton>
          <ToggleButton value="inactive" sx={{ textTransform: 'none', px: 1.5 }}>
            Inactifs
          </ToggleButton>
          <ToggleButton value="expired" sx={{ textTransform: 'none', px: 1.5 }}>
            Expirés
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Impossible de charger les codes promo : {(error as Error).message}
        </Alert>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body2">
            Aucun code promo {filterMode !== 'all' ? `(filtre : ${filterMode})` : ''}.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Réduction</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Utilisations</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Validité</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Créé le</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">
                  Actif
                </TableCell>
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
                      <Chip
                        size="small"
                        label={discountLabel(promo)}
                        icon={
                          promo.discountType === 'PERCENTAGE' ? (
                            <Percent size={12} strokeWidth={2} />
                          ) : undefined
                        }
                        color={promo.active && !expired ? 'primary' : 'default'}
                        variant="outlined"
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
                          color: expired ? 'error.main' : 'text.secondary',
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

// ─── Sous-composant : tuile KPI ───────────────────────────────────────────────

interface StatTileProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: 'success' | 'primary' | 'default';
}

function StatTile({ label, value, sub, color = 'default' }: StatTileProps) {
  const accent = color === 'success' ? '#4A9B8E' : color === 'primary' ? '#6B8A9A' : 'text.primary';
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography
        variant="h5"
        sx={{
          fontWeight: 600,
          color: accent,
          fontVariantNumeric: 'tabular-nums',
          mt: 0.5,
          textWrap: 'balance',
        }}
      >
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {sub}
        </Typography>
      )}
    </Paper>
  );
}
