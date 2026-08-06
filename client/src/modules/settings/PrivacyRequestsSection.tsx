import React, { useEffect, useState } from 'react';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Field, FieldLabel, Input, NativeSelect, NativeSelectOption, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui';
import { Add, GppGood } from '../../icons';
import StatusChip from '../../components/StatusChip';
import { useTranslation } from '../../hooks/useTranslation';
import SettingsSection from './components/SettingsSection';
import { guestsApi, type GuestDto } from '../../services/api/guestsApi';
import { privacyRequestsApi, type PrivacyRequest } from '../../services/api/privacyRequestsApi';

const TYPE_LABELS: Record<PrivacyRequest['type'], string> = {
  ERASURE: 'Effacement',
  ACCESS: 'Accès aux données',
  RECTIFICATION: 'Rectification',
};

const STATUS_TONE: Record<PrivacyRequest['status'], 'ok' | 'warn' | 'err' | 'neutral'> = {
  RECEIVED: 'warn',
  IN_PROGRESS: 'warn',
  COMPLETED: 'ok',
  REFUSED: 'neutral',
};

const STATUS_LABELS: Record<PrivacyRequest['status'], string> = {
  RECEIVED: 'Reçue',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Traitée',
  REFUSED: 'Refusée',
};

interface CreateForm {
  requesterEmail: string;
  type: PrivacyRequest['type'];
  notes: string;
  guest: GuestDto | null;
  guestQuery: string;
  guestResults: GuestDto[];
}

const EMPTY_FORM: CreateForm = {
  requesterEmail: '',
  type: 'ERASURE',
  notes: '',
  guest: null,
  guestQuery: '',
  guestResults: [],
};

/**
 * Réglages > Général > Confidentialité (M9) — registre des demandes RGPD.
 * La saisie ici fait naître la carte « Effacer » de l'agent Conformité
 * (échéance légale J+30) ; l'effacement peut aussi se lancer depuis cette
 * section, même chemin serveur (sélectif, irréversible, rapport tracé).
 */
