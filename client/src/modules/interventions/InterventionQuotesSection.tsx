import React, { useEffect, useState } from 'react';
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  FieldLabel,
  Input,
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  Spinner,
  Textarea,
} from '../../components/ui';
import { Add, CheckCircleOutline, DeleteOutline, Download, Receipt } from '../../icons';
import { documentsApi } from '../../services/api/documentsApi';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { useTranslation } from '../../hooks/useTranslation';
import { formatCurrency } from '../../utils/currencyUtils';
import { formatDate } from '../../utils/formatUtils';
import {
  serviceQuotesApi,
  type ServiceQuote,
  type ServiceQuoteRequest,
} from '../../services/api/serviceQuotesApi';

interface Props {
  interventionId: number;
  canEdit: boolean;
  /**
   * L'intervenant assigne peut soumettre SON devis. Distinct de `canEdit` :
   * celui-ci autorise a saisir un devis recu d'un tiers et a l'approuver, ce
   * qui reste le geste d'un gestionnaire.
   */
  canSubmitOwn?: boolean;
  /** Statut de l'intervention — conditionne la remontee vers la constellation. */
  interventionStatus?: string;
  /** Date de creation de l'intervention (ISO) — meme raison. */
  interventionCreatedAt?: string | null;
  /** L'approbation reporte le montant sur estimatedCost : la fiche doit se rafraîchir. */
  onQuoteApproved?: () => void;
}

/**
 * Conditions EXACTES du scanner `OpsMaintenanceScanner.scanQuotesAwaitingApproval`
 * (serveur) : l'agent Operations ne ramasse un devis que si l'intervention est
 * encore ouverte ET a ete creee il y a moins de 60 jours. Repliquees ici pour ne
 * pas promettre une carte que la constellation ne produira jamais.
 */
const OPEN_STATUSES = ['PENDING', 'AWAITING_VALIDATION', 'AWAITING_PAYMENT', 'IN_PROGRESS'];
const SCAN_WINDOW_DAYS = 60;

