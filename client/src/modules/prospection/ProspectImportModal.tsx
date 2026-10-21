import React, { useId, useState } from 'react';
import { Alert, AlertDescription, Button, Field, FieldLabel, Input, Textarea } from '../../components/ui';
import { useImportProspects } from '../../hooks/useProspects';
import { useTranslation } from '../../hooks/useTranslation';
import { BAITLY_CRM_CATEGORIES, BaitlyCrmSelect, baitlyCrmError } from './BaitlyCrmFields';

export default function ProspectImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation(); const id = useId();
  const [file,setFile] = useState<File>(); const [category,setCategory] = useState('OWNERS');
  const [provenance,setProvenance] = useState(''); const upload = useImportProspects();
  if (!open) return null;
  return <form className="space-y-4" onSubmit={(event) => {
    event.preventDefault(); if (file) upload.mutate({ file, category, provenance });
  }}>
    <h2 className="text-base font-semibold text-balance">{t('baitlyCrm.import')}</h2>
    <p className="text-sm text-muted-foreground">{t('baitlyCrm.csvHelp')}</p>
    <fieldset disabled={upload.isPending} className="grid min-w-0 gap-4 sm:grid-cols-2">
      <BaitlyCrmSelect label={t('baitlyCrm.category')} value={category} values={BAITLY_CRM_CATEGORIES} onChange={setCategory} />
      <Field><FieldLabel htmlFor={id + 'file'}>{t('baitlyCrm.file')}</FieldLabel>
        <Input id={id + 'file'} type="file" accept=".csv,text/csv" required className="cursor-pointer" onChange={(e) => { setFile(e.target.files?.[0]); upload.reset(); }} /></Field>
      <Field className="sm:col-span-2"><FieldLabel htmlFor={id + 'source'}>{t('baitlyCrm.sourceDetail')}</FieldLabel>
        <Textarea id={id + 'source'} required maxLength={1000} value={provenance} onChange={(e) => setProvenance(e.target.value)} /></Field>
    </fieldset>
    {upload.isError && <Alert variant="destructive"><AlertDescription>{baitlyCrmError(upload.error,t('baitlyCrm.importError'))}</AlertDescription></Alert>}
    {upload.data && <div role="status" className="space-y-2 text-sm tabular-nums">
      <p>{t('baitlyCrm.importReport',{ ...upload.data })}</p>
      {upload.data.issues.length > 0 && <p>{t('baitlyCrm.invalidRows')} {upload.data.issues.map((issue) => issue.line).join(', ')}</p>}
    </div>}
    <p className="text-xs text-muted-foreground">{t('baitlyCrm.noAutomaticConsent')}</p>
    <div className="flex flex-wrap gap-2">
      <Button type="submit" disabled={!file || upload.isPending || upload.isSuccess} className="cursor-pointer">{t('baitlyCrm.import')}</Button>
      <Button type="button" variant="outline" onClick={onClose} disabled={upload.isPending} className="cursor-pointer">{t('common.close')}</Button>
    </div>
  </form>;
}
