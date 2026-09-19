import { useState } from 'react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Skeleton,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '../../components/ui';
import EmptyState from '../../components/EmptyState';
import PagePagination from '../../components/PagePagination';
import { Close, History } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useRuleExecutions } from '../../hooks/useAutomationRules';
import type { AutomationRule } from '../../services/api/automationRulesApi';
import { intlLocale } from '../../utils/localeDate';

export default function AutomationExecutionSheet({
  rule,
  onClose,
}: {
  rule: AutomationRule;
  onClose: () => void;
}) {
  const { t, currentLanguage, isArabic } = useTranslation();
  const [page, setPage] = useState(0);
  const { data, isLoading, isError, refetch } = useRuleExecutions(
    rule.id,
    page,
  );
  const dates = new Intl.DateTimeFormat(intlLocale(currentLanguage), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side={isArabic ? 'left' : 'right'}
        className="automation-sheet"
        showCloseButton={false}
      >
        <SheetHeader className="automation-sheet-header">
          <p className="automation-eyebrow">
            {t('automation.executionsTitle', 'Historique des exécutions')}
          </p>
          <SheetTitle>{rule.name}</SheetTitle>
          <SheetDescription>
            {t(
              'automation.historyDescription',
              'Retrouvez les actions effectuées et les éventuelles erreurs.',
            )}
          </SheetDescription>
          <Button
            className="automation-sheet-close"
            size="icon"
            variant="ghost"
            aria-label={t('common.close', 'Fermer')}
            onClick={onClose}
          >
            <Close size={18} />
          </Button>
        </SheetHeader>
        <div className="automation-history-body">
          {isLoading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((id) => (
                <Skeleton key={id} className="h-24 w-full" />
              ))}
            </div>
          ) : isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {t(
                  'automation.historyError',
                  'Impossible de charger l’historique.',
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void refetch()}
                >
                  {t('common.retry', 'Réessayer')}
                </Button>
              </AlertDescription>
            </Alert>
          ) : !data?.content.length ? (
            <EmptyState
              icon={<History />}
              title={t(
                'automation.noExecutions',
                'Aucune exécution pour le moment',
              )}
              description={t(
                'automation.noExecutionsDesc',
                'L’historique apparaîtra ici lorsque le déclencheur de cette règle sera rencontré.',
              )}
            />
          ) : (
            <ol className="automation-history-list">
              {data.content.map((execution) => (
                <li key={execution.id}>
                  <div className="automation-history-heading">
                    <time
                      dateTime={execution.createdAt}
                      className="tabular-nums"
                    >
                      {dates.format(new Date(execution.createdAt))}
                    </time>
                    <Badge
                      variant={
                        execution.status === 'FAILED'
                          ? 'destructive'
                          : execution.status === 'SKIPPED'
                            ? 'warning'
                            : 'secondary'
                      }
                    >
                      {t(
                        `automation.exec.statuses.${execution.status}`,
                        execution.status,
                      )}
                    </Badge>
                  </div>
                  <p>
                    {execution.guestName ||
                      t('automation.exec.noGuest', 'Action sans voyageur')}
                    {execution.reservationId ? (
                      <span className="automation-meta tabular-nums">
                        {' '}
                        · {t('automation.exec.reservation', 'Réservation')} #
                        {execution.reservationId}
                      </span>
                    ) : null}
                  </p>
                  {execution.errorMessage && (
                    <p className="automation-execution-error">
                      {execution.errorMessage}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
        <SheetFooter className="automation-history-footer">
          {!isLoading && !isError && (data?.totalElements ?? 0) > 0 && (
            <PagePagination
              count={data!.totalElements}
              page={page}
              rowsPerPage={20}
              onPageChange={setPage}
            />
          )}
          <Button variant="outline" onClick={onClose}>
            {t('common.close', 'Fermer')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