function scanEligibility(status?: string, createdAt?: string | null): 'eligible' | 'closed' | 'tooOld' | 'unknown' {
  if (!status) return 'unknown';
  if (!OPEN_STATUSES.includes(status)) return 'closed';
  if (!createdAt) return 'eligible';
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;
  return ageDays > SCAN_WINDOW_DAYS ? 'tooOld' : 'eligible';
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
 * PDF du devis, en piece jointe ouvrable.
 *
 * <p>Le document est charge a la demande — a l'ouverture de l'apercu, pas au
 * rendu de la liste : une fiche qui porte cinq devis n'a pas a telecharger cinq
 * PDF pour afficher cinq lignes.</p>
 */
function QuoteAttachment({ generationId, label }: { generationId: number; label: string }) {
  const { t } = useTranslation();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileName = `${label}.pdf`;

  const load = async () => {
    if (blobUrl || loading) return;
    setLoading(true);
    try {
      setBlobUrl(await documentsApi.fetchGenerationBlobUrl(generationId));
    } catch {
      setBlobUrl(null);
    } finally {
      setLoading(false);
    }
  };

  // L'URL d'objet immobilise le PDF en memoire tant qu'on ne la libere pas.
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  return (
    <Dialog onOpenChange={(open) => { if (open) load(); }}>
      <Attachment className="w-full max-w-[260px]">
        <AttachmentMedia>
          <Receipt />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>{fileName}</AttachmentTitle>
          <AttachmentDescription>
            {t('interventions.quotes.openPreview', 'Ouvrir l’aperçu')}
          </AttachmentDescription>
        </AttachmentContent>
        <AttachmentActions>
          <AttachmentAction
            aria-label={t('interventions.quotes.download', 'Télécharger le devis')}
            onClick={() => documentsApi.downloadGeneration(generationId, fileName)}
          >
            <Download />
          </AttachmentAction>
        </AttachmentActions>
        <DialogTrigger asChild>
          <AttachmentTrigger aria-label={t('interventions.quotes.preview', 'Aperçu du devis')} />
        </DialogTrigger>
      </Attachment>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{fileName}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex h-[60vh] items-center justify-center">
            <Spinner className="size-8" />
          </div>
        ) : blobUrl ? (
          <>
            <iframe src={blobUrl} title={fileName} className="h-[60vh] w-full rounded-md border border-solid border-border" />
            {/* Filet de securite : un navigateur sans lecteur PDF integre
                n'afficherait qu'un cadre vide, sans aucun moyen d'en sortir. */}
            <div className="flex justify-end gap-3 text-xs">
              <a
                href={blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-2 hover:underline"
              >
                {t('interventions.quotes.openInTab', 'Ouvrir dans un nouvel onglet')}
              </a>
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => documentsApi.downloadGeneration(generationId, fileName)}
              >
                {t('interventions.quotes.download', 'Télécharger le devis')}
              </button>
            </div>
          </>
        ) : (
          <p className="m-0 py-8 text-center text-sm text-muted-foreground">
            {t('interventions.quotes.previewFailed', 'Le document n’a pas pu être chargé.')}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Fiche intervention > Devis (M4) — saisie des devis reçus des prestataires.
 * C'est CETTE saisie qui alimente la carte « Approuver » de l'agent Opérations ;
 * l'approbation (ici ou depuis la constellation) écarte les concurrents et
 * reporte le montant sur le coût estimé de l'intervention.
 */
export default function InterventionQuotesSection({
  interventionId,
  canEdit,
  canSubmitOwn = false,
  interventionStatus,
  interventionCreatedAt,
  onQuoteApproved,
}: Props) {
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
    if (!form || !(form.amount > 0)) return;
    // Un gestionnaire saisit un devis RECU : il nomme le prestataire. Un
    // intervenant soumet LE SIEN : son identite vient du compte connecte, et
    // le nom saisi ici serait au mieux redondant, au pire usurpe.
    if (!canSubmitOwn && !form.providerName.trim()) return;
    setSaving(true);
    try {
      if (canSubmitOwn) {
        await serviceQuotesApi.submitMine(interventionId, {
          amount: form.amount,
          currency: form.currency,
          validUntil: form.validUntil,
          earliestStartDate: form.earliestStartDate,
          description: form.description,
        });
      } else {
        await serviceQuotesApi.create(interventionId, form);
      }
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
  const eligibility = scanEligibility(interventionStatus, interventionCreatedAt);

  return (
    <section className="mb-6">
      {/* Plus de carte : la fiche n'en porte aucune, et ce bloc en etait la
          derniere. Meme filet de titre que les sections voisines. */}
      <div className="mb-2 flex items-center justify-between gap-3 border-b border-solid border-border pb-1.5">
        <p className="m-0 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[.06em] text-faint">
          <Receipt size={14} strokeWidth={1.75} />
          {t('interventions.quotes.title', 'Devis prestataires')}
          {(quotes?.length ?? 0) > 0 && (
            <span className="font-normal tabular-nums normal-case">({quotes!.length})</span>
          )}
        </p>
        {(canEdit || canSubmitOwn) && (
          <Button variant="outline" size="xs" onClick={() => setForm(EMPTY_FORM)}>
            <Add size={14} />
            {canSubmitOwn
              ? t('interventions.quotes.submitMine', 'Chiffrer cette intervention')
              : t('interventions.quotes.add', 'Saisir un devis')}
          </Button>
        )}
      </div>

      {quotes === null ? (
        <div className="flex justify-center py-5">
          <Spinner className="size-6" />
        </div>
      ) : quotes.length === 0 ? (
        <p className="m-0 py-1 text-[13px] leading-[1.6] text-muted-foreground">
          {eligibility === 'closed'
            ? t('interventions.quotes.emptyClosed',
                "Aucun devis saisi. L'intervention n'étant plus ouverte, un devis enregistré ici ne remontera pas à l'agent Opérations.")
            : eligibility === 'tooOld'
              ? t('interventions.quotes.emptyTooOld',
                  "Aucun devis saisi. L'intervention date de plus de 60 jours : au-delà, l'agent Opérations ne la scanne plus.")
              : t('interventions.quotes.empty',
                  "Aucun devis saisi. Dès qu'un devis est enregistré ici, l'agent Opérations propose son approbation dans la constellation.")}
        </p>
      ) : (
        <>
          {eligibility !== 'eligible' && eligibility !== 'unknown' && (
            <p className="m-0 mb-2 text-xs text-warning-ink">
              {eligibility === 'closed'
                ? t('interventions.quotes.noticeClosed',
                    "L'intervention n'est plus ouverte : ces devis ne remontent plus à l'agent Opérations. L'approbation reste possible ici.")
                : t('interventions.quotes.noticeTooOld',
                    "L'intervention date de plus de 60 jours : l'agent Opérations ne la scanne plus. L'approbation reste possible ici.")}
            </p>
          )}
          {/* Une ligne par devis, pas un tableau a six colonnes : le montant
              est ce qu'on compare, les dates ne sont qu'une condition. Un
              tableau imposait un defilement horizontal sur telephone. */}
          <ItemGroup>
            {quotes.map((quote) => {
              const approved = quote.status === 'APPROVED';
              const conditions = [
                quote.earliestStartDate && t('interventions.quotes.fromDate',
                  'dispo. dès le {{date}}', { date: formatDate(quote.earliestStartDate) }),
                quote.validUntil && t('interventions.quotes.untilDate',
                  'valable jusqu’au {{date}}', { date: formatDate(quote.validUntil) }),
              ].filter(Boolean).join(' · ');

              return (
                <Item
                  key={quote.id}
                  size="sm"
                  className={cn(
                    // `Item` porte un liseré bas et un rayon : deux lignes
                    // consécutives se lisaient alors comme deux boîtes. On ne
                    // garde qu'un filet entre elles.
                    'rounded-none border-x-0 border-b-0 border-t border-solid border-border first:border-t-0',
                    // Le devis retenu porte la decision : il se distingue par
                    // un fond, pas par une pastille de plus.
                    approved && 'bg-success-soft',
                  )}
                >
                  <ItemMedia>
                    <span
                      className={cn(
                        'inline-flex size-8 items-center justify-center rounded-full',
                        approved ? 'bg-success text-primary-foreground' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {approved
                        ? <CheckCircleOutline size={16} strokeWidth={2} />
                        : <Receipt size={15} strokeWidth={1.75} />}
                    </span>
                  </ItemMedia>
                  <ItemContent className="min-w-0 gap-0.5">
                    <p className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-[15px] font-semibold tabular-nums text-foreground">
                        {formatCurrency(quote.amount, quote.currency)}
                      </span>
                      <span className="truncate text-[13px] text-muted-foreground">
                        {quote.providerName}
                      </span>
                      {quote.status !== 'RECEIVED' && (
                        <StatusChip
                          tone={STATUS_TONE[quote.status]}
                          label={statusLabel(quote.status)}
                          size="sm"
                          dot
                        />
                      )}
                    </p>
                    {conditions && (
                      <p className="m-0 text-xs text-faint tabular-nums">{conditions}</p>
                    )}
                    {quote.description && (
                      <p className="m-0 text-xs text-muted-foreground">{quote.description}</p>
                    )}
                  </ItemContent>
                  {/* Le PDF se tient a droite du montant et du motif : c'est ce
                      qu'on transmet au proprietaire, pas la ligne du tableau. */}
                  {quote.documentGenerationId != null && (
                    <div className="hidden shrink-0 min-[900px]:block">
                      <QuoteAttachment
                        generationId={quote.documentGenerationId}
                        label={t('interventions.quotes.fileName', 'devis-{{id}}', { id: quote.id })}
                      />
                    </div>
                  )}
                  {canEdit && (
                    <ItemActions className="shrink-0 gap-1">
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
                      {!approved && (
                        <Button
                          variant="ghost" size="icon-sm"
                          className="text-muted-foreground hover:text-destructive-ink"
                          aria-label={t('common.delete', 'Supprimer')}
                          onClick={() => remove(quote.id)}
                        >
                          <DeleteOutline size={15} />
                        </Button>
                      )}
                    </ItemActions>
                  )}
                </Item>
              );
            })}
          </ItemGroup>
        </>
      )}

        {form && (
          <Dialog open onOpenChange={(next) => { if (!next && !saving) setForm(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {canSubmitOwn
                    ? t('interventions.quotes.submitMineTitle', 'Chiffrer cette intervention')
                    : t('interventions.quotes.addTitle', 'Saisir un devis reçu')}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-1">
                {/* Identite du prestataire : sans objet quand l'intervenant
                    soumet SON devis — elle vient de son compte, et un champ
                    libre inviterait a se faire passer pour un autre. */}
                {!canSubmitOwn && (
                  <>
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
                  </>
                )}
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
                <Button
                  disabled={saving || !(form.amount > 0)
                    || (!canSubmitOwn && !form.providerName.trim())}
                  onClick={save}
                >
                  {saving ? <Spinner className="size-[13px]" /> : null}
                  {t('common.save', 'Enregistrer')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
      )}
    </section>
  );
}
