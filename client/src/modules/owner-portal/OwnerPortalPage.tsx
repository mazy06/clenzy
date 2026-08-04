import React, { useState, useMemo } from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/baitly/StatusChip';
import StatTile from '../../components/baitly/StatTile';
import ShowcaseEmpty from '../../components/baitly/ShowcaseEmpty';
import EmptyState from '../../components/EmptyState';
import { Badge, Button } from '../../components/ui';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import { Field, FieldLabel, FieldDescription, Input } from '../../components/ui';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  NativeSelect,
  NativeSelectOption,
} from '../../components/ui';
import {
  Home as HomeIcon,
  EventAvailable as ReservationIcon,
  TrendingUp as RevenueIcon,
  Hotel as OccupancyIcon,
  Star as RatingIcon,
  Receipt as StatementIcon,
  Business as BuildingIcon,
  Payments as PayoutIcon,
  Percent as PercentIcon,
} from '../../icons';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';
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

// Surface plate hairline r12 : l'ancien Paper `CARD_SX` (bordure `divider`, pas
// d'ombre, borderRadius 1.5 = 12px) transcrit en classes.
const PANEL_CLASS = 'rounded-[12px] border border-solid border-[var(--line)] bg-[var(--card)]';

const fmtCurrency = (n: number, currency = 'EUR') => <Money value={n} from={currency} />;

/** Configuration du graphique de la projection : une seule serie, chart-2. */
const OWNER_REVENUE_CONFIG = {
  net: { label: 'Net propriétaire', color: 'var(--bui-chart-2)' },
} satisfies ChartConfig;

// ─── Helpers ────────────────────────────────────────────────────────────────

// Le serveur renvoie DEJA un pourcentage (bookedDays / daysInPeriod * 100,
// cf. OwnerPortalService:123) : multiplier encore par 100 affichait 470 %
// pour 4,7 % — defaut present depuis l'origine de l'ecran, vu au rendu.
const fmtPercent = (n: number) => `${n.toFixed(1)}%`;

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—';

// ─── Component ──────────────────────────────────────────────────────────────

const OwnerPortalPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
  const selectedOwner = owners.find((o) => o.id === ownerId);
  // Nombre de biens du proprietaire selectionne — le sous-titre de la
  // projection (« Villa Palmeraie · M. Alaoui ») devient « nom · N proprietes ».
  const ownedCount = useMemo(
    () => (ownerId === undefined ? 0 : properties.filter((p: Property) => p.ownerId === ownerId).length),
    [properties, ownerId],
  );

  // SPACING.PAGE_PADDING = 2 unites MUI et theme.spacing = 6 => 12px de padding
  // (le commentaire « 16px » de theme/spacing.ts date d'un theme a 8px).
  return (
    <div className="p-3 flex flex-col gap-3">
      <PageHeader
        title={t('ownerPortal.title', 'Portail Proprietaire')}
        subtitle={
          selectedOwner
            ? `${selectedOwner.name} · ${t('ownerPortal.propertiesCount', { count: ownedCount })}`
            : t('ownerPortal.subtitle', 'Dashboard et releves proprietaires')
        }
        iconBadge={<BuildingIcon />}
        showBackButton={false}
        actions={
          <>
            {ownerId !== undefined && <ConstellationLinkButton ownerId={ownerId} />}
            <BrandingButton />
          </>
        }
      />

      {/* ── Owner selector ── */}
      <div className={cn(PANEL_CLASS, 'p-3 flex gap-3 items-center')}>
        <Field className="w-[240px] shrink-0">
          <FieldLabel htmlFor="owner-portal-owner" className="text-[0.8125rem]">
            {t('ownerPortal.selectOwner', 'Selectionner un proprietaire')}
          </FieldLabel>
          <NativeSelect
            id="owner-portal-owner"
            size="sm"
            className="w-full text-[0.8125rem]"
            value={selectedOwnerId}
            onChange={(e) => setSelectedOwnerId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <NativeSelectOption value="">—</NativeSelectOption>
            {owners.map((owner) => (
              <NativeSelectOption key={owner.id} value={owner.id}>
                {owner.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>

      {/* Rangee d'onglets nue, comme partout : le panneau qui l'entourait la
          coupait du reste de la page. */}
      <PageTabs
        options={[
          { label: t('ownerPortal.tabs.dashboard', 'Dashboard') },
          { label: t('ownerPortal.tabs.statement', 'Releve') },
        ]}
        value={activeTab}
        onChange={setActiveTab}
        mb={0}
      />

      {owners.length === 0 ? (
        // Aucun proprietaire dans l'organisation : l'etat vide riche de la
        // projection, qui explique la feature au lieu de constater le vide.
        <ShowcaseEmpty
          eyebrow={{ icon: <BuildingIcon size={14} strokeWidth={1.75} />, label: t('ownerPortal.title', 'Portail Proprietaire') }}
          title={t('ownerPortal.showcase.title', 'Vos propriétaires suivent leurs biens sans vous appeler')}
          description={t('ownerPortal.showcase.description', 'Occupation, revenus, reversements et documents, dans un espace dédié que vous ouvrez bien par bien.')}
          action={
            <Button onClick={() => navigate('/directory')}>
              {t('ownerPortal.showcase.action', 'Inviter un propriétaire')}
            </Button>
          }
        />
      ) : !ownerId ? (
        <EmptyState
          icon={<BuildingIcon />}
          title={t('ownerPortal.selectOwner', 'Selectionner un proprietaire')}
          description={t('ownerPortal.selectOwnerHint', 'Selectionnez un proprietaire pour afficher les donnees')}
          variant="transparent"
        />
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
      <Dialog open={open} onOpenChange={(next) => { if (!next) setOpen(false); }}>
        <DialogContent className="max-w-[444px]">
          <DialogHeader>
            <DialogTitle className="text-[1rem]">
              {t('ownerPortal.branding.title', 'Page propriétaire — votre marque')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
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
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel', 'Annuler')}
            </Button>
            <Button variant="default" onClick={handleSave} disabled={saving}>
              {t('common.save', 'Enregistrer')}
            </Button>
          </DialogFooter>
        </DialogContent>
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

  // Les tuiles de la projection (StatTile) remplacent les cartes aux
  // couleurs codees en dur : la teinte ne porte plus que sur l'icone, et
  // seulement la ou elle dit quelque chose (l'argent en succes, la note en
  // warning) — le reste en encre par defaut.
  const kpis = [
    { icon: <HomeIcon />, label: t('ownerPortal.kpi.properties', 'Proprietes'), value: dashboard.totalProperties },
    { icon: <ReservationIcon />, label: t('ownerPortal.kpi.reservations', 'Reservations actives'), value: dashboard.activeReservations },
    { icon: <RevenueIcon />, label: t('ownerPortal.kpi.netRevenue', 'Revenu net'), value: fmtCurrency(dashboard.netRevenue), iconClassName: 'text-success' },
    { icon: <OccupancyIcon />, label: t('ownerPortal.kpi.occupancy', 'Occupation moy.'), value: fmtPercent(dashboard.averageOccupancy) },
    { icon: <RatingIcon />, label: t('ownerPortal.kpi.rating', 'Note moyenne'), value: dashboard.averageRating.toFixed(1), unit: '/5', iconClassName: 'text-warning' },
  ];

  // Le graphique de la projection : une aire lissee, mois abreges en X.
  const revenueSeries = Object.entries(dashboard.revenueByMonth ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, net]) => ({
      // Cles « YYYY-MM » → libelle de mois localise (« juil. »).
      month: new Date(`${month}-01T00:00:00`).toLocaleDateString('fr-FR', { month: 'short' }),
      net,
    }));

  return (
    <>
      {/* ── KPI ── */}
      <div className="grid grid-cols-2 gap-3 mb-3 min-[900px]:grid-cols-5">
        {kpis.map((kpi) => (
          <StatTile
            key={kpi.label}
            icon={kpi.icon}
            label={kpi.label}
            value={kpi.value}
            unit={kpi.unit}
            iconClassName={kpi.iconClassName}
          />
        ))}
      </div>

      {/* ── Revenu net par mois — l'aire de la projection ── */}
      {revenueSeries.length > 0 && (
        <div className="rounded-xl border border-solid border-border bg-card p-4 mb-3">
          <h3 className="m-0 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t('ownerPortal.revenueByMonth', 'Revenu par mois')}
          </h3>
          <ChartContainer config={OWNER_REVENUE_CONFIG} className="h-44 w-full">
            <AreaChart accessibilityLayer data={revenueSeries} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
              <Area dataKey="net" type="natural" fill="var(--color-net)" fillOpacity={0.4} stroke="var(--color-net)" />
            </AreaChart>
          </ChartContainer>
        </div>
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
                    <StatusChip
                      size="sm"
                      dot
                      // Echelle 0-100 (cf. fmtPercent) : les anciens seuils
                      // 0.7 / 0.4 rendaient toute occupation « ok ».
                      tone={prop.occupancyRate > 70 ? 'ok' : prop.occupancyRate > 40 ? 'warn' : 'err'}
                      label={fmtPercent(prop.occupancyRate)}
                    />
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
      <div className={cn(PANEL_CLASS, 'p-3 mb-[9px] flex gap-3 items-center flex-wrap')}>
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
      </div>

      {/* ── Statement ── */}
      {isError && (
        <Alert variant="destructive" className="text-[0.8125rem] mb-2">
          <TriangleAlert />
          <AlertDescription>{t('ownerPortal.statementError', 'Erreur lors de la generation du releve')}</AlertDescription>
        </Alert>
      )}

      {statement && (
        <>
          {/* ── Totaux du releve — les tuiles de la projection, teintes
                semantiques sur l'icone seule au lieu des hex en dur. ── */}
          <div className="mb-[9px]">
            <p className="cn-text-body1 text-[0.875rem] font-bold mb-1.5">
              {statement.ownerName} — {fmtDate(statement.periodStart)} → {fmtDate(statement.periodEnd)}
            </p>
            <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
              <StatTile
                icon={<RevenueIcon />}
                label={t('ownerPortal.totalRevenue', 'Revenu total')}
                value={fmtCurrency(statement.totalRevenue)}
              />
              <StatTile
                icon={<PercentIcon />}
                label={t('ownerPortal.totalCommissions', 'Commissions')}
                value={fmtCurrency(statement.totalCommissions)}
              />
              {/* Frais OTA : affiches seulement quand le proprietaire les supporte.
                  A la charge de la conciergerie, ils ne sortent pas de son releve. */}
              {statement.totalOtaFees > 0 && (
                <StatTile
                  icon={<StatementIcon />}
                  label={t('ownerPortal.totalOtaFees', 'Frais OTA')}
                  value={fmtCurrency(statement.totalOtaFees)}
                  iconClassName="text-warning"
                />
              )}
              <StatTile
                icon={<StatementIcon />}
                label={t('ownerPortal.totalExpenses', 'Depenses')}
                value={fmtCurrency(statement.totalExpenses)}
                iconClassName="text-warning"
              />
              <StatTile
                icon={<PayoutIcon />}
                label={t('ownerPortal.netAmount', 'Montant net')}
                value={fmtCurrency(statement.netAmount)}
                iconClassName="text-success"
              />
            </div>
          </div>

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
                      <TableCell className="text-end tabular-nums">{fmtCurrency(line.amount)}</TableCell>
                      {statement.totalOtaFees > 0 && (
                        <TableCell className="text-end text-muted-foreground tabular-nums">−{fmtCurrency(line.otaFee)}</TableCell>
                      )}
                      <TableCell className="text-end text-muted-foreground tabular-nums">−{fmtCurrency(line.commission)}</TableCell>
                      <TableCell className="text-end font-semibold tabular-nums">{fmtCurrency(line.net)}</TableCell>
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
