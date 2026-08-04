import React, { useEffect, useState } from 'react';
import { Button, Card, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, NativeSelect, NativeSelectOption, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui';
import { Add, DeleteOutline, Edit, GppGood } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import {
  propertyLicensesApi,
  type PropertyLicense,
  type PropertyLicenseRequest,
} from '../../services/api/propertyLicensesApi';

interface Props {
  propertyId: number;
  canEdit: boolean;
}

const TYPE_LABELS: Record<PropertyLicense['licenseType'], string> = {
  SHORT_TERM_RENTAL: 'Licence courte durée',
  TOURISM_REGISTRATION: 'Enregistrement touristique',
  SAFETY_CERT: 'Certificat de sécurité',
  OTHER: 'Autre autorisation',
};

const EMPTY_FORM: PropertyLicenseRequest = {
  licenseType: 'SHORT_TERM_RENTAL',
  licenseNumber: null,
  issuedBy: null,
  issuedAt: null,
  expiresAt: null,
  renewalLeadDays: 60,
  documentRef: null,
  notes: null,
};

/**
 * Fiche logement > Conformité — saisie des licences/autorisations (vague M-A des
 * modèles métier). C'est CETTE saisie qui alimente la carte « licence expire »
 * de l'agent Conformité de la constellation : l'échéance + le délai d'alerte.
 */
export default function PropertyComplianceTab({ propertyId, canEdit }: Props) {
  const { t } = useTranslation();
  const [licenses, setLicenses] = useState<PropertyLicense[] | null>(null);
  const [editing, setEditing] = useState<{ id: number | null; form: PropertyLicenseRequest } | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = React.useCallback(() => {
    propertyLicensesApi.list(propertyId).then(setLicenses).catch(() => setLicenses([]));
  }, [propertyId]);

  useEffect(() => { reload(); }, [reload]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.id == null) {
        await propertyLicensesApi.create(propertyId, editing.form);
      } else {
        await propertyLicensesApi.update(propertyId, editing.id, editing.form);
      }
      setEditing(null);
      reload();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    await propertyLicensesApi.remove(propertyId, id);
    reload();
  };

  const setField = <K extends keyof PropertyLicenseRequest>(key: K, value: PropertyLicenseRequest[K]) =>
    setEditing((prev) => (prev ? { ...prev, form: { ...prev.form, [key]: value } } : prev));

  if (licenses === null) {
    return (
      <div className="flex justify-center py-9">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GppGood size={18} strokeWidth={1.75} className="text-[var(--muted)]" />
          <h3 className="m-0 text-[13.5px] font-semibold">
            {t('properties.compliance.title', 'Licences & autorisations')}
          </h3>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setEditing({ id: null, form: EMPTY_FORM })}>
            <Add size={15} />
            {t('properties.compliance.add', 'Ajouter')}
          </Button>
        )}
      </div>

      {licenses.length === 0 ? (
        <p className="m-0 py-4 text-[12.5px] text-[var(--muted)]">
          {t('properties.compliance.empty',
            "Aucune licence enregistrée. L'échéance saisie ici alimente l'alerte de renouvellement de l'agent Conformité.")}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('properties.compliance.type', 'Type')}</TableHead>
              <TableHead>{t('properties.compliance.number', 'Numéro')}</TableHead>
              <TableHead>{t('properties.compliance.issuedBy', 'Émise par')}</TableHead>
              <TableHead>{t('properties.compliance.expiresAt', 'Échéance')}</TableHead>
              <TableHead>{t('properties.compliance.lead', 'Alerte à J-')}</TableHead>
              {canEdit && <TableHead aria-label="actions" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {licenses.map((license) => (
              <TableRow key={license.id}>
                <TableCell>{TYPE_LABELS[license.licenseType]}</TableCell>
                <TableCell className="tabular-nums">{license.licenseNumber ?? '—'}</TableCell>
                <TableCell>{license.issuedBy ?? '—'}</TableCell>
                <TableCell className="tabular-nums">{license.expiresAt ?? '—'}</TableCell>
                <TableCell className="tabular-nums">{license.renewalLeadDays}</TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost" size="icon-sm"
                      aria-label={t('common.edit', 'Modifier')}
                      onClick={() => setEditing({
                        id: license.id,
                        form: {
                          licenseType: license.licenseType,
                          licenseNumber: license.licenseNumber,
                          issuedBy: license.issuedBy,
                          issuedAt: license.issuedAt,
                          expiresAt: license.expiresAt,
                          renewalLeadDays: license.renewalLeadDays,
                          documentRef: license.documentRef,
                          notes: license.notes,
                        },
                      })}
                    >
                      <Edit size={15} />
                    </Button>
                    <Button
                      variant="ghost" size="icon-sm"
                      aria-label={t('common.delete', 'Supprimer')}
                      onClick={() => remove(license.id)}
                    >
                      <DeleteOutline size={15} />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {editing && (
        <Dialog open onOpenChange={(next) => { if (!next && !saving) setEditing(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing.id == null
                  ? t('properties.compliance.addTitle', 'Ajouter une licence')
                  : t('properties.compliance.editTitle', 'Modifier la licence')}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-1">
              <label className="grid gap-1 text-[12px] font-medium">
                {t('properties.compliance.type', 'Type')}
                <NativeSelect
                  value={editing.form.licenseType}
                  onChange={(e) => setField('licenseType', e.target.value as PropertyLicense['licenseType'])}
                >
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
              <label className="grid gap-1 text-[12px] font-medium">
                {t('properties.compliance.number', 'Numéro')}
                <Input
                  value={editing.form.licenseNumber ?? ''}
                  onChange={(e) => setField('licenseNumber', e.target.value || null)}
                />
              </label>
              <label className="grid gap-1 text-[12px] font-medium">
                {t('properties.compliance.issuedBy', 'Émise par')}
                <Input
                  value={editing.form.issuedBy ?? ''}
                  onChange={(e) => setField('issuedBy', e.target.value || null)}
                  placeholder={t('properties.compliance.issuedByHint', 'Commune, préfecture, DGSN…')}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-[12px] font-medium">
                  {t('properties.compliance.issuedAt', 'Délivrée le')}
                  <Input
                    type="date"
                    value={editing.form.issuedAt ?? ''}
                    onChange={(e) => setField('issuedAt', e.target.value || null)}
                  />
                </label>
                <label className="grid gap-1 text-[12px] font-medium">
                  {t('properties.compliance.expiresAt', 'Échéance')}
                  <Input
                    type="date"
                    value={editing.form.expiresAt ?? ''}
                    onChange={(e) => setField('expiresAt', e.target.value || null)}
                  />
                </label>
              </div>
              <label className="grid gap-1 text-[12px] font-medium">
                {t('properties.compliance.leadLong', "Alerte de renouvellement (jours avant l'échéance)")}
                <Input
                  type="number" min={0} max={365}
                  value={editing.form.renewalLeadDays}
                  onChange={(e) => setField('renewalLeadDays', Number(e.target.value) || 0)}
                />
              </label>
              <label className="grid gap-1 text-[12px] font-medium">
                {t('properties.compliance.notes', 'Notes')}
                <Input
                  value={editing.form.notes ?? ''}
                  onChange={(e) => setField('notes', e.target.value || null)}
                />
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" disabled={saving} onClick={() => setEditing(null)}>
                {t('common.cancel', 'Annuler')}
              </Button>
              <Button disabled={saving} onClick={save}>
                {saving ? <Spinner className="size-[13px]" /> : null}
                {t('common.save', 'Enregistrer')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
