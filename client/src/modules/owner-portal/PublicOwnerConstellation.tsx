import React, { useMemo } from 'react';
import { Spinner } from '../../components/ui';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Separator } from '../../components/ui';
import { useTranslation } from 'react-i18next';
import StatTile from '../../components/baitly/StatTile';
import {
  TrendingUp as RevenueIcon,
  Percent as CommissionIcon,
  Payments as PayoutIcon,
  Hotel as OccupancyIcon,
} from '../../icons';
import { API_CONFIG } from '../../config/api';

/**
 * Constellation Propriétaire (campagne X9 v1) — page PUBLIQUE en lecture seule,
 * white-label : seule la conciergerie apparaît, jamais la plateforme.
 * Accès par lien tokenisé /owner-view/:token (révocable, expirant).
 */

interface ActivityLine {
  createdAt: string;
  moduleKey: string;
  kind: string;
  summary: string | null;
}

interface PropertyAgentActivity {
  propertyId: number;
  propertyName: string;
  actionsLast30Days: number;
  suggestionsLast30Days: number;
  recent: ActivityLine[];
}

interface OwnerDashboard {
  ownerId: number;
  totalProperties: number;
  activeReservations: number;
  totalRevenue: number;
  totalCommissions: number;
  netRevenue: number;
  averageOccupancy: number;
  averageRating: number;
}

interface OwnerConstellationView {
  conciergerieName: string;
  ownerDisplayName: string;
  brandingLogoUrl: string | null;
  brandingPrimaryColor: string | null;
  dashboard: OwnerDashboard;
  agentActivity: PropertyAgentActivity[];
}

