import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileCheck2 } from 'lucide-react';
import { Alert, AlertDescription, Button, Skeleton } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useCommerceScope } from '../../hooks/useCommerceScope';
import { useTranslation } from '../../hooks/useTranslation';
import { useScreenSearch } from '../../components/ScreenChrome';
import { useTemplates } from './hooks/useDocuments';
import apiClient from '../../services/apiClient';
import { documentsApi, type ComplianceReport, type DocumentTemplate } from '../../services/api/documentsApi';
import DocumentsWorkspace, { documentArtwork, DocumentFacts, DocumentsLoading } from './components/DocumentsWorkspace';
import DocumentStatusIcon from './components/DocumentStatusIcon';
import PagePagination from '../../components/PagePagination';

export default function BaitlyTemplateQuality() {
  const { hasAnyRole } = useAuth();
  return hasAnyRole(['SUPER_ADMIN']) ? <Quality /> : null;
}
function Quality() {
  const { t } = useTranslation(); const scope = useCommerceScope(); const templates = useTemplates();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  useScreenSearch(search, value => { setSearch(value); setPage(0); }, t('documentsWorkspace.searchTemplate'));
  const rows = (templates.data ?? []).filter(row => row.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const visiblePage = Math.min(page, Math.max(0, Math.ceil(rows.length / 12) - 1));
  if (templates.isPending) return <DocumentsLoading />;
  if (templates.error) return <Alert variant="destructive" role="alert"><AlertDescription>{t('documentsWorkspace.loadError')}</AlertDescription><Button variant="ghost" onClick={() => void templates.refetch()}>{t('common.retry')}</Button></Alert>;
  return <DocumentsWorkspace label={t('documentVerification.templateTitle')} records={rows.slice(visiblePage * 12, (visiblePage + 1) * 12).map(row => ({
      id: String(row.id), title: row.name, subtitle: row.description, image: documentArtwork(row.documentType), meta: `v${row.version}`,
      detail: <QualityResult key={`${scope}:${row.id}:${row.version}`} template={row} />,
    }))} pagination={<PagePagination page={visiblePage} count={rows.length} rowsPerPage={12} onPageChange={setPage} />} />;
}
function QualityResult({ template }: { template: DocumentTemplate }) {
  const { t } = useTranslation(); const scope = useCommerceScope(); const client = useQueryClient();
  const key = ['template-quality', scope, String(template.id), template.version];
  const query = useQuery({ queryKey: key, enabled: !!scope, retry: false,
    queryFn: () => apiClient.get<ComplianceReport | null>(`/documents/templates/${template.id}/compliance-check`) });
  const check = useMutation({ mutationFn: () => documentsApi.checkTemplateCompliance(template.id), onSuccess: value => { client.setQueryData(key, value); } });
  return <>
    <Button size="sm" disabled={check.isPending || query.isPending} onClick={() => check.mutate()}><FileCheck2 size={16} />{t('documentVerification.templateCheck')}</Button>
    <DocumentFacts items={[{ label: t('documentsWorkspace.file'), value: template.originalFilename }, { label: t('messaging.templates.version'), value: `v${template.version}` }]} />
    {query.isPending && <Skeleton className="h-16 w-full" />}
    {(query.error || check.error) && <Alert variant="destructive" role="alert"><AlertDescription>{(query.error || check.error)?.message}</AlertDescription></Alert>}
    {query.isSuccess && !query.data && <p>{t('documentVerification.templateUnchecked')}</p>}
    {query.data && <div role="status"><div className="flex items-center gap-3"><DocumentStatusIcon value={query.data.compliant ? 'CHECKED' : 'BLOCKED'} label={t(query.data.compliant ? 'documentVerification.templateOk' : 'documentVerification.templateBlocked')} />
      <h3>{t(query.data.compliant ? 'documentVerification.templateOk' : 'documentVerification.templateBlocked')}</h3></div>
      <ul className="mt-3 list-disc space-y-2 ps-4">{[...query.data.missingTags, ...query.data.missingMentions, ...query.data.warnings].map((value, i) => <li key={i}>{value}</li>)}</ul>
    </div>}
  </>;
}
