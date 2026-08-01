import React, { useMemo } from 'react';
import { Spinner } from '../../components/ui';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Container, Divider, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
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

function KpiValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[140px]">
      <span className="cn-text-overline text-muted-foreground leading-[1.4]">
        {label}
      </span>
      <h6 className="cn-text-h6 tabular-nums">
        {value}
      </h6>
    </div>
  );
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
      <Container maxWidth="sm" sx={{ py: 10, textAlign: 'center' }}>
        <h6 className="cn-text-h6 mb-[0.35em]">
          {t('ownerConstellation.invalidTitle', 'Lien invalide ou expiré')}
        </h6>
        <p className="cn-text-body2 text-muted-foreground">
          {t(
            'ownerConstellation.invalidBody',
            'Ce lien de suivi n’est plus actif. Contactez votre conciergerie pour en obtenir un nouveau.'
          )}
        </p>
      </Container>
    );
  }

  const { conciergerieName, ownerDisplayName, brandingLogoUrl, brandingPrimaryColor, dashboard, agentActivity } = view;
  // Couleur d'accent white-label (X9-b) — validée #RRGGBB côté serveur.
  const accent = brandingPrimaryColor || '#6B8A9A';

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 6 } }}>
      {/* En-tête white-label : uniquement la conciergerie */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'baseline' }} spacing={1}>
        <div>
          {brandingLogoUrl && (
            <img className="max-h-[44px] max-w-[220px] block mb-1.5" src={brandingLogoUrl} alt={conciergerieName} />
          )}
          <h5 className="cn-text-h5 text-balance">
            {conciergerieName}
          </h5>
          <p className="cn-text-body2 text-muted-foreground">
            {t('ownerConstellation.subtitle', 'Espace propriétaire')}
            {ownerDisplayName ? ` — ${ownerDisplayName}` : ''}
          </p>
        </div>
        <span className="cn-text-caption text-muted-foreground">
          {t('ownerConstellation.readOnly', 'Consultation seule')}
        </span>
      </Stack>

      <Divider sx={{ my: 3 }} />

      {/* KPIs de l'année (tableau de bord propriétaire) */}
      <Stack direction="row" spacing={4} useFlexGap flexWrap="wrap">
        <KpiValue label={t('ownerConstellation.grossRevenue', 'Revenus bruts')} value={euros(dashboard.totalRevenue)} />
        <KpiValue label={t('ownerConstellation.commissions', 'Commissions')} value={euros(dashboard.totalCommissions)} />
        <KpiValue label={t('ownerConstellation.netRevenue', 'Net propriétaire')} value={euros(dashboard.netRevenue)} />
        <KpiValue
          label={t('ownerConstellation.occupancy', 'Occupation')}
          value={`${Math.round((dashboard.averageOccupancy ?? 0) * 100) / 100} %`}
        />
      </Stack>

      <Divider sx={{ my: 3 }} />

      {/* Activité des agents, par bien */}
      <h6 className="cn-text-subtitle1 font-semibold mb-[0.35em]">
        {t('ownerConstellation.agentActivityTitle', 'Ce que nos agents ont fait pour vos biens (30 derniers jours)')}
      </h6>

      {agentActivity.length === 0 && (
        <p className="cn-text-body2 text-muted-foreground">
          {t('ownerConstellation.noActivity', 'Aucune activité récente à afficher.')}
        </p>
      )}

      <Stack spacing={3} sx={{ mt: 1 }}>
        {agentActivity.map((property) => (
          <div key={property.propertyId}>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline">
              <h6 className="cn-text-subtitle2">{property.propertyName}</h6>
              <span className="cn-text-caption text-muted-foreground tabular-nums">
                {t('ownerConstellation.counters', '{{actions}} actions · {{suggestions}} suggestions', {
                  actions: property.actionsLast30Days,
                  suggestions: property.suggestionsLast30Days,
                })}
              </span>
            </Stack>
            <Stack spacing={0.75} sx={{ mt: 1, pl: 1.5, borderLeft: '1px solid', borderColor: accent }}>
              {property.recent.length === 0 && (
                <p className="cn-text-body2 text-muted-foreground">
                  {t('ownerConstellation.noPropertyActivity', 'Rien à signaler sur ce bien.')}
                </p>
              )}
              {property.recent.map((line, index) => (
                <Stack key={index} direction="row" spacing={1.5} alignItems="baseline">
                  <span className="cn-text-caption text-muted-foreground whitespace-nowrap tabular-nums">
                    {dateLabel(line.createdAt)}
                  </span>
                  <p className="cn-text-body2">{line.summary || line.moduleKey}</p>
                </Stack>
              ))}
            </Stack>
          </div>
        ))}
      </Stack>

      <Divider sx={{ my: 4 }} />

      <span className="cn-text-caption text-muted-foreground">
        {t('ownerConstellation.footer', 'Rapport préparé par {{name}}.', { name: conciergerieName })}
      </span>
    </Container>
  );
}
