import { useRef, useState } from 'react';
import { CheckCircle, Download, MoreHorizontal, Pencil, RefreshCw, Trash2, Upload } from 'lucide-react';
import { Alert, AlertDescription, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Field, FieldLabel, Input, Textarea } from '../../components/ui';
import ConfirmationModal from '../../components/ConfirmationModal';
import { documentsApi, type DocumentTemplate } from '../../services/api/documentsApi';
import { useActivateTemplate, useDeleteTemplate, useReparseTemplate, useReplaceTemplateFile, useUpdateTemplate } from './hooks/useDocuments';
import { useTranslation } from '../../hooks/useTranslation';

/** La gestion reste disponible depuis la liste, sans occuper le panneau PDF. */
export default function TemplateRowActions({ template, onError }: { template: DocumentTemplate; onError: (message: string | null) => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState({ name: '', description: '', emailSubject: '', emailBody: '' });
  const fileInput = useRef<HTMLInputElement>(null);
  const update = useUpdateTemplate();
  const activate = useActivateTemplate();
  const reparse = useReparseTemplate();
  const replace = useReplaceTemplateFile();
  const remove = useDeleteTemplate();
  const busy = update.isPending || activate.isPending || reparse.isPending || replace.isPending || remove.isPending;
  const name = template.name.replace(/\bclenzy\b/gi, 'Baitly');
  async function run(action: () => Promise<unknown>) {
    onError(null);
    try { await action(); } catch (error) { onError(error instanceof Error ? error.message : t('common.error')); }
  }
  return <>
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" disabled={busy}
      aria-label={`${t('documents.details.moreActions')} · ${name}`} title={t('documents.details.moreActions')}><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => { setEditError(null); setDraft({ name, description: template.description || '', emailSubject: template.emailSubject || '', emailBody: template.emailBody || '' }); setEditing(true); }}><Pencil />{t('common.edit')}</DropdownMenuItem>
        {!template.active && <DropdownMenuItem onSelect={() => void run(() => activate.mutateAsync(template.id))}><CheckCircle />{t('documentsWorkspace.activate')}</DropdownMenuItem>}
        <DropdownMenuItem onSelect={() => void run(() => documentsApi.downloadTemplateOriginal(template.id, template.originalFilename.replace(/\.odt$/i, '.html')))}><Download />{t('documents.details.downloadSource')}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => fileInput.current?.click()}><Upload />{t('documents.replaceFile')}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void run(() => reparse.mutateAsync(template.id))}><RefreshCw />{t('documents.details.rescanTags')}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}><Trash2 />{t('common.delete')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <input ref={fileInput} type="file" accept=".html,text/html" className="hidden" onChange={event => {
      const next = event.target.files?.[0]; event.target.value = ''; if (!next) return;
      if (!next.name.toLowerCase().endsWith('.html') || (next.type && next.type !== 'text/html')) { onError(t('documents.onlyOdt')); return; }
      if (!next.size || next.size > 5 * 1024 * 1024) { onError(t('documents.htmlSizeLimit')); return; }
      onError(null); setFile(next);
    }} />
    <Dialog open={editing} onOpenChange={value => { if (!update.isPending) setEditing(value); }}>
      <DialogContent><DialogHeader><DialogTitle>{t('common.edit')} · {name}</DialogTitle></DialogHeader>
        <form onSubmit={async event => {
          event.preventDefault(); setEditError(null);
          try { await update.mutateAsync({ id: template.id, data: { ...draft, name: draft.name.trim() } }); setEditing(false); }
          catch (error) { setEditError(error instanceof Error ? error.message : t('common.error')); }
        }} className="flex flex-col gap-4">
          {editError && <Alert variant="destructive" role="alert"><AlertDescription>{editError}</AlertDescription></Alert>}
          <Field><FieldLabel htmlFor={`template-name-${template.id}`}>{t('common.name')}</FieldLabel><Input id={`template-name-${template.id}`} required value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></Field>
          <Field><FieldLabel htmlFor={`template-description-${template.id}`}>{t('common.description')}</FieldLabel><Textarea id={`template-description-${template.id}`} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></Field>
          <Field><FieldLabel htmlFor={`template-subject-${template.id}`}>{t('messaging.templates.subject')}</FieldLabel><Input id={`template-subject-${template.id}`} value={draft.emailSubject} onChange={e => setDraft({ ...draft, emailSubject: e.target.value })} /></Field>
          <Field><FieldLabel htmlFor={`template-body-${template.id}`}>{t('messaging.templates.editor.body')}</FieldLabel><Textarea id={`template-body-${template.id}`} value={draft.emailBody} onChange={e => setDraft({ ...draft, emailBody: e.target.value })} /></Field>
          <DialogFooter><Button type="button" variant="ghost" disabled={update.isPending} onClick={() => setEditing(false)}>{t('common.cancel')}</Button><Button type="submit" disabled={update.isPending || !draft.name.trim()}>{t('common.save')}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <ConfirmationModal open={!!file} onClose={() => setFile(null)} loading={replace.isPending}
      onConfirm={() => run(async () => { if (file) { await replace.mutateAsync({ id: template.id, file }); setFile(null); } })}
      title={t('documents.details.replaceTitle')} message={t('documents.details.replaceMessage', { name: file?.name })}
      confirmText={t('documents.details.replace')} cancelText={t('common.cancel')} severity="info" />
    <ConfirmationModal open={deleting} onClose={() => setDeleting(false)} loading={remove.isPending}
      onConfirm={() => run(async () => { await remove.mutateAsync(template.id); setDeleting(false); })}
      title={t('documents.details.deleteTitle')} message={t('documents.details.deleteMessage', { name })}
      confirmText={t('common.delete')} cancelText={t('common.cancel')} severity="error" />
  </>;
}
