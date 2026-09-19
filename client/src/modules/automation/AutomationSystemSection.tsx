import {
  Badge,
  Button,
  Skeleton,
  Alert,
  AlertDescription,
} from '../../components/ui';
import NavCountBadge from '../../components/NavCountBadge';
import { Lock, ArrowForward } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useSystemAutomations } from '../../hooks/useAutomationRules';

export default function AutomationSystemSection() {
  const { t } = useTranslation();
  const {
    data: automations = [],
    isLoading,
    isError,
    refetch,
  } = useSystemAutomations();
  return (
    <section
      className="automation-system"
      aria-labelledby="automation-system-heading"
    >
      <div className="automation-section-heading">
        <div>
          <div className="automation-section-title">
            <h2 id="automation-system-heading">
              {t('automation.system.title', 'Automatisations système')}
            </h2>
            {!isLoading && !isError && (
              <NavCountBadge className="text-xs" count={automations.length} />
            )}
          </div>
          <p>
            {t(
              'automation.system.subtitle',
              'Mécanismes gérés par Baitly. Leur état est consultable ici.',
            )}
          </p>
        </div>
        <Badge variant="outline">
          <Lock size={12} aria-hidden />
          {t('automation.system.readOnly', 'Lecture seule')}
        </Badge>
      </div>
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {t(
              'automation.system.error',
              'Impossible de charger les automatisations système.',
            )}
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              {t('common.retry', 'Réessayer')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <ul className="automation-system-list">
          {automations.map((automation) => (
            <li key={automation.key}>
              <div>
                <h3>{automation.label}</h3>
                <p className="automation-meta">{automation.description}</p>
              </div>
              <div className="automation-system-flow">
                <span>{automation.triggerLabel}</span>
                <ArrowForward size={14} className="cn-rtl-flip" aria-hidden />
                <span>{automation.actionLabel}</span>
              </div>
              <div className="automation-system-status">
                <Badge variant="secondary">{automation.statusLabel}</Badge>
                <span className="automation-meta">{automation.mechanism}</span>
              </div>
            </li>
          ))}
          {!automations.length && (
            <li>
              {t(
                'automation.system.empty',
                'Aucune automatisation système disponible.',
              )}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