async function fetchView(token: string): Promise<OwnerConstellationView | null> {
  const response = await fetch(`${API_CONFIG.BASE_URL}/api/public/owner-constellation/${token}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('fetch_failed');
  return response.json();
}

/**
 * Tuile KPI du rapport propriétaire : `StatTile` porte déjà exactement cette
 * forme (libellé + icône, valeur en chiffres alignés).
 * L'icône reste en encre neutre : la page est white-label, aucune teinte de
 * plateforme n'y apparaît — seul le filet d'activité porte la couleur de la
 * conciergerie.
 */
function KpiValue({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <StatTile icon={icon} label={label} value={value} iconClassName="text-muted-foreground" />;
}

export default function PublicOwnerConstellation() {
  const { token } = useParams<{ token: string }>();
  const { t, i18n } = useTranslation();

  // Vue derivee de la requete (one-shot par visite : pas de retry ni de
  // refetch-on-focus — react-query gere dedup StrictMode + races).
  const viewQuery = useQuery({
    queryKey: ['public-owner-constellation', token],
    queryFn: () => fetchView(token!),
    enabled: !!token,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  const view = viewQuery.data ?? null;
  const state: 'loading' | 'ready' | 'notfound' | 'error' = !token
    ? 'notfound'
    : viewQuery.isError
      ? 'error'
      : viewQuery.isPending
        ? 'loading'
        : viewQuery.data === null
          ? 'notfound'
          : 'ready';

  const locale = i18n.language?.startsWith('fr') ? 'fr-FR' : i18n.language?.startsWith('ar') ? 'ar' : 'en-GB';
  const euros = useMemo(() => {
    const fmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    return (value: number) => fmt.format(value ?? 0);
  }, [locale]);
  const dateLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
    return (iso: string) => fmt.format(new Date(iso));
  }, [locale]);

  if (state === 'loading') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="size-10" />
      </div>
    );
  }

  if (state === 'notfound' || state === 'error' || !view) {
    return (
      // Report du Container MUI maxWidth="sm" : largeur bornee 600px, centree,
      // gouttiere 16px puis 24px au-dela de 600px (breakpoints MUI).
      <div className="mx-auto w-full max-w-[600px] px-4 min-[600px]:px-6 py-[60px] text-center">
        <h6 className="mb-1 text-base font-semibold tracking-tight text-balance">
          {t('ownerConstellation.invalidTitle', 'Lien invalide ou expiré')}
        </h6>
        <p className="text-sm text-muted-foreground">
          {t(
            'ownerConstellation.invalidBody',
            'Ce lien de suivi n’est plus actif. Contactez votre conciergerie pour en obtenir un nouveau.'
          )}
        </p>
      </div>
    );
  }

  const { conciergerieName, ownerDisplayName, brandingLogoUrl, brandingPrimaryColor, dashboard, agentActivity } = view;
  // Couleur d'accent white-label (X9-b) — validée #RRGGBB côté serveur.
  const accent = brandingPrimaryColor || '#6B8A9A';

  return (
    // Report du Container MUI maxWidth="md" (900px) — mêmes gouttières.
    <div className="mx-auto w-full max-w-[900px] px-4 min-[600px]:px-6 py-[18px] min-[900px]:py-9">
      {/* En-tête white-label : uniquement la conciergerie */}
      <div className="flex flex-col min-[600px]:flex-row justify-between min-[600px]:items-baseline gap-1.5">
        <div>
          {brandingLogoUrl && (
            <img className="max-h-[44px] max-w-[220px] block mb-1.5" src={brandingLogoUrl} alt={conciergerieName} />
          )}
          <h5 className="text-base font-semibold tracking-tight text-balance">
            {conciergerieName}
          </h5>
          <p className="text-sm text-muted-foreground">
            {t('ownerConstellation.subtitle', 'Espace propriétaire')}
            {ownerDisplayName ? ` — ${ownerDisplayName}` : ''}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {t('ownerConstellation.readOnly', 'Consultation seule')}
        </span>
      </div>

      <Separator className="my-[18px]" />

      {/* KPIs de l'année (tableau de bord propriétaire) */}
      <div className="grid grid-cols-2 gap-3 min-[600px]:grid-cols-4">
        <KpiValue icon={<RevenueIcon />} label={t('ownerConstellation.grossRevenue', 'Revenus bruts')} value={euros(dashboard.totalRevenue)} />
        <KpiValue icon={<CommissionIcon />} label={t('ownerConstellation.commissions', 'Commissions')} value={euros(dashboard.totalCommissions)} />
        <KpiValue icon={<PayoutIcon />} label={t('ownerConstellation.netRevenue', 'Net propriétaire')} value={euros(dashboard.netRevenue)} />
        <KpiValue
          icon={<OccupancyIcon />}
          label={t('ownerConstellation.occupancy', 'Occupation')}
          value={`${Math.round((dashboard.averageOccupancy ?? 0) * 100) / 100} %`}
        />
      </div>

      <Separator className="my-[18px]" />

      {/* Activité des agents, par bien */}
      <h6 className="mb-1 text-sm font-semibold tracking-tight text-balance">
        {t('ownerConstellation.agentActivityTitle', 'Ce que nos agents ont fait pour vos biens (30 derniers jours)')}
      </h6>

      {agentActivity.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t('ownerConstellation.noActivity', 'Aucune activité récente à afficher.')}
        </p>
      )}

      <div className="flex flex-col gap-[18px] mt-1.5">
        {agentActivity.map((property) => (
          <div key={property.propertyId}>
            <div className="flex flex-row justify-between items-baseline gap-3">
              <h6 className="text-sm font-medium">{property.propertyName}</h6>
              <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                {t('ownerConstellation.counters', '{{actions}} actions · {{suggestions}} suggestions', {
                  actions: property.actionsLast30Days,
                  suggestions: property.suggestionsLast30Days,
                })}
              </span>
            </div>
            {/* La teinte du filet vient du branding white-label (valeur runtime) :
                style inline, une classe Tailwind ne peut pas en naitre.
                Proprietes LOGIQUES (border-s / ps) : le rapport se lit aussi en RTL. */}
            <div
              className="flex flex-col gap-[4.5px] mt-1.5 ps-[9px] border-s border-solid"
              style={{ borderInlineStartColor: accent }}
            >
              {property.recent.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t('ownerConstellation.noPropertyActivity', 'Rien à signaler sur ce bien.')}
                </p>
              )}
              {property.recent.map((line, index) => (
                <div key={index} className="flex flex-row gap-[9px] items-baseline">
                  <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                    {dateLabel(line.createdAt)}
                  </span>
                  <p className="text-sm">{line.summary || line.moduleKey}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Separator className="my-6" />

      <span className="text-xs text-muted-foreground">
        {t('ownerConstellation.footer', 'Rapport préparé par {{name}}.', { name: conciergerieName })}
      </span>
    </div>
  );
}
