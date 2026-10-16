import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '../../../components/ui';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../hooks/useTranslation';
import { MANAGER_ROLES } from '../../../constants/roles';
import type { Issue } from '../../../services/api/issuesApi';
import IssueDetailDialog from '../../work-orders/IssueDetailDialog';
import IssueMapRow from './IssueMapRow';
import { MapLinkedRow } from './MapRowInteractions';

/** Ouvre le détail d'une anomalie (qualifier, convertir, rejeter) et relit la carte après une action. */
export function useIssueDetail() {
  const { hasAnyRole } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<Issue | null>(null);
  const dialog = (
    <IssueDetailDialog issue={open} canManage={hasAnyRole([...MANAGER_ROLES])} onClose={() => setOpen(null)}
      onUpdated={(updated) => {
        setOpen(updated);
        void queryClient.invalidateQueries({ queryKey: ['issues'] });
      }} />
  );
  return { openIssue: setOpen, dialog };
}

/** Liste de la vue Anomalies : les anomalies à traiter des logements de la zone visible, les plus graves d'abord. */
export default function IssuesMapList({ issues, allIssues, loading, failed }: {
  issues: Issue[];
  /** Toutes les anomalies à traiter, pour ouvrir celle d'un lien (`?issue=`) même hors de la zone visible. */
  allIssues: Issue[];
  loading: boolean;
  failed: boolean;
}) {
  const { t } = useTranslation();
  const { openIssue, dialog } = useIssueDetail();
  const [params, setParams] = useSearchParams();
  const linked = params.get('issue');
  useEffect(() => {
    const target = linked ? allIssues.find((issue) => issue.id === Number(linked)) : undefined;
    if (!target) return;
    openIssue(target);
    setParams((previous) => { const next = new URLSearchParams(previous); next.delete('issue'); return next; }, { replace: true });
  }, [linked, allIssues, openIssue, setParams]);
  if (loading) return <div className="space-y-2 p-3" role="status"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>;
  if (failed) return <p role="alert" className="m-0 p-3 text-sm text-[var(--bui-destructive-ink)]">{t('propertyMap.issuesLoadError', 'Les anomalies n’ont pas pu être chargées.')}</p>;
  return (
    <>
      {issues.length === 0 && <p className="m-0 p-3 text-sm text-muted-foreground">{t('propertyMap.issuesEmpty', 'Aucune anomalie à traiter dans cette zone.')}</p>}
      {issues.map((issue) => <MapLinkedRow key={issue.id} propertyId={issue.propertyId}><IssueMapRow issue={issue} onOpen={openIssue} /></MapLinkedRow>)}
      {dialog}
    </>
  );
}
