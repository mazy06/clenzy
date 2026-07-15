import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  Container,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
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
    <Box sx={{ minWidth: 140 }}>
      <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4 }}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  );
}

export default function PublicOwnerConstellation() {
  const { token } = useParams<{ token: string }>();
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<OwnerConstellationView | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');

  useEffect(() => {
    if (!token) {
      setState('notfound');
      return;
    }
    fetchView(token)
      .then((data) => {
        if (data === null) {
          setState('notfound');
        } else {
          setView(data);
          setState('ready');
        }
      })
      .catch(() => setState('error'));
  }, [token]);

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
      <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (state === 'notfound' || state === 'error' || !view) {
    return (
      <Container maxWidth="sm" sx={{ py: 10, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          {t('ownerConstellation.invalidTitle', 'Lien invalide ou expiré')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(
            'ownerConstellation.invalidBody',
            'Ce lien de suivi n’est plus actif. Contactez votre conciergerie pour en obtenir un nouveau.'
          )}
        </Typography>
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
        <Box>
          {brandingLogoUrl && (
            <Box
              component="img"
              src={brandingLogoUrl}
              alt={conciergerieName}
              sx={{ maxHeight: 44, maxWidth: 220, display: 'block', mb: 1 }}
            />
          )}
          <Typography variant="h5" sx={{ textWrap: 'balance' }}>
            {conciergerieName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('ownerConstellation.subtitle', 'Espace propriétaire')}
            {ownerDisplayName ? ` — ${ownerDisplayName}` : ''}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {t('ownerConstellation.readOnly', 'Consultation seule')}
        </Typography>
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
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        {t('ownerConstellation.agentActivityTitle', 'Ce que nos agents ont fait pour vos biens (30 derniers jours)')}
      </Typography>

      {agentActivity.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {t('ownerConstellation.noActivity', 'Aucune activité récente à afficher.')}
        </Typography>
      )}

      <Stack spacing={3} sx={{ mt: 1 }}>
        {agentActivity.map((property) => (
          <Box key={property.propertyId}>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline">
              <Typography variant="subtitle2">{property.propertyName}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {t('ownerConstellation.counters', '{{actions}} actions · {{suggestions}} suggestions', {
                  actions: property.actionsLast30Days,
                  suggestions: property.suggestionsLast30Days,
                })}
              </Typography>
            </Stack>
            <Stack spacing={0.75} sx={{ mt: 1, pl: 1.5, borderLeft: '1px solid', borderColor: accent }}>
              {property.recent.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  {t('ownerConstellation.noPropertyActivity', 'Rien à signaler sur ce bien.')}
                </Typography>
              )}
              {property.recent.map((line, index) => (
                <Stack key={index} direction="row" spacing={1.5} alignItems="baseline">
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {dateLabel(line.createdAt)}
                  </Typography>
                  <Typography variant="body2">{line.summary || line.moduleKey}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>

      <Divider sx={{ my: 4 }} />

      <Typography variant="caption" color="text.secondary">
        {t('ownerConstellation.footer', 'Rapport préparé par {{name}}.', { name: conciergerieName })}
      </Typography>
    </Container>
  );
}
