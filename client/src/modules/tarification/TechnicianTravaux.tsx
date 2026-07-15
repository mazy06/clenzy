import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Button, CircularProgress, Snackbar, Alert, Typography,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Switch, TextField, InputAdornment,
} from '@mui/material';
import { Save, Build } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useCurrency } from '../../hooks/useCurrency';
import { CurrencySymbol } from '../../components/Money';
import PageHeader from '../../components/PageHeader';
import { technicianPrestationsApi } from '../../services/api/technicianPrestationsApi';
import type { ServicePriceConfig } from '../../services/api/pricingConfigApi';

/**
 * Écran « Mes tarifs travaux » du technicien : le catalogue org (services actifs)
 * est PRÉ-LISTÉ, le technicien coche ce qu'il propose et fixe SON prix. Sa
 * surcouche (org + user, côté serveur) n'est visible que de lui.
 */
interface Row {
  interventionType: string;
  label: string;
  domain: string;
  offered: boolean;
  price: number;
}

export default function TechnicianTravaux() {
  const { t } = useTranslation();
  const { currency } = useCurrency();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  const otherDomain = t('tarification.travaux.otherDomain', 'Autre');

  const merge = useCallback((catalogue: ServicePriceConfig[], mine: ServicePriceConfig[]): Row[] => {
    const catalogueTypes = new Set(catalogue.map((c) => c.interventionType));
    const mineByType = new Map(mine.map((m) => [m.interventionType, m]));
    const list: Row[] = catalogue.map((c) => {
      const m = mineByType.get(c.interventionType);
      return {
        interventionType: c.interventionType,
        label: c.label || c.interventionType,
        domain: c.domain || otherDomain,
        offered: !!m?.enabled,
        price: m?.basePrice ?? 0,
      };
    });
    // Prestations propres hors catalogue (services personnalisés ou désactivés côté org).
    for (const m of mine) {
      if (!catalogueTypes.has(m.interventionType)) {
        list.push({
          interventionType: m.interventionType,
          label: m.label || m.interventionType,
          domain: m.domain || otherDomain,
          offered: !!m.enabled,
          price: m.basePrice ?? 0,
        });
      }
    }
    return list;
  }, [otherDomain]);

  useEffect(() => {
    Promise.all([
      technicianPrestationsApi.catalogue().catch(() => [] as ServicePriceConfig[]),
      technicianPrestationsApi.getMine().catch(() => [] as ServicePriceConfig[]),
    ])
      .then(([catalogue, mine]) => setRows(merge(catalogue, mine)))
      .finally(() => setLoading(false));
  }, [merge]);

  const updateRow = useCallback((index: number, partial: Partial<Row>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...partial } : r)));
  }, []);

  // Groupement par domaine, en conservant l'index d'origine pour l'édition.
  const grouped = useMemo(() => {
    const map = new Map<string, { row: Row; index: number }[]>();
    rows.forEach((row, index) => {
      if (!map.has(row.domain)) map.set(row.domain, []);
      map.get(row.domain)!.push({ row, index });
    });
    return Array.from(map.entries());
  }, [rows]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: ServicePriceConfig[] = rows.flatMap((r) =>
        r.offered ? [{ interventionType: r.interventionType, basePrice: r.price, enabled: true }] : [],
      );
      const saved = await technicianPrestationsApi.updateMine(payload);
      // Re-merge avec le catalogue courant pour rester pré-listé.
      const catalogue = await technicianPrestationsApi.catalogue().catch(() => [] as ServicePriceConfig[]);
      setRows(merge(catalogue, saved));
      setSnackbar({ open: true, message: t('tarification.saveSuccess', 'Enregistré'), severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: t('tarification.saveError', "Erreur lors de l'enregistrement"), severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={t('technicianPrestations.title', 'Mes tarifs travaux')}
        subtitle={t('technicianPrestations.subtitle', 'Cochez les prestations que vous proposez et fixez vos prix — visibles de vous seul.')}
        iconBadge={<Build />}
        backPath="/dashboard"
        actions={
          <Button
            variant="contained"
            size="small"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
            onClick={handleSave}
            disabled={saving}
          >
            {t('tarification.save', 'Enregistrer')}
          </Button>
        }
      />

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('tarification.travaux.prestation', 'Prestation')}</TableCell>
              <TableCell align="center">{t('technicianPrestations.offered', 'Je propose')}</TableCell>
              <TableCell align="right">{t('technicianPrestations.myPrice', 'Mon prix')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {grouped.map(([domain, entries]) => (
              <React.Fragment key={domain}>
                <TableRow>
                  <TableCell colSpan={3} sx={{ py: 0.75, borderBottom: '1px solid var(--line)', bgcolor: 'var(--field)' }}>
                    <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--faint)' }}>
                      {domain}
                    </Typography>
                  </TableCell>
                </TableRow>
                {entries.map(({ row, index }) => (
                  <TableRow key={row.interventionType}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={row.offered}
                        onChange={(e) => updateRow(index, { offered: e.target.checked })}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ width: 140 }}>
                      <TextField
                        type="number"
                        size="small"
                        value={row.price}
                        onChange={(e) => {
                          const num = parseFloat(e.target.value);
                          if (!isNaN(num)) updateRow(index, { price: num });
                        }}
                        disabled={!row.offered}
                        inputProps={{ step: 1, min: 0, style: { textAlign: 'right' } }}
                        InputProps={{ endAdornment: <InputAdornment position="end"><CurrencySymbol code={currency} /></InputAdornment> }}
                        sx={{ width: 120 }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar((s) => ({ ...s, open: false }))} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
