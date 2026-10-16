import { useTranslation } from '../../../hooks/useTranslation';
import IssueMapRow from './IssueMapRow';
import { useIssueDetail } from './IssuesMapList';
import { useOpenIssues } from './mapViewData';

/** Bas de fiche de la vue Anomalies : anomalies à traiter du logement, les plus graves d'abord. */
export default function PropertyIssues({ propertyId, range }: { propertyId: number; range?: { from?: string; to?: string } }) {
  const { t } = useTranslation();
  const query = useOpenIssues();
  const { openIssue, dialog } = useIssueDetail();
  const issues = (query.data ?? []).filter((issue) => issue.propertyId === propertyId
    && (!range?.from || issue.createdAt.slice(0, 10) >= range.from) && (!range?.to || issue.createdAt.slice(0, 10) <= range.to));
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-2.5" aria-label={t('propertyMap.views.issues', 'Anomalies')}>
      <h4 className="m-0 text-xs font-semibold text-foreground">{t('propertyMap.issuesTitle', 'Anomalies à traiter')}</h4>
      {query.isLoading && <p role="status" className="m-0 text-xs text-muted-foreground">{t('propertyMap.issuesLoading', 'Chargement des anomalies…')}</p>}
      {query.isError && <p role="alert" className="m-0 text-xs text-[var(--bui-destructive-ink)]">{t('propertyMap.issuesLoadError', 'Les anomalies n’ont pas pu être chargées.')}</p>}
      {query.data && issues.length === 0 && <p className="m-0 text-xs text-muted-foreground">{t('propertyMap.noIssue', 'Aucune anomalie à traiter.')}</p>}
      {issues.length > 0 && (
        <ul className="m-0 flex max-h-52 list-none flex-col overflow-y-auto overscroll-contain p-0">
          {issues.map((issue) => <li key={issue.id}><IssueMapRow issue={issue} onOpen={openIssue} showProperty={false} compact /></li>)}
        </ul>
      )}
      {dialog}
    </section>
  );
}
