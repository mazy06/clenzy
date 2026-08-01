import React, { useState, useMemo } from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { Badge, Button } from '../../components/ui';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import { Field, FieldLabel, FieldDescription, Input } from '../../components/ui';
import { Paper, FormControl, InputLabel, Select, MenuItem, Card, CardContent, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import {
  Home as HomeIcon,
  EventAvailable as ReservationIcon,
  TrendingUp as RevenueIcon,
  Hotel as OccupancyIcon,
  Star as RatingIcon,
  Receipt as StatementIcon,
  Download as DownloadIcon,
} from '../../icons';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { propertiesApi } from '../../services/api/propertiesApi';
import type { Property } from '../../services/api/propertiesApi';
import { useOwnerDashboard, useOwnerStatement } from '../../hooks/useOwnerPortal';
import { ownerPortalApi } from '../../services/api/ownerPortalApi';
import type { OwnerDashboard, OwnerStatement } from '../../services/api/ownerPortalApi';
import { useQuery } from '@tanstack/react-query';
import { Money } from '../../components/Money';
import PageTabs from '../../components/PageTabs';

// ─── Constants ──────────────────────────────────────────────────────────────

const CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  borderRadius: 1.5,
} as const;

const fmtCurrency = (n: number, currency = 'EUR') => <Money value={n} from={currency} />;

