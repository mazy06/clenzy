import React from 'react';
import StatusChip from '../../../components/StatusChip';
import { cn } from '../../../utils/cn';
import { Card, CardContent } from '../../../components/ui';
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

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: '#C97A7A',
  warning: '#D4A574',
  info: '#6B8A9A',
};

const SEVERITY_BG: Record<AlertSeverity, string> = {
  critical: 'rgba(201, 122, 122, 0.08)',
  warning: 'rgba(212, 165, 116, 0.08)',
  info: 'rgba(107, 138, 154, 0.08)',
};

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critical: 'Critique',
  warning: 'Attention',
  info: 'Info',
};

// Le `py` du gabarit Card est neutralise : la carte d'alerte porte tout son
// espacement dans son CardContent (7,5 px), comme le `p: 1.25` d'origine.
const CARD_CLASS = 'w-full py-0 transition-[border-color] duration-150';
const CARD_CONTENT_CLASS = 'p-[7.5px]';

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
              <Card className={cn(CARD_CLASS, 'opacity-50')}>
                <CardContent className={CARD_CONTENT_CLASS}>
                  <div className="h-[60px]" />
                </CardContent>
              </Card>
            </div>
          ))
        ) : alerts.length === 0 ? (
          <div className="col-span-12">
            <Card className={CARD_CLASS}>
              <CardContent className={CARD_CONTENT_CLASS}>
                <div className="flex items-center gap-1 py-1.5">
                  <div className="flex items-center justify-center min-w-[28px] h-[28px] rounded-[6px] bg-[rgba(74,_155,_142,_0.08)] text-[#4A9B8E] [&_.MuiSvgIcon-root]:text-[16px]">
                    <InfoOutlined />
                  </div>
                  <p className="cn-text-body1 text-[0.75rem] text-muted-foreground">
                    {t('dashboard.analytics.noAlerts')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          alerts.map((alert) => (
            <div className="col-span-12" key={alert.id}>
              {/* Le liseré porte la couleur de sévérité, choisie a l'execution :
                  style inline obligatoire (une classe Tailwind ne nait pas d'une variable). */}
              <Card
                className={CARD_CLASS}
                style={{
                  // Largeur et style dans le meme `style` que la couleur : poser
                  // `border-solid` en classe donnerait un style `solid` aux QUATRE
                  // cotes, dont la largeur par defaut (`medium`) n'est pas nulle
                  // faute de preflight Tailwind — soit un cadre complet non voulu.
                  borderInlineStartWidth: 3,
                  borderInlineStartStyle: 'solid',
                  borderInlineStartColor: SEVERITY_COLORS[alert.severity],
                }}
              >
                <CardContent className={CARD_CONTENT_CLASS}>
                  {/* Header */}
                  <div className="flex items-start gap-1 mb-0.5">
                    {/* bg et couleur dependent de la severite a l'execution : style inline obligatoire */}
                    <div
                      className="flex items-center justify-center min-w-[28px] h-[28px] rounded-[6px] [&_.MuiSvgIcon-root]:text-[16px]"
                      style={{ backgroundColor: SEVERITY_BG[alert.severity], color: SEVERITY_COLORS[alert.severity] }}
                    >
                      {SEVERITY_ICONS[alert.severity]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-0.5 mb-0.5">
                        <p className="cn-text-body1 text-[0.75rem] font-bold text-foreground leading-[1.3] flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                          {alert.title}
                        </p>
                        <StatusChip tokens={{ color: SEVERITY_COLORS[alert.severity], bg: SEVERITY_BG[alert.severity] }} label={SEVERITY_LABELS[alert.severity]} className="h-[16px] text-[0.5rem]" />
                      </div>
                      <p className="cn-text-body1 text-[0.625rem] text-muted-foreground leading-[1.4]">
                        {alert.description}
                      </p>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {/* couleur dependante de la severite a l'execution : style inline obligatoire */}
                    <p
                      className={cn(
                        'cn-text-body1 text-[0.5625rem] font-semibold',
                        alert.route ? 'cursor-pointer hover:underline' : 'cursor-default',
                      )}
                      style={{ color: SEVERITY_COLORS[alert.severity] }}
                    >
                      {alert.action}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))
        )}
      </div>
    </GridSection>
  );
});

AnalyticsAlerts.displayName = 'AnalyticsAlerts';

export default AnalyticsAlerts;
