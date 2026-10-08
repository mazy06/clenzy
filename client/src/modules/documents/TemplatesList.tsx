import { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription, Button, NativeSelect, NativeSelectOption } from '../../components/ui';
import DocumentsHeaderControls from './components/DocumentsHeaderControls';
import { useScreenSearch } from '../../components/ScreenChrome';
import { useTemplates } from './hooks/useDocuments';
import TemplateUpload from './TemplateUpload';
import TemplatePdfPreview from './TemplatePdfPreview';
import TemplateRowActions from './TemplateRowActions';
import { useTranslation } from '../../hooks/useTranslation';
import DocumentsWorkspace, { documentArtwork, DocumentsLoading } from './components/DocumentsWorkspace';

export interface TemplatesListRef { fetchTemplates: () => void; openUpload: () => void }
interface Props { uploadRequested?: boolean; onUploadHandled?: () => void }
const TemplatesList = forwardRef<TemplatesListRef, Props>(({ uploadRequested, onUploadHandled }, ref) => {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('template');
  const select = (id: string | null) => setParams(previous => {
    const next = new URLSearchParams(previous);
    if (id) next.set('template', id); else next.delete('template');
    return next;
  }, { replace: true });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [state, setState] = useState('all');
  const { data: templates = [], isLoading, error, refetch } = useTemplates();
  useScreenSearch(search, setSearch, t('documentsWorkspace.searchTemplate'));
  useImperativeHandle(ref, () => ({ fetchTemplates: () => { void refetch(); }, openUpload: () => setUploadOpen(true) }));
  useEffect(() => { if (uploadRequested) { setUploadOpen(true); onUploadHandled?.(); } }, [uploadRequested, onUploadHandled]);
  const rows = templates.filter(row => (state === 'all' || row.active === (state === 'active'))
    && `${row.name} ${row.description} ${row.documentType}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <>
    <DocumentsHeaderControls count={rows.length}>
      <NativeSelect aria-label={t('messaging.templates.status')} value={state} onChange={e => setState(e.target.value)}>
        <NativeSelectOption value="all">{t('documentsWorkspace.allStates')}</NativeSelectOption>
        <NativeSelectOption value="active">{t('messaging.templates.active')}</NativeSelectOption>
        <NativeSelectOption value="inactive">{t('messaging.templates.inactive')}</NativeSelectOption>
      </NativeSelect>
    </DocumentsHeaderControls>
    {(actionError || error) && <Alert variant="destructive" role="alert" className="mb-3"><AlertDescription>{actionError || t('documentsWorkspace.loadError')}</AlertDescription><Button variant="ghost" onClick={() => { setActionError(null); void refetch(); }}>{t('common.retry')}</Button></Alert>}
    {isLoading ? <DocumentsLoading /> : !error && <DocumentsWorkspace autoPaginate key={`${state}:${search}`} label={t('documentsWorkspace.views.library')}
      records={rows.map(row => ({
        id: String(row.id), title: row.name, subtitle: row.description, meta: `v${row.version}`, image: documentArtwork(row.documentType),
        status: { value: row.active ? 'ACTIVE' : 'INACTIVE', label: t(row.active ? 'messaging.templates.active' : 'messaging.templates.inactive') },
        listActions: <TemplateRowActions template={row} onError={setActionError} />,
        detail: null,
      }))}
      selectedId={selectedId} onSelect={select}
      renderDetail={record => {
        const template = rows.find(row => String(row.id) === record.id)!;
        return <TemplatePdfPreview key={template.id} id={template.id} name={template.name} version={template.version} />;
      }}
      />}
    <TemplateUpload open={uploadOpen} onClose={() => setUploadOpen(false)} onSuccess={() => setUploadOpen(false)} />
  </>;
});
TemplatesList.displayName = 'TemplatesList';
export default TemplatesList;
