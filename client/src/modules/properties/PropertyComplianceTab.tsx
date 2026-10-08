import React, { useEffect, useState } from 'react';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Field, FieldError, FieldLabel, Input, NativeSelect, NativeSelectOption, Spinner } from '../../components/ui';
import { TriangleAlert, CircleHelp, Clock3 } from 'lucide-react';
import StatusIcon from '../../components/StatusIcon';
import { usePageHeaderActions } from '../../components/PageHeaderActionsContext';
import { PropertyTabHeading, PropertyTabLoading, PropertyTabEmpty } from './PropertyTabPrimitives';
import { PROPERTY_ART } from './propertyArtwork';
import { Add, DeleteOutline, Edit } from '../../icons';
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
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const generation = React.useRef(0);
  const [licenses, setLicenses] = useState<PropertyLicense[] | null>(null);
  const [editing, setEditing] = useState<{ id: number | null; form: PropertyLicenseRequest } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Une licence modifiée change le statut du numéro d'enregistrement du profil France.
  const [profileRefresh, setProfileRefresh] = useState(0);

  const reload = React.useCallback(() => {
    const request = ++generation.current;
    setLoadError(false);
    propertyLicensesApi.list(propertyId).then(data => {
      if (request === generation.current) setLicenses(data);
    }).catch(() => { if (request === generation.current) setLoadError(true); });
    setProfileRefresh((n) => n + 1);
  }, [propertyId]);

  useEffect(() => { setLicenses(null); setSelectedId(null); reload(); return () => { generation.current++; }; }, [reload]);

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
    setDeleting(true); setSaveError(null);
    try { await propertyLicensesApi.remove(propertyId, id); setDeleteTarget(null); reload(); }
    catch { setSaveError(t('common.error', 'Erreur')); }
    finally { setDeleting(false); }
  };

  const setField = <K extends keyof PropertyLicenseRequest>(key: K, value: PropertyLicenseRequest[K]) =>
    setEditing((prev) => (prev ? { ...prev, form: { ...prev.form, [key]: value } } : prev));

  const openEdit = (license: PropertyLicense) => {
    setSaveError(null);
    setEditing({ id: license.id, form: {
      licenseType: license.licenseType, licenseNumber: license.licenseNumber, issuedBy: license.issuedBy,
      issuedAt: license.issuedAt, expiresAt: license.expiresAt, renewalLeadDays: license.renewalLeadDays,
      documentRef: license.documentRef, notes: license.notes,
    } });
  };
  const add = () => { setSaveError(null); setEditing({ id: null, form: EMPTY_FORM }); };
  const headerActions = usePageHeaderActions(canEdit ? <Button onClick={add}><Add size={16} />{t('properties.compliance.addTitle', 'Ajouter une licence')}</Button> : null);
  const selected = licenses?.find(item => item.id === selectedId) ?? licenses?.[0];
  const status = (license: PropertyLicense) => {
    const malformed = ['MALFORMED','COMMUNE_MISMATCH'].includes(license.formatVerdict ?? '');
    const expired = license.expiresAt && new Date(license.expiresAt + 'T23:59:59').getTime() < Date.now();
    return malformed ? { icon: TriangleAlert, tone: 'destructive' as const, label: t('properties.compliance.formatSuspect') }
      : expired ? { icon: Clock3, tone: 'destructive' as const, label: t('propertyTabs.expired', 'Échéance dépassée') }
      : license.expiringSoon ? { icon: Clock3, tone: 'warning' as const, label: t('properties.compliance.expiringSoon') }
      : { icon: CircleHelp, tone: 'muted' as const, label: t('propertyTabs.recordedLicense', 'Licence enregistrée, validité à vérifier') };
  };
  return (<div className="pdt-page">
    {headerActions}
    <FrRegulatoryProfileCard propertyId={propertyId} canEdit={canEdit} refreshKey={profileRefresh} />
    <section className="pdt-surface">
      <PropertyTabHeading art={PROPERTY_ART.compliance} title={t('properties.compliance.title')}
        description={t('propertyTabs.complianceHint', 'Autorisations, échéances et justificatifs du logement.')}
        actions={canEdit && <Button variant="outline" size="sm" onClick={add}><Add size={16} />{t('properties.compliance.add')}</Button>} />
      {loadError ? <div className="p-5" role="alert"><p>{t('propertyTabs.licensesLoadError', 'Impossible de charger les licences.')}</p><Button variant="outline" onClick={reload}>{t('common.retry', 'Réessayer')}</Button></div>
        : licenses === null ? <PropertyTabLoading />
        : licenses.length === 0 ? <PropertyTabEmpty art={PROPERTY_ART.compliance} title={t('properties.compliance.title')} description={t('properties.compliance.empty')} />
        : <div className="pdt-split">
          <div className="pdt-list">
            {licenses.map(license => <div className="pdt-row" data-selected={selected?.id === license.id} key={license.id}>
              <button type="button" className="pdt-row__button" aria-pressed={selected?.id === license.id} onClick={() => { setSelectedId(license.id); setDeleteTarget(null); }}>
                <img src={PROPERTY_ART.compliance} alt="" />
                <span className="pdt-row__copy"><strong>{t(TYPE_KEYS[license.licenseType])}</strong><small>{license.licenseNumber || t('properties.frProfile.useUnset', 'Non renseigné')}</small></span>
              </button>
              <StatusIcon {...status(license)} />
            </div>)}
          </div>
          {selected && <div className="pdt-detail">
            <PropertyTabHeading art={PROPERTY_ART.compliance} title={t(TYPE_KEYS[selected.licenseType])} actions={<StatusIcon {...status(selected)} />} />
            <dl className="pdt-facts">
              <div><dt>{t('properties.compliance.number')}</dt><dd>{selected.licenseNumber || '—'}</dd></div>
              <div><dt>{t('properties.compliance.issuedBy')}</dt><dd>{selected.issuedBy || '—'}</dd></div>
              <div><dt>{t('properties.compliance.issuedAt')}</dt><dd>{selected.issuedAt || '—'}</dd></div>
              <div><dt>{t('properties.compliance.expiresAt')}</dt><dd>{selected.expiresAt || '—'}</dd></div>
              <div><dt>{t('properties.compliance.lead')}</dt><dd>{selected.renewalLeadDays}</dd></div>
              {selected.documentRef && <div><dt>{t('propertyTabs.documentRef', 'Justificatif')}</dt><dd>{selected.documentRef}</dd></div>}
            </dl>
            {selected.notes && <p className="pdt-copy mt-4">{selected.notes}</p>}
            {canEdit && <div className="pdt-detail__actions">
              <Button variant="outline" onClick={() => openEdit(selected)}><Edit size={16} />{t('common.edit')}</Button>
              <Button variant="ghost" size="icon" aria-label={t('common.delete')} onClick={() => setDeleteTarget(selected.id)}><DeleteOutline size={16} /></Button>
            </div>}
            {deleteTarget === selected.id && <div className="pdt-reply">
              <p className="text-sm mb-3">{t('propertyTabs.deleteLicense', 'Supprimer cette licence du logement ?')}</p>
              <Button variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
              <Button className="ms-2" variant="destructive" disabled={deleting} onClick={() => void remove(selected.id)}>{t('common.delete')}</Button>
              {saveError && <FieldError>{saveError}</FieldError>}
            </div>}
          </div>}
        </div>}
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
    </section>
    </div>
  );
}
