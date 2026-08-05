import React, { useEffect, useState } from 'react';
import { Button, Card, CardContent, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Field, FieldLabel, Input, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Textarea } from '../../components/ui';
import { Add, CheckCircleOutline, DeleteOutline, Receipt } from '../../icons';
import StatusChip from '../../components/StatusChip';
import { useTranslation } from '../../hooks/useTranslation';
import { formatCurrency } from '../../utils/currencyUtils';
import {
  serviceQuotesApi,
  type ServiceQuote,
  type ServiceQuoteRequest,
} from '../../services/api/serviceQuotesApi';

interface Props {
  interventionId: number;
  canEdit: boolean;
  /** L'approbation reporte le montant sur estimatedCost : la fiche doit se rafraîchir. */
  onQuoteApproved?: () => void;
}

const EMPTY_FORM: ServiceQuoteRequest = {
  providerName: '',
  providerEmail: null,
  providerPhone: null,
  amount: 0,
  currency: 'EUR',
  validUntil: null,
  earliestStartDate: null,
  description: null,
};

const STATUS_TONE: Record<ServiceQuote['status'], 'ok' | 'warn' | 'err' | 'neutral'> = {
  RECEIVED: 'warn',
  APPROVED: 'ok',
  REJECTED: 'neutral',
  EXPIRED: 'err',
};

/**
 * Fiche intervention > Devis (M4) — saisie des devis reçus des prestataires.
 * C'est CETTE saisie qui alimente la carte « Approuver » de l'agent Opérations ;
 * l'approbation (ici ou depuis la constellation) écarte les concurrents et
 * reporte le montant sur le coût estimé de l'intervention.
 */
