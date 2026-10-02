import React, { useEffect, useState } from 'react';
import { Button, Card, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Field, FieldError, FieldLabel, Input, NativeSelect, NativeSelectOption, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Add, DeleteOutline, Edit, GppGood } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import {
  propertyLicensesApi,
  type PropertyLicense,
  type PropertyLicenseRequest,
} from '../../services/api/propertyLicensesApi';
import FrRegulatoryProfileCard from './FrRegulatoryProfileCard';

interface Props {
  propertyId: number;
  canEdit: boolean;
}

const TYPE_KEYS: Record<PropertyLicense['licenseType'], string> = {
  SHORT_TERM_RENTAL: 'properties.compliance.types.shortTermRental',
  TOURISM_REGISTRATION: 'properties.compliance.types.tourismRegistration',
  SAFETY_CERT: 'properties.compliance.types.safetyCert',
  OTHER: 'properties.compliance.types.other',
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
  const [saveError, setSaveError] = useState<string | null>(null);
  // Une licence modifiée change le statut du numéro d'enregistrement du profil France.
  const [profileRefresh, setProfileRefresh] = useState(0);

  const reload = React.useCallback(() => {
    propertyLicensesApi.list(propertyId).then(setLicenses).catch(() => setLicenses([]));
    setProfileRefresh((n) => n + 1);
  }, [propertyId]);

  useEffect(() => { reload(); }, [reload]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (editing.id == null) {
        await propertyLicensesApi.create(propertyId, editing.form);
      } else {
        await propertyLicensesApi.update(propertyId, editing.id, editing.form);
      }
      setEditing(null);
      reload();
    } catch (e) {
      // Numéro français refusé par le serveur (validation stricte) : le message dit quoi corriger.
      setSaveError((e as { message?: string })?.message ?? t('common.error', 'Erreur'));
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
    <div className="flex flex-col gap-4">
    <FrRegulatoryProfileCard propertyId={propertyId} canEdit={canEdit} refreshKey={profileRefresh} />
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GppGood size={18} strokeWidth={1.75} className="text-muted-foreground" />
          <h3 className="m-0 text-sm font-semibold tracking-tight text-foreground">
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
        <p className="m-0 py-4 text-xs text-muted-foreground">
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
                <TableCell>{t(TYPE_KEYS[license.licenseType])}</TableCell>
                <TableCell className="tabular-nums">
                  <span className="inline-flex items-center gap-1.5">
                    {license.licenseNumber ?? '—'}
                    {/* Le serveur ne se prononce que sur les formats qu'il connaît.
                        Arabie saoudite : simple avertissement (règle de source
                        secondaire). France : la saisie est refusée en amont, l'icône
                        ne signale plus qu'un numéro ancien devenu incohérent (commune
                        du logement modifiée depuis). */}
                    {(license.formatVerdict === 'MALFORMED' || license.formatVerdict === 'COMMUNE_MISMATCH') && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex text-warning-ink">
                            <TriangleAlert className="size-3.5" aria-hidden />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t(
                            'properties.compliance.formatSuspect',
                            "Ce numéro ne suit pas le format attendu pour le pays du logement",
                          )}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </span>
                </TableCell>
                <TableCell>{license.issuedBy ?? '—'}</TableCell>
                <TableCell className="tabular-nums">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5',
                      license.expiringSoon && 'font-medium text-warning-ink',
                    )}
                  >
                    {license.expiresAt ?? '—'}
                    {license.expiringSoon && (
                      <span
                        aria-label={t('properties.compliance.expiringSoon', 'Échéance proche')}
                        className="size-[7px] shrink-0 rounded-full bg-warning-ink"
                      />
                    )}
                  </span>
                </TableCell>
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
            {/* Les libellés sont associés par `htmlFor` : la boîte n'est montée
                qu'une fois à la fois, les identifiants sont donc uniques. */}
            <div className="grid gap-3 py-1">
              <Field>
                <FieldLabel htmlFor="license-type">{t('properties.compliance.type', 'Type')}</FieldLabel>
                <NativeSelect
                  id="license-type"
                  value={editing.form.licenseType}
                  onChange={(e) => setField('licenseType', e.target.value as PropertyLicense['licenseType'])}
                >
                  {Object.entries(TYPE_KEYS).map(([value, key]) => (
                    <NativeSelectOption key={value} value={value}>{t(key)}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="license-number">{t('properties.compliance.number', 'Numéro')}</FieldLabel>
                <Input
                  id="license-number"
                  value={editing.form.licenseNumber ?? ''}
                  onChange={(e) => setField('licenseNumber', e.target.value || null)}
                  placeholder={editing.form.licenseType === 'TOURISM_REGISTRATION' ? '75056000123AB' : undefined}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="license-issued-by">{t('properties.compliance.issuedBy', 'Émise par')}</FieldLabel>
                <Input
                  id="license-issued-by"
                  value={editing.form.issuedBy ?? ''}
                  onChange={(e) => setField('issuedBy', e.target.value || null)}
                  placeholder={t('properties.compliance.issuedByHint', 'Commune, préfecture, DGSN…')}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="license-issued-at">{t('properties.compliance.issuedAt', 'Délivrée le')}</FieldLabel>
                  <Input
                    id="license-issued-at"
                    type="date"
                    value={editing.form.issuedAt ?? ''}
                    onChange={(e) => setField('issuedAt', e.target.value || null)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="license-expires-at">{t('properties.compliance.expiresAt', 'Échéance')}</FieldLabel>
                  <Input
                    id="license-expires-at"
                    type="date"
                    value={editing.form.expiresAt ?? ''}
                    onChange={(e) => setField('expiresAt', e.target.value || null)}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="license-lead">
                  {t('properties.compliance.leadLong', "Alerte de renouvellement (jours avant l'échéance)")}
                </FieldLabel>
                <Input
                  id="license-lead"
                  type="number" min={0} max={365}
                  value={editing.form.renewalLeadDays}
                  onChange={(e) => setField('renewalLeadDays', Number(e.target.value) || 0)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="license-notes">{t('properties.compliance.notes', 'Notes')}</FieldLabel>
                <Input
                  id="license-notes"
                  value={editing.form.notes ?? ''}
                  onChange={(e) => setField('notes', e.target.value || null)}
                />
              </Field>
            </div>
            {saveError && <FieldError>{saveError}</FieldError>}
            <DialogFooter>
              <Button variant="outline" disabled={saving} onClick={() => { setEditing(null); setSaveError(null); }}>
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
    </div>
  );
}
