import React from 'react';
import StatusChip, { type StatusTone } from '../../../components/StatusChip';
import { cn } from '../../../utils/cn';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
  Skeleton,
} from '../../../components/ui';
import {
  ErrorOutline, WarningAmber, InfoOutlined,
} from '../../../icons';
import GridSection from './GridSection';
import { useTranslation } from '../../../hooks/useTranslation';
import type { BusinessAlert, AlertSeverity } from '../../../hooks/useAnalyticsEngine';

// ─── Constants ──────────────────────────────────────────────────────────────

const SEVERITY_ICONS: Record<AlertSeverity, React.ReactNode> = {
  critical: <ErrorOutline />,
  warning: <WarningAmber />,
  info: <InfoOutlined />,
};

/**
 * La severite est un ensemble FERME : ses classes s'ecrivent en toutes lettres
 * plutot que d'etre fabriquees a l'execution — Tailwind emet ses utilities en
 * scannant les sources, une classe construite depuis une variable n'existerait
 * pas. C'est aussi ce qui permet de sortir des styles inline d'origine.
 *
 * Couple `-soft` / teinte vive pour la pastille d'icone, `-ink` pour le TEXTE :
 * la teinte vive plafonne a ~2,2:1 en clair (§2.4 du contrat Baitly UI).
 */
const SEVERITY_STYLES: Record<AlertSeverity, { media: string; ink: string; tone: StatusTone }> = {
  critical: { media: 'bg-destructive-soft text-destructive', ink: 'text-destructive-ink', tone: 'err' },
  warning: { media: 'bg-warning-soft text-warning', ink: 'text-warning-ink', tone: 'warn' },
  info: { media: 'bg-info-soft text-info', ink: 'text-info-ink', tone: 'info' },
};

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critical: 'Critique',
  warning: 'Attention',
  info: 'Info',
};

interface Props {
  data: BusinessAlert[] | null;
  loading: boolean;
}

const AnalyticsAlerts: React.FC<Props> = React.memo(({ data, loading }) => {
  const { t } = useTranslation();

  const alerts = data || [];
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;

  return (
    <GridSection
      title={t('dashboard.analytics.alerts')}
      subtitle={t('dashboard.analytics.alertsDesc')}
      badge={criticalCount}
    >
      <div className="grid grid-cols-12 gap-[9px]">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div className="col-span-12" key={i}>
              <Skeleton className="h-[74px] w-full rounded-lg" />
            </div>
          ))
        ) : alerts.length === 0 ? (
          <div className="col-span-12">
            <Empty className="p-4">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="bg-success-soft text-success">
                  <InfoOutlined />
                </EmptyMedia>
                <EmptyTitle>{t('dashboard.analytics.noAlerts')}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          alerts.map((alert) => {
            const severity = SEVERITY_STYLES[alert.severity];
            return (
              <div className="col-span-12" key={alert.id}>
                {/* L'etat se dit par la pastille d'icone et la puce de statut —
                    jamais par un lisere lateral (interdit produit §5). */}
                <Item variant="outline" size="xs" className="items-start bg-card">
                  <ItemMedia variant="icon" className={cn('size-7 rounded-md', severity.media)}>
                    {SEVERITY_ICONS[alert.severity]}
                  </ItemMedia>
                  <ItemContent className="gap-0.5">
                    <div className="flex items-center gap-1">
                      <ItemTitle className="flex-1 text-xs font-semibold leading-[1.3]">
                        {alert.title}
                      </ItemTitle>
                      <StatusChip size="sm" tone={severity.tone} label={SEVERITY_LABELS[alert.severity]} />
                    </div>
                    <ItemDescription className="text-2xs leading-[1.4]">
                      {alert.description}
                    </ItemDescription>
                    <p
                      className={cn(
                        'text-2xs font-semibold',
                        severity.ink,
                        alert.route ? 'cursor-pointer hover:underline' : 'cursor-default',
                      )}
                    >
                      {alert.action}
                    </p>
                  </ItemContent>
                </Item>
              </div>
            );
          })
        )}
      </div>
    </GridSection>
  );
});

AnalyticsAlerts.displayName = 'AnalyticsAlerts';

export default AnalyticsAlerts;