export default function InterventionQuotesSection({ interventionId, canEdit, onQuoteApproved }: Props) {
  const { t } = useTranslation();
  const [quotes, setQuotes] = useState<ServiceQuote[] | null>(null);
  const [form, setForm] = useState<ServiceQuoteRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const reload = React.useCallback(() => {
    serviceQuotesApi.list(interventionId).then(setQuotes).catch(() => setQuotes([]));
  }, [interventionId]);

  useEffect(() => { reload(); }, [reload]);

  const statusLabel = (status: ServiceQuote['status']) => t(
    `interventions.quotes.status.${status}`,
    { RECEIVED: 'Reçu', APPROVED: 'Approuvé', REJECTED: 'Écarté', EXPIRED: 'Expiré' }[status],
  );

  const save = async () => {
    if (!form || !form.providerName.trim() || !(form.amount > 0)) return;
    setSaving(true);
    try {
      await serviceQuotesApi.create(interventionId, form);
      setForm(null);
      reload();
    } finally {
      setSaving(false);
    }
  };

  const approve = async (id: number) => {
    setApprovingId(id);
    try {
      await serviceQuotesApi.approve(id);
      reload();
      onQuoteApproved?.();
    } finally {
      setApprovingId(null);
    }
  };

  const remove = async (id: number) => {
    await serviceQuotesApi.remove(id);
    reload();
  };

  const setField = <K extends keyof ServiceQuoteRequest>(key: K, value: ServiceQuoteRequest[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const hasApproved = (quotes ?? []).some((q) => q.status === 'APPROVED');

  return (
    <Card size="sm" className="mb-[9px] shadow-none">
      <CardContent>
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt size={16} strokeWidth={1.75} className="text-muted-foreground" />
            <p className="m-0 text-2xs font-bold uppercase tracking-wider text-faint">
              {t('interventions.quotes.title', 'Devis prestataires')}
            </p>
          </div>
          {canEdit && (
            <Button variant="outline" size="xs" onClick={() => setForm(EMPTY_FORM)}>
              <Add size={14} />
              {t('interventions.quotes.add', 'Saisir un devis')}
            </Button>
          )}
        </div>

        {quotes === null ? (
          <div className="flex justify-center py-5">
            <Spinner className="size-6" />
          </div>
        ) : quotes.length === 0 ? (
          <p className="m-0 py-2 text-xs text-muted-foreground">
            {t('interventions.quotes.empty',
              "Aucun devis saisi. Dès qu'un devis est enregistré ici, l'agent Opérations propose son approbation dans la constellation.")}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('interventions.quotes.provider', 'Prestataire')}</TableHead>
                <TableHead>{t('interventions.quotes.amount', 'Montant')}</TableHead>
                <TableHead>{t('interventions.quotes.validUntil', 'Valide jusqu’au')}</TableHead>
                <TableHead>{t('interventions.quotes.earliestStart', 'Début possible')}</TableHead>
                <TableHead>{t('interventions.quotes.statusHeader', 'Statut')}</TableHead>
                {canEdit && <TableHead aria-label="actions" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell>
                    <span className="font-medium">{quote.providerName}</span>
                    {quote.description && (
                      <span className="block text-xs text-muted-foreground">{quote.description}</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatCurrency(quote.amount, quote.currency)}</TableCell>
                  <TableCell className="tabular-nums">{quote.validUntil ?? '—'}</TableCell>
                  <TableCell className="tabular-nums">{quote.earliestStartDate ?? '—'}</TableCell>
                  <TableCell>
                    <StatusChip tone={STATUS_TONE[quote.status]} label={statusLabel(quote.status)} size="sm" />
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right whitespace-nowrap">
                      {quote.status === 'RECEIVED' && !hasApproved && (
                        <Button
                          variant="outline" size="xs"
                          disabled={approvingId != null}
                          onClick={() => approve(quote.id)}
                        >
                          {approvingId === quote.id
                            ? <Spinner className="size-[13px]" />
                            : <CheckCircleOutline size={14} />}
                          {t('interventions.quotes.approve', 'Approuver')}
                        </Button>
                      )}
                      {quote.status !== 'APPROVED' && (
                        <Button
                          variant="ghost" size="icon-sm"
                          aria-label={t('common.delete', 'Supprimer')}
                          onClick={() => remove(quote.id)}
                        >
                          <DeleteOutline size={15} />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {form && (
          <Dialog open onOpenChange={(next) => { if (!next && !saving) setForm(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('interventions.quotes.addTitle', 'Saisir un devis reçu')}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-1">
                <Field>
                  <FieldLabel htmlFor="quote-provider-name">
                    {t('interventions.quotes.provider', 'Prestataire')}
                  </FieldLabel>
                  <Input
                    id="quote-provider-name"
                    value={form.providerName}
                    onChange={(e) => setField('providerName', e.target.value)}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="quote-provider-email">
                      {t('interventions.quotes.providerEmail', 'Email')}
                    </FieldLabel>
                    <Input
                      id="quote-provider-email"
                      type="email"
                      value={form.providerEmail ?? ''}
                      onChange={(e) => setField('providerEmail', e.target.value || null)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="quote-provider-phone">
                      {t('interventions.quotes.providerPhone', 'Téléphone')}
                    </FieldLabel>
                    <Input
                      id="quote-provider-phone"
                      value={form.providerPhone ?? ''}
                      onChange={(e) => setField('providerPhone', e.target.value || null)}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="quote-amount">
                      {t('interventions.quotes.amount', 'Montant')}
                    </FieldLabel>
                    <Input
                      id="quote-amount"
                      className="tabular-nums"
                      type="number" min={0} step="0.01"
                      value={form.amount || ''}
                      onChange={(e) => setField('amount', Number(e.target.value) || 0)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="quote-currency">
                      {t('interventions.quotes.currency', 'Devise')}
                    </FieldLabel>
                    <Input
                      id="quote-currency"
                      value={form.currency}
                      onChange={(e) => setField('currency', e.target.value.toUpperCase())}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="quote-valid-until">
                      {t('interventions.quotes.validUntil', 'Valide jusqu’au')}
                    </FieldLabel>
                    <Input
                      id="quote-valid-until"
                      type="date"
                      value={form.validUntil ?? ''}
                      onChange={(e) => setField('validUntil', e.target.value || null)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="quote-earliest-start">
                      {t('interventions.quotes.earliestStart', 'Début possible')}
                    </FieldLabel>
                    <Input
                      id="quote-earliest-start"
                      type="date"
                      value={form.earliestStartDate ?? ''}
                      onChange={(e) => setField('earliestStartDate', e.target.value || null)}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="quote-description">
                    {t('interventions.quotes.description', 'Description')}
                  </FieldLabel>
                  <Textarea
                    id="quote-description"
                    rows={2}
                    value={form.description ?? ''}
                    onChange={(e) => setField('description', e.target.value || null)}
                  />
                </Field>
              </div>
              <DialogFooter>
                <Button variant="outline" disabled={saving} onClick={() => setForm(null)}>
                  {t('common.cancel', 'Annuler')}
                </Button>
                <Button disabled={saving || !form.providerName.trim() || !(form.amount > 0)} onClick={save}>
                  {saving ? <Spinner className="size-[13px]" /> : null}
                  {t('common.save', 'Enregistrer')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