const KPI_CARD_SX = {
  ...CARD_SX,
  textAlign: 'center',
  p: 2,
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtPercent = (n: number) => `${(n * 100).toFixed(1)}%`;

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—';

// ─── Component ──────────────────────────────────────────────────────────────

const OwnerPortalPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | ''>('');

  const { data: properties = [] } = useQuery({
    queryKey: ['properties-list'],
    queryFn: () => propertiesApi.getAll(),
    staleTime: 120_000,
  });

  // Proprietaires distincts derives des biens. Fix : l'ancien selecteur passait
  // l'id du BIEN comme ownerId au dashboard/releve (donnees fausses des que les
  // ids divergent) — on selectionne desormais un vrai Property.ownerId.
  const owners = useMemo(() => {
    const byId = new Map<number, string>();
    properties.forEach((p: Property) => {
      if (p.ownerId != null && !byId.has(p.ownerId)) {
        byId.set(p.ownerId, p.ownerName || `#${p.ownerId}`);
      }
    });
    return Array.from(byId, ([id, name]) => ({ id, name }));
  }, [properties]);

  const ownerId = selectedOwnerId === '' ? undefined : selectedOwnerId;

  // SPACING.PAGE_PADDING = 2 unites MUI et theme.spacing = 6 => 12px de padding
  // (le commentaire « 16px » de theme/spacing.ts date d'un theme a 8px).
  return (
    <div className="p-3">
      <PageHeader
        title={t('ownerPortal.title', 'Portail Proprietaire')}
        subtitle={t('ownerPortal.subtitle', 'Dashboard et releves proprietaires')}
        showBackButton={false}
        backPath="/dashboard"
      />

      {/* ── Owner selector ── */}
      <Paper sx={{ ...CARD_SX, p: 2, mb: 1.5, display: 'flex', gap: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel sx={{ fontSize: '0.8125rem' }}>
            {t('ownerPortal.selectOwner', 'Selectionner un proprietaire')}
          </InputLabel>
          <Select
            value={selectedOwnerId}
            onChange={(e) => setSelectedOwnerId(e.target.value as number | '')}
            label={t('ownerPortal.selectOwner', 'Selectionner un proprietaire')}
            sx={{ fontSize: '0.8125rem' }}
          >
            {owners.map((owner) => (
              <MenuItem key={owner.id} value={owner.id} sx={{ fontSize: '0.8125rem' }}>
                {owner.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {ownerId !== undefined && <ConstellationLinkButton ownerId={ownerId} />}
        <BrandingButton />
      </Paper>

      <Paper sx={{ ...CARD_SX, mb: 1.5 }}>
        <PageTabs
          options={[
            { label: t('ownerPortal.tabs.dashboard', 'Dashboard') },
            { label: t('ownerPortal.tabs.statement', 'Releve') },
          ]}
          value={activeTab}
          onChange={setActiveTab}
          mb={0}
        />
      </Paper>

      {!ownerId ? (
        <Paper sx={{ ...CARD_SX, p: 4, textAlign: 'center' }}>
          <span className="inline-flex text-muted-foreground opacity-60 mb-1.5"><HomeIcon size={48} strokeWidth={1.75} /></span>
          <p className="cn-text-body1 text-[0.875rem] text-muted-foreground">
            {t('ownerPortal.selectOwnerHint', 'Selectionnez un proprietaire pour afficher les donnees')}
          </p>
        </Paper>
      ) : (
        <>
          {activeTab === 0 && <DashboardTab ownerId={ownerId} />}
          {activeTab === 1 && <StatementTab ownerId={ownerId} />}
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  Lien Constellation Propriétaire (campagne X9) — génère + copie le lien
//  public lecture seule à partager au propriétaire.
// ═══════════════════════════════════════════════════════════════════════════

const ConstellationLinkButton: React.FC<{ ownerId: number }> = ({ ownerId }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'busy' | 'copied' | 'error'>('idle');

  const handleShare = async () => {
    setStatus('busy');
    try {
      const link = await ownerPortalApi.createConstellationLink(ownerId);
      await navigator.clipboard.writeText(link.url);
      setStatus('copied');
      setTimeout(() => setStatus('idle'), 4000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleShare}
      disabled={status === 'busy'}
      className="whitespace-nowrap"
    >
      {status === 'copied'
        ? t('ownerPortal.constellationLinkCopied', 'Lien copié !')
        : status === 'error'
          ? t('ownerPortal.constellationLinkError', 'Échec — réessayer')
          : t('ownerPortal.constellationLink', 'Partager le suivi propriétaire')}
    </Button>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  Branding white-label de la page propriétaire (campagne X9-b) : logo HTTPS
//  + couleur d'accent affichés sur /owner-view/:token.
// ═══════════════════════════════════════════════════════════════════════════

const BrandingButton: React.FC = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = async () => {
    setOpen(true);
    setError(null);
    try {
      const branding = await ownerPortalApi.getBranding();
      setLogoUrl(branding.logoUrl ?? '');
      setPrimaryColor(branding.primaryColor ?? '');
    } catch {
      /* formulaire vide en cas d'échec de lecture */
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await ownerPortalApi.updateBranding(logoUrl.trim(), primaryColor.trim());
      setOpen(false);
    } catch (e) {
      setError((e as { message?: string })?.message
        || t('ownerPortal.branding.saveError', 'Enregistrement impossible'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        className="whitespace-nowrap"
      >
        {t('ownerPortal.branding.open', 'Personnaliser la page propriétaire')}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '1rem' }}>
          {t('ownerPortal.branding.title', 'Page propriétaire — votre marque')}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <p className="cn-text-body2 text-muted-foreground">
            {t('ownerPortal.branding.subtitle',
              'Logo et couleur affichés sur les liens de suivi partagés à vos propriétaires. Aucune mention de la plateforme.')}
          </p>
          {error && <Alert variant="warning">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>}
          <Field>
            <FieldLabel htmlFor="owner-branding-logo-url">
              {t('ownerPortal.branding.logoUrl', 'URL du logo (HTTPS)')}
            </FieldLabel>
            <Input
              id="owner-branding-logo-url"
              className="w-full"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…/logo.png"
            />
            <FieldDescription>
              {t('ownerPortal.branding.logoHelp', 'Laisser vide pour ne pas afficher de logo')}
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="owner-branding-primary-color">
              {t('ownerPortal.branding.primaryColor', "Couleur d'accent (#RRGGBB)")}
            </FieldLabel>
            <Input
              id="owner-branding-primary-color"
              className="w-full"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="#4A9B8E"
            />
          </Field>
        </DialogContent>
        <DialogActions>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button variant="default" onClick={handleSave} disabled={saving}>
            {t('common.save', 'Enregistrer')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  Dashboard Tab
// ═══════════════════════════════════════════════════════════════════════════

const DashboardTab: React.FC<{ ownerId: number }> = ({ ownerId }) => {
  const { t } = useTranslation();
  const { data: dashboard, isLoading, isError } = useOwnerDashboard(ownerId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (isError || !dashboard) {
    return (
      <Alert variant="destructive" className="text-[0.8125rem]">
        <TriangleAlert />
        <AlertDescription>{t('ownerPortal.dashboardError', 'Erreur lors du chargement du dashboard')}</AlertDescription>
      </Alert>
    );
  }

  const kpis = [
    { icon: <HomeIcon />, label: t('ownerPortal.kpi.properties', 'Proprietes'), value: dashboard.totalProperties, color: '#1976d2' },
    { icon: <ReservationIcon />, label: t('ownerPortal.kpi.reservations', 'Reservations actives'), value: dashboard.activeReservations, color: '#4A9B8E' },
    { icon: <RevenueIcon />, label: t('ownerPortal.kpi.netRevenue', 'Revenu net'), value: fmtCurrency(dashboard.netRevenue), color: '#2e7d32' },
    { icon: <OccupancyIcon />, label: t('ownerPortal.kpi.occupancy', 'Occupation moy.'), value: fmtPercent(dashboard.averageOccupancy), color: '#D4A574' },
    { icon: <RatingIcon />, label: t('ownerPortal.kpi.rating', 'Note moyenne'), value: dashboard.averageRating.toFixed(1), color: '#f9a825' },
  ];

  return (
    <>
      {/* ── KPI Cards ── */}
      {/* Au-dela de 900px les 5 KPI tiennent sur une seule rangee (equivalent du
          `md` auto de l'ancienne grille) : d'ou la grille a 5 colonnes, `flex-1`
          n'ayant aucun effet sur un enfant de `display: grid`. */}
      <div className="grid grid-cols-12 min-[900px]:grid-cols-5 gap-[9px] mb-3">
        {kpis.map((kpi) => (
          <div className="col-span-6 min-[600px]:col-span-4 min-[900px]:col-span-1" key={kpi.label}>
            <Card sx={KPI_CARD_SX}>
              <CardContent sx={{ p: '12px !important', '&:last-child': { pb: '12px !important' } }}>
                <div className="mb-[3px]" style={{ color: kpi.color }}>
                  {React.cloneElement(kpi.icon, { sx: { fontSize: '1.5rem' } })}
                </div>
                <p className="cn-text-body1 text-[1.25rem] font-bold" style={{ color: kpi.color }}>
                  {kpi.value}
                </p>
                <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground mt-0.5">
                  {kpi.label}
                </p>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* ── Revenue by Month ── */}
      {dashboard.revenueByMonth && Object.keys(dashboard.revenueByMonth).length > 0 && (
        <Paper sx={{ ...CARD_SX, p: 2, mb: 2 }}>
          <p className="cn-text-body1 text-[0.8125rem] font-bold mb-2">
            {t('ownerPortal.revenueByMonth', 'Revenu par mois')}
          </p>
          <div className="flex gap-0.5 items-end h-[120px]">
            {Object.entries(dashboard.revenueByMonth).map(([month, revenue]) => {
              const maxRevenue = Math.max(...Object.values(dashboard.revenueByMonth));
              const barHeight = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0;
              return (
                <div className="flex-1 flex flex-col items-center" key={month}>
                  <p className="cn-text-body1 text-[0.5625rem] text-muted-foreground mb-0.5">
                    {fmtCurrency(revenue)}
                  </p>
                  <div className="w-full min-h-[4px] bg-[#4A9B8E] rounded-[4px_4px_0_0]" style={{ height: `${barHeight}%` }} />
                  <p className="cn-text-body1 text-[0.5625rem] text-muted-foreground mt-0.5">
                    {month.slice(-2)}
                  </p>
                </div>
              );
            })}
          </div>
        </Paper>
      )}

      {/* ── Properties Table ── */}
      {dashboard.properties && dashboard.properties.length > 0 && (
        <div className="overflow-x-auto rounded-[12px] border border-solid border-[var(--line)] bg-[var(--card)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ownerPortal.col.property', 'Propriete')}</TableHead>
                <TableHead className="text-end">{t('ownerPortal.col.revenue', 'Revenu')}</TableHead>
                <TableHead className="text-center">{t('ownerPortal.col.occupancy', 'Occupation')}</TableHead>
                <TableHead className="text-center">{t('ownerPortal.col.reservations', 'Reservations')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboard.properties.map((prop) => (
                <TableRow key={prop.propertyId}>
                  <TableCell>{prop.propertyName}</TableCell>
                  <TableCell className="text-end font-semibold">
                    {fmtCurrency(prop.revenue)}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusChip size="sm" tokens={{ color: '#fff', bg: prop.occupancyRate > 0.7 ? '#4A9B8E' : prop.occupancyRate > 0.4 ? '#D4A574' : '#ef5350' }} label={fmtPercent(prop.occupancyRate)} className="h-[20px]" />
                  </TableCell>
                  <TableCell className="text-center">{prop.reservationCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  Statement Tab
// ═══════════════════════════════════════════════════════════════════════════

const StatementTab: React.FC<{ ownerId: number }> = ({ ownerId }) => {
  const { t } = useTranslation();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [shouldFetch, setShouldFetch] = useState(false);

  const { data: statement, isLoading, isError } = useOwnerStatement(
    shouldFetch ? ownerId : undefined,
    shouldFetch ? from : undefined,
    shouldFetch ? to : undefined,
    ownerName,
  );

  const handleGenerate = () => {
    if (from && to) {
      setShouldFetch(true);
    }
  };

  return (
    <>
      {/* ── Filters ── */}
      <Paper sx={{ ...CARD_SX, p: 2, mb: 1.5, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Field className="w-[200px]">
          <FieldLabel htmlFor="owner-statement-name" className="text-[0.8125rem]">
            {t('ownerPortal.form.ownerName', 'Nom proprietaire')}
          </FieldLabel>
          <Input
            id="owner-statement-name"
            className="text-[0.8125rem]"
            value={ownerName}
            onChange={(e) => { setOwnerName(e.target.value); setShouldFetch(false); }}
          />
        </Field>
        <Field className="w-[170px]">
          <FieldLabel htmlFor="owner-statement-from" className="text-[0.8125rem]">
            {t('ownerPortal.form.from', 'Du')}
          </FieldLabel>
          <Input
            id="owner-statement-from"
            type="date"
            className="text-[0.8125rem]"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setShouldFetch(false); }}
          />
        </Field>
        <Field className="w-[170px]">
          <FieldLabel htmlFor="owner-statement-to" className="text-[0.8125rem]">
            {t('ownerPortal.form.to', 'Au')}
          </FieldLabel>
          <Input
            id="owner-statement-to"
            type="date"
            className="text-[0.8125rem]"
            value={to}
            onChange={(e) => { setTo(e.target.value); setShouldFetch(false); }}
          />
        </Field>
        <Button
          size="sm"
          variant="default"
          onClick={handleGenerate}
          disabled={!from || !to || isLoading}
        >
          {isLoading ? <Spinner className="size-3.5" /> : <StatementIcon />}
          {t('ownerPortal.generate', 'Generer le releve')}
        </Button>
      </Paper>

      {/* ── Statement ── */}
      {isError && (
        <Alert variant="destructive" className="text-[0.8125rem] mb-2">
          <TriangleAlert />
          <AlertDescription>{t('ownerPortal.statementError', 'Erreur lors de la generation du releve')}</AlertDescription>
        </Alert>
      )}

      {statement && (
        <>
          {/* ── Header totals ── */}
          <Paper sx={{ ...CARD_SX, p: 2, mb: 1.5 }}>
            <p className="cn-text-body1 text-[0.875rem] font-bold mb-1.5">
              {statement.ownerName} — {fmtDate(statement.periodStart)} → {fmtDate(statement.periodEnd)}
            </p>
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-6 min-[600px]:col-span-3">
                <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground">
                  {t('ownerPortal.totalRevenue', 'Revenu total')}
                </p>
                <p className="cn-text-body1 text-[1rem] font-bold text-[#1976d2]">
                  {fmtCurrency(statement.totalRevenue)}
                </p>
              </div>
              <div className="col-span-6 min-[600px]:col-span-3">
                <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground">
                  {t('ownerPortal.totalCommissions', 'Commissions')}
                </p>
                <p className="cn-text-body1 text-[1rem] font-bold text-[#D4A574]">
                  {fmtCurrency(statement.totalCommissions)}
                </p>
              </div>
              {/* Frais OTA : affiches seulement quand le proprietaire les supporte.
                  A la charge de la conciergerie, ils ne sortent pas de son releve. */}
              {statement.totalOtaFees > 0 && (
                <div className="col-span-6 min-[600px]:col-span-3">
                  <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground">
                    {t('ownerPortal.totalOtaFees', 'Frais OTA')}
                  </p>
                  <p className="cn-text-body1 text-[1rem] font-bold text-[#ef5350]">
                    {fmtCurrency(statement.totalOtaFees)}
                  </p>
                </div>
              )}
              <div className="col-span-6 min-[600px]:col-span-3">
                <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground">
                  {t('ownerPortal.totalExpenses', 'Depenses')}
                </p>
                <p className="cn-text-body1 text-[1rem] font-bold text-[#ef5350]">
                  {fmtCurrency(statement.totalExpenses)}
                </p>
              </div>
              <div className="col-span-6 min-[600px]:col-span-3">
                <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground">
                  {t('ownerPortal.netAmount', 'Montant net')}
                </p>
                <p className="cn-text-body1 text-[1rem] font-bold text-[#2e7d32]">
                  {fmtCurrency(statement.netAmount)}
                </p>
              </div>
            </div>
          </Paper>

          {/* ── Statement lines ── */}
          {statement.lines && statement.lines.length > 0 && (
            <div className="overflow-x-auto rounded-[12px] border border-solid border-[var(--line)] bg-[var(--card)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('ownerPortal.col.date', 'Date')}</TableHead>
                    <TableHead>{t('ownerPortal.col.description', 'Description')}</TableHead>
                    <TableHead>{t('ownerPortal.col.property', 'Propriete')}</TableHead>
                    <TableHead>{t('ownerPortal.col.type', 'Type')}</TableHead>
                    <TableHead className="text-end">{t('ownerPortal.col.amount', 'Montant')}</TableHead>
                    {statement.totalOtaFees > 0 && (
                      <TableHead className="text-end">{t('ownerPortal.col.otaFee', 'Frais OTA')}</TableHead>
                    )}
                    <TableHead className="text-end">{t('ownerPortal.col.commission', 'Commission')}</TableHead>
                    <TableHead className="text-end">{t('ownerPortal.col.net', 'Net')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statement.lines.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs">{fmtDate(line.date)}</TableCell>
                      <TableCell>{line.description}</TableCell>
                      <TableCell>{line.propertyName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[0.625rem] h-[20px] font-semibold">{line.type}</Badge>
                      </TableCell>
                      <TableCell className="text-end">{fmtCurrency(line.amount)}</TableCell>
                      {statement.totalOtaFees > 0 && (
                        <TableCell className="text-end">{fmtCurrency(line.otaFee)}</TableCell>
                      )}
                      <TableCell className="text-end">{fmtCurrency(line.commission)}</TableCell>
                      <TableCell className="text-end font-bold">{fmtCurrency(line.net)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default OwnerPortalPage;