export default function PrivacyRequestsSection() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<PrivacyRequest[] | null>(null);
  const [form, setForm] = useState<CreateForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmEraseId, setConfirmEraseId] = useState<number | null>(null);
  const [erasing, setErasing] = useState(false);

  const reload = React.useCallback(() => {
    privacyRequestsApi.list().then(setRequests).catch(() => setRequests([]));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const searchGuests = async (query: string) => {
    setForm((prev) => (prev ? { ...prev, guestQuery: query, guest: null } : prev));
    if (query.trim().length < 2) {
      setForm((prev) => (prev ? { ...prev, guestResults: [] } : prev));
      return;
    }
    try {
      const results = await guestsApi.search(query.trim());
      setForm((prev) => (prev ? { ...prev, guestResults: results.slice(0, 5) } : prev));
    } catch {
      setForm((prev) => (prev ? { ...prev, guestResults: [] } : prev));
    }
  };

  const save = async () => {
    if (!form || !form.requesterEmail.trim()) return;
    setSaving(true);
    try {
      await privacyRequestsApi.create({
        guestId: form.guest?.id ?? null,
        requesterEmail: form.requesterEmail.trim(),
        type: form.type,
        notes: form.notes || null,
      });
      setForm(null);
      reload();
    } finally {
      setSaving(false);
    }
  };

  const erase = async () => {
    if (confirmEraseId == null) return;
    setErasing(true);
    try {
      await privacyRequestsApi.erase(confirmEraseId);
      setConfirmEraseId(null);
      reload();
    } finally {
      setErasing(false);
    }
  };

  return (
    <SettingsSection
      title={t('settings.privacy.title', 'Confidentialité (RGPD)')}
      icon={GppGood}
      accent="danger"
      description={t('settings.privacy.description',
        "Demandes des voyageurs : effacement, accès, rectification. Échéance légale 30 jours.")}
      action={(
        <Button size="sm" variant="outline" onClick={() => setForm(EMPTY_FORM)}>
          <Add size={15} />
          {t('settings.privacy.add', 'Saisir une demande')}
        </Button>
      )}
    >
      {requests === null ? (
        <div className="flex justify-center py-5">
          <Spinner className="size-6" />
        </div>
      ) : requests.length === 0 ? (
        <p className="m-0 py-2 text-xs text-muted-foreground">
          {t('settings.privacy.empty',
            "Aucune demande enregistrée. Une demande d'effacement saisie ici lève la carte « Effacer » de l'agent Conformité avec son échéance légale.")}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('settings.privacy.requester', 'Demandeur')}</TableHead>
              <TableHead>{t('settings.privacy.type', 'Type')}</TableHead>
              <TableHead>{t('settings.privacy.dueAt', 'Échéance')}</TableHead>
              <TableHead>{t('settings.privacy.status', 'Statut')}</TableHead>
              <TableHead aria-label="actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell>
                  <span className="font-medium">{request.requesterEmail}</span>
                  {request.guestId == null && request.status === 'RECEIVED' && (
                    <span className="block text-2xs text-muted-foreground">
                      {t('settings.privacy.noGuest', 'Aucune fiche voyageur liée')}
                    </span>
                  )}
                </TableCell>
                <TableCell>{TYPE_LABELS[request.type]}</TableCell>
                <TableCell className="tabular-nums">{request.dueAt}</TableCell>
                <TableCell>
                  <StatusChip tone={STATUS_TONE[request.status]}
                    label={STATUS_LABELS[request.status]} size="sm" />
                </TableCell>
                <TableCell className="text-end whitespace-nowrap">
                  {request.status === 'RECEIVED' && (
                    <>
                      {request.type === 'ERASURE' && request.guestId != null && (
                        <Button variant="outline" size="xs"
                          onClick={() => setConfirmEraseId(request.id)}>
                          {t('settings.privacy.erase', 'Effacer')}
                        </Button>
                      )}
                      {request.type !== 'ERASURE' && (
                        <Button variant="outline" size="xs"
                          onClick={() => privacyRequestsApi.complete(request.id).then(reload)}>
                          {t('settings.privacy.complete', 'Clore')}
                        </Button>
                      )}
                      <Button variant="ghost" size="xs"
                        onClick={() => privacyRequestsApi.refuse(request.id).then(reload)}>
                        {t('settings.privacy.refuse', 'Refuser')}
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {form && (
        <Dialog open onOpenChange={(next) => { if (!next && !saving) setForm(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('settings.privacy.addTitle', 'Saisir une demande RGPD')}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-1">
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="privacy-requester-email">
                    {t('settings.privacy.requesterEmail', 'Email du demandeur')}
                  </FieldLabel>
                  <Input
                    id="privacy-requester-email"
                    type="email"
                    value={form.requesterEmail}
                    onChange={(e) => setForm({ ...form, requesterEmail: e.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="privacy-request-type">
                    {t('settings.privacy.type', 'Type')}
                  </FieldLabel>
                  <NativeSelect
                    id="privacy-request-type"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as PrivacyRequest['type'] })}
                  >
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="privacy-guest-search">
                  {t('settings.privacy.guestSearch', 'Fiche voyageur (recherche nom/email)')}
                </FieldLabel>
                <Input
                  id="privacy-guest-search"
                  value={form.guest ? `${form.guest.fullName}` : form.guestQuery}
                  onChange={(e) => searchGuests(e.target.value)}
                  placeholder={t('settings.privacy.guestHint', 'Requis pour exécuter un effacement')}
                />
              </Field>
              {form.guest == null && form.guestResults.length > 0 && (
                <div className="grid gap-1">
                  {form.guestResults.map((guest) => (
                    <button
                      key={guest.id}
                      type="button"
                      className="cursor-pointer rounded-md border border-solid border-border bg-field px-2 py-1.5 text-start text-xs transition-colors duration-150 hover:border-primary hover:bg-muted"
                      onClick={() => setForm({ ...form, guest, guestResults: [] })}
                    >
                      <span className="font-medium">{guest.fullName}</span>
                      {guest.email && <span className="text-muted-foreground"> — {guest.email}</span>}
                    </button>
                  ))}
                </div>
              )}
              <Field>
                <FieldLabel htmlFor="privacy-notes">
                  {t('settings.privacy.notes', 'Notes')}
                </FieldLabel>
                <Input
                  id="privacy-notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </Field>
            </div>
            <DialogFooter>
              <Button variant="outline" disabled={saving} onClick={() => setForm(null)}>
                {t('common.cancel', 'Annuler')}
              </Button>
              <Button disabled={saving || !form.requesterEmail.trim()} onClick={save}>
                {saving ? <Spinner className="size-[13px]" /> : null}
                {t('common.save', 'Enregistrer')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {confirmEraseId != null && (
        <Dialog open onOpenChange={(next) => { if (!next && !erasing) setConfirmEraseId(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('settings.privacy.confirmTitle', 'Effacement irréversible')}</DialogTitle>
            </DialogHeader>
            <p className="m-0 text-xs text-foreground">
              {t('settings.privacy.confirmBody',
                "Identité, coordonnées et contenu des messages du voyageur seront définitivement effacés. Les factures et fiches police sont conservées (obligations légales) — un rapport est tracé sur la demande.")}
            </p>
            <DialogFooter>
              <Button variant="outline" disabled={erasing} onClick={() => setConfirmEraseId(null)}>
                {t('common.cancel', 'Annuler')}
              </Button>
              <Button variant="destructive" disabled={erasing} onClick={erase}>
                {erasing ? <Spinner className="size-[13px]" /> : null}
                {t('settings.privacy.confirmCta', 'Effacer définitivement')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </SettingsSection>
  );
}
