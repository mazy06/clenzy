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
import { technicianPrestationsApi } from '../../services/api/technicianPrestationsApi';
import type { ServicePriceConfig } from '../../services/api/pricingConfigApi';
import type { QuoteLine } from '../../services/api/interventionsApi';
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
  /**
   * Remonte les devis a l'ecran parent. Le devis conditionne l'etat affiche
   * dans « Votre reponse » : accepter l'assignation n'engage que l'intervenant,
   * la decision sur le PRIX revient au proprietaire ou a la conciergerie.
   */
  onQuotesLoaded?: (quotes: ServiceQuote[]) => void;
  /**
   * Ce qu'on demande de chiffrer. Le formulaire ne montrait que la grille de
   * tarifs : l'intervenant devait retenir de tete ce qu'il venait de lire sur
   * la fiche — surface a peindre, piece concernee, gravite.
   */
  /**
   * Incremente par l'ecran parent pour ouvrir le chiffrage. Accepter une
   * mission et annoncer son prix sont le meme geste.
   */
  openFormSignal?: number;
  demand?: {
    title?: string;
    description?: string | null;
    typeLabel?: string;
    lines?: QuoteLine[];
  };
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
  lines: [],
};

/** Le nom du prestataire devient un nom de fichier lisible et sans surprise. */
function slugify(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

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
  onQuotesLoaded,
  demand,
  openFormSignal,
}: Props) {
  const { t } = useTranslation();
  const [quotes, setQuotes] = useState<ServiceQuote[] | null>(null);
  const [form, setForm] = useState<ServiceQuoteRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const reload = React.useCallback(() => {
    serviceQuotesApi.list(interventionId)
      .then((loaded) => { setQuotes(loaded); onQuotesLoaded?.(loaded); })
      .catch(() => { setQuotes([]); onQuotesLoaded?.([]); });
  }, [interventionId, onQuotesLoaded]);

  // Tarifs travaux de l'intervenant : c'est SA grille qui chiffre, pas un
  // montant libre. Chargee a l'ouverture du formulaire seulement.
  const [myRates, setMyRates] = useState<ServicePriceConfig[] | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  // Le tarif de la grille est un POINT DE DEPART : un chantier reel se chiffre
  // a la surface, a l'etat, a l'acces. Chaque ligne retenue reste modifiable.
  const [overrides, setOverrides] = useState<Record<string, { unitPrice: number; quantity: number }>>({});
  // Et ce que la grille ne prevoit pas s'ajoute a la main.
  const [customLines, setCustomLines] = useState<QuoteLine[]>([]);
  const [newLine, setNewLine] = useState({ label: '', unitPrice: 0 });

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
          lines: form.lines,
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

  /**
   * Coche ou decoche une prestation. Le montant du devis EST la somme des
   * lignes retenues : un total saisi a la main ne se rattacherait a rien de
   * verifiable, ni pour le proprietaire ni pour la facturation.
   */
  /**
   * Ouvre le chiffrage, remis a zero, et charge la grille de l'intervenant.
   *
   * <p>Les prestations DEMANDEES sont pre-cochees quand elles existent dans sa
   * grille : il chiffre ce qu'on lui demande, il n'a pas a le retrouver.</p>
   */
  const openForm = React.useCallback(() => {
    setForm(EMPTY_FORM);
    setSelectedTypes([]);
    setOverrides({});
    setCustomLines([]);
    setNewLine({ label: '', unitPrice: 0 });
    if (!canSubmitOwn) return;

    const wanted = new Set(
      (demand?.lines ?? [])
        .map((line) => line.interventionType)
        .filter((type): type is string => Boolean(type)),
    );

    const preselect = (rates: ServicePriceConfig[]) =>
      setSelectedTypes(rates
        .filter((rate) => wanted.has(rate.interventionType))
        .map((rate) => rate.interventionType));

    if (myRates !== null) {
      preselect(myRates);
      return;
    }
    // `getMine` ne porte que les montants : le libelle lisible et le domaine
    // viennent du catalogue de l'org, comme dans « Mes tarifs travaux ».
    Promise.all([
      technicianPrestationsApi.catalogue().catch(() => [] as ServicePriceConfig[]),
      technicianPrestationsApi.getMine().catch(() => [] as ServicePriceConfig[]),
    ]).then(([catalogue, mine]) => {
      const meta = new Map(catalogue.map((item) => [item.interventionType, item]));
      const rates = mine
        .filter((rate) => rate.enabled && rate.basePrice > 0)
        .map((rate) => ({
          ...rate,
          label: rate.label ?? meta.get(rate.interventionType)?.label,
          domain: rate.domain ?? meta.get(rate.interventionType)?.domain,
        }));
      setMyRates(rates);
      preselect(rates);
    });
  }, [canSubmitOwn, demand, myRates]);

  // Le parent demande l'ouverture apres une acceptation. Le 0 initial ne
  // declenche rien : seul un increment compte.
  React.useEffect(() => {
    if (openFormSignal) openForm();
    // `openForm` change avec la grille ; on ne veut reagir qu'au signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openFormSignal]);

  /** Ligne effective d'un type retenu : le tarif de la grille, ou l'ajustement. */
  const lineFor = React.useCallback((type: string): QuoteLine => {
    const rate = (myRates ?? []).find((r) => r.interventionType === type);
    const tweak = overrides[type];
    return {
      label: rate?.label ?? type,
      quantity: tweak?.quantity ?? 1,
      unitPrice: tweak?.unitPrice ?? rate?.basePrice ?? 0,
      interventionType: type,
    };
  }, [myRates, overrides]);

  const quotedLines = React.useMemo(
    () => [...selectedTypes.map(lineFor), ...customLines],
    [selectedTypes, lineFor, customLines],
  );
  const quotedTotal = quotedLines.reduce(
    (sum, line) => sum + line.unitPrice * (line.quantity || 1), 0);

  // Le formulaire porte toujours le total et le detail : ils se recalculent a
  // chaque changement de selection, de prix ou de quantite.
  React.useEffect(() => {
    if (!canSubmitOwn) return;
    setForm((prev) => prev ? { ...prev, amount: quotedTotal, lines: quotedLines } : prev);
  }, [canSubmitOwn, quotedTotal, quotedLines]);

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => prev.includes(type)
      ? prev.filter((t) => t !== type)
      : [...prev, type]);
  };

  const tweak = (type: string, patch: Partial<{ unitPrice: number; quantity: number }>) =>
    setOverrides((prev) => ({
      ...prev,
      [type]: { ...lineFor(type), ...prev[type], ...patch },
    }));

  /** Grille groupee par domaine, comme l'ecran « Mes tarifs travaux ». */
  const ratesByDomain = React.useMemo(() => {
    const groups = new Map<string, ServicePriceConfig[]>();
    for (const rate of myRates ?? []) {
      const domain = rate.domain || t('interventions.quotes.otherDomain', 'Autres');
      if (!groups.has(domain)) groups.set(domain, []);
      groups.get(domain)!.push(rate);
    }
    return [...groups.entries()];
  }, [myRates, t]);

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
          <Button variant="outline" size="xs" onClick={openForm}>
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
          <p className="m-0 mb-2 text-[13px] leading-[1.6] text-muted-foreground">
            {hasApproved
              ? t('interventions.quotes.leadApproved',
                  'Un devis est retenu : son montant devient le coût estimé de l’intervention, et son PDF est le document transmis au propriétaire.')
              : quotes.length > 1
                ? t('interventions.quotes.leadCompare',
                    '{{count}} devis en concurrence. Approuvez celui que vous retenez : les autres sont écartés et le PDF du devis retenu est généré.',
                    { count: quotes.length })
                : t('interventions.quotes.leadSingle',
                    'Devis en attente de décision. À l’approbation, son montant devient le coût estimé et son PDF est généré.')}
          </p>
          {/* Une ligne par devis, pas un tableau a six colonnes : le montant
              est ce qu'on compare, les dates ne sont qu'une condition. Un
              tableau imposait un defilement horizontal sur telephone. */}
          <ItemGroup>
            {quotes.map((quote) => {
              const approved = quote.status === 'APPROVED';
              // Un devis ecarte reste consultable mais ne dispute plus le
              // regard au devis retenu.
              const setAside = quote.status === 'REJECTED' || quote.status === 'EXPIRED';
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
                      <span
                        className={cn(
                          'text-[15px] font-semibold tabular-nums',
                          setAside ? 'text-muted-foreground line-through' : 'text-foreground',
                        )}
                      >
                        {formatCurrency(quote.amount, quote.currency)}
                      </span>
                      <span className="truncate text-[13px] text-muted-foreground">
                        {quote.providerName}
                      </span>
                      <StatusChip
                        tone={STATUS_TONE[quote.status]}
                        label={statusLabel(quote.status)}
                        size="sm"
                        dot
                      />
                    </p>
                    {conditions && (
                      <p className="m-0 text-xs text-faint tabular-nums">{conditions}</p>
                    )}
                    {quote.lines?.length > 0 && (
                      <ul className="m-0 mt-1 list-none space-y-0.5 p-0">
                        {quote.lines.map((line, index) => (
                          <li
                            key={`${line.interventionType ?? line.label}-${index}`}
                            className="flex items-baseline justify-between gap-3 text-xs"
                          >
                            <span className="min-w-0 truncate text-muted-foreground">
                              {line.label}
                              {line.quantity > 1 && (
                                <span className="ms-1 tabular-nums">× {line.quantity}</span>
                              )}
                            </span>
                            <span className="shrink-0 tabular-nums text-foreground">
                              {formatCurrency(line.unitPrice * (line.quantity || 1), quote.currency)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {quote.description && (
                      <p className="m-0 text-xs text-muted-foreground">{quote.description}</p>
                    )}
                  </ItemContent>
                  {/* Le PDF se tient a droite du montant et du motif : c'est ce
                      qu'on transmet au proprietaire, pas la ligne du tableau.
                      Son intitule dit de quoi il s'agit — un fichier pose la
                      sans legende ne se rattache visuellement a rien. */}
                  {quote.documentGenerationId != null && (
                    <div className="hidden shrink-0 flex-col items-end gap-1 min-[900px]:flex">
                      <span className="text-2xs font-semibold uppercase tracking-[.05em] text-faint">
                        {t('interventions.quotes.documentLabel', 'Document')}
                      </span>
                      <QuoteAttachment
                        generationId={quote.documentGenerationId}
                        label={t('interventions.quotes.fileName', 'devis-{{provider}}',
                          { provider: slugify(quote.providerName) || quote.id })}
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
            <DialogContent className={canSubmitOwn ? 'sm:max-w-4xl' : undefined}>
              <DialogHeader>
                <DialogTitle>
                  {canSubmitOwn
                    ? t('interventions.quotes.submitMineTitle', 'Chiffrer cette intervention')
                    : t('interventions.quotes.addTitle', 'Saisir un devis reçu')}
                </DialogTitle>
              </DialogHeader>
              <div
                className={cn(
                  'grid gap-x-6 gap-y-3 py-1',
                  // Deux colonnes : la demande a gauche, ce qu'on facture a
                  // droite. En une seule colonne, il fallait defiler entre ce
                  // qu'on lit et ce qu'on chiffre.
                  canSubmitOwn && 'min-[900px]:grid-cols-2',
                )}
              >
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
                {/* Colonne gauche : CE QU'ON DEMANDE. Le formulaire n'ouvrait
                    que la grille de tarifs, et l'intervenant devait retenir de
                    tete la surface a peindre ou la piece concernee. */}
                {canSubmitOwn && (
                  <div className="min-w-0">
                    <p className="m-0 mb-2 border-b border-solid border-border pb-1.5 text-2xs font-bold uppercase tracking-[.06em] text-faint">
                      {t('interventions.quotes.demandTitle', 'Ce qu’on vous demande')}
                    </p>
                    {demand?.typeLabel && (
                      <p className="m-0 mb-1 text-[13px] font-medium text-foreground">
                        {demand.typeLabel}
                      </p>
                    )}
                    {demand?.title && (
                      <p className="m-0 mb-1 text-[13px] text-foreground">{demand.title}</p>
                    )}
                    {demand?.description && (
                      <p className="m-0 mb-2 whitespace-pre-line text-xs leading-[1.6] text-muted-foreground">
                        {demand.description}
                      </p>
                    )}
                    {(demand?.lines?.length ?? 0) > 0 && (
                      <>
                        <p className="m-0 mb-1 mt-3 text-2xs font-semibold uppercase tracking-[.05em] text-faint">
                          {t('interventions.quotes.demandLines', 'Points à traiter')}
                        </p>
                        <ul className="m-0 list-none space-y-1 p-0">
                          {demand!.lines!.map((line, index) => (
                            <li
                              key={`${line.interventionType ?? line.label}-${index}`}
                              className="flex items-baseline justify-between gap-3 rounded-md bg-muted px-2 py-1 text-xs"
                            >
                              <span className="min-w-0 text-foreground">
                                {line.label}
                                {line.quantity > 1 && (
                                  <span className="ms-1 tabular-nums text-muted-foreground">
                                    × {line.quantity}
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0 tabular-nums text-muted-foreground">
                                {formatCurrency(line.unitPrice * (line.quantity || 1), form.currency)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {!demand?.title && !demand?.description && !(demand?.lines?.length) && (
                      <p className="m-0 text-xs text-muted-foreground">
                        {t('interventions.quotes.demandEmpty',
                          'Aucun détail fourni avec la demande.')}
                      </p>
                    )}
                  </div>
                )}

                {/* Colonne droite : CE QU'ON FACTURE. */}
                {canSubmitOwn && (
                  <div className="min-w-0">
                    <p className="m-0 mb-2 border-b border-solid border-border pb-1.5 text-2xs font-bold uppercase tracking-[.06em] text-faint">
                      {t('interventions.quotes.pickTypes', 'Votre chiffrage')}
                    </p>
                    {myRates === null ? (
                      <div className="flex justify-center py-4"><Spinner className="size-5" /></div>
                    ) : (
                      <div className="max-h-[300px] overflow-y-auto rounded-lg border border-solid border-border">
                        {myRates.length === 0 && customLines.length === 0 && (
                          <p className="m-0 px-3 py-2 text-xs text-muted-foreground">
                            {t('interventions.quotes.noRates',
                              'Aucun tarif travaux configuré. Vous pouvez tout de même ajouter une prestation ci-dessous.')}
                          </p>
                        )}
                        {ratesByDomain.map(([domain, rates]) => (
                          <div key={domain}>
                            <p className="m-0 bg-muted px-3 py-1 text-2xs font-bold uppercase tracking-wider text-faint">
                              {domain}
                            </p>
                            {rates.map((rate) => {
                              const checked = selectedTypes.includes(rate.interventionType);
                              const line = lineFor(rate.interventionType);
                              return (
                                <div
                                  key={rate.interventionType}
                                  className={cn(
                                    'flex items-center gap-2 border-t border-solid border-border px-3 py-2',
                                    'transition-colors first:border-t-0',
                                    checked ? 'bg-primary-soft' : 'hover:bg-accent',
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    id={`rate-${rate.interventionType}`}
                                    className="size-4 shrink-0 cursor-pointer accent-[var(--bui-primary)]"
                                    checked={checked}
                                    onChange={() => toggleType(rate.interventionType)}
                                  />
                                  <label
                                    htmlFor={`rate-${rate.interventionType}`}
                                    className="min-w-0 flex-1 cursor-pointer truncate text-[13px] text-foreground"
                                  >
                                    {rate.label ?? rate.interventionType}
                                  </label>
                                  {/* Quantite et prix : le bareme est un point
                                      de depart, pas un tarif impose. */}
                                  {checked ? (
                                    <>
                                      <Input
                                        type="number" min={1} step="1"
                                        aria-label={t('interventions.quotes.quantity', 'Quantité')}
                                        className="h-8 w-14 shrink-0 px-1.5 text-center tabular-nums"
                                        value={line.quantity}
                                        onChange={(e) => tweak(rate.interventionType,
                                          { quantity: Math.max(1, Number(e.target.value) || 1) })}
                                      />
                                      <Input
                                        type="number" min={0} step="0.01"
                                        aria-label={t('interventions.quotes.unitPrice', 'Prix unitaire')}
                                        className="h-8 w-20 shrink-0 px-1.5 text-end tabular-nums"
                                        value={line.unitPrice}
                                        onChange={(e) => tweak(rate.interventionType,
                                          { unitPrice: Number(e.target.value) || 0 })}
                                      />
                                    </>
                                  ) : (
                                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-muted-foreground">
                                      {formatCurrency(rate.basePrice, form.currency)}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))}

                        {customLines.length > 0 && (
                          <div>
                            <p className="m-0 bg-muted px-3 py-1 text-2xs font-bold uppercase tracking-wider text-faint">
                              {t('interventions.quotes.customDomain', 'Ajoutées')}
                            </p>
                            {customLines.map((line, index) => (
                              <div
                                key={`custom-${index}`}
                                className="flex items-center gap-2 border-t border-solid border-border bg-primary-soft px-3 py-2"
                              >
                                <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                                  {line.label}
                                </span>
                                <Input
                                  type="number" min={1} step="1"
                                  aria-label={t('interventions.quotes.quantity', 'Quantité')}
                                  className="h-8 w-14 shrink-0 px-1.5 text-center tabular-nums"
                                  value={line.quantity}
                                  onChange={(e) => setCustomLines((prev) => prev.map((l, i) =>
                                    i === index ? { ...l, quantity: Math.max(1, Number(e.target.value) || 1) } : l))}
                                />
                                <Input
                                  type="number" min={0} step="0.01"
                                  aria-label={t('interventions.quotes.unitPrice', 'Prix unitaire')}
                                  className="h-8 w-20 shrink-0 px-1.5 text-end tabular-nums"
                                  value={line.unitPrice}
                                  onChange={(e) => setCustomLines((prev) => prev.map((l, i) =>
                                    i === index ? { ...l, unitPrice: Number(e.target.value) || 0 } : l))}
                                />
                                <Button
                                  variant="ghost" size="icon-sm"
                                  className="shrink-0 text-muted-foreground hover:text-destructive-ink"
                                  aria-label={t('common.delete', 'Supprimer')}
                                  onClick={() => setCustomLines((prev) => prev.filter((_, i) => i !== index))}
                                >
                                  <DeleteOutline size={15} />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Ce que la grille ne prevoit pas — une reprise de platre,
                        un deplacement exceptionnel — s'ajoute ici. */}
                    <div className="mt-2 flex items-end gap-2">
                      <Field className="min-w-0 flex-1">
                        <FieldLabel htmlFor="custom-label" className="text-2xs">
                          {t('interventions.quotes.addLine', 'Autre prestation')}
                        </FieldLabel>
                        <Input
                          id="custom-label"
                          className="h-8"
                          placeholder={t('interventions.quotes.addLinePlaceholder', 'Ex. : reprise d’enduit')}
                          value={newLine.label}
                          onChange={(e) => setNewLine((prev) => ({ ...prev, label: e.target.value }))}
                        />
                      </Field>
                      <Input
                        type="number" min={0} step="0.01"
                        aria-label={t('interventions.quotes.unitPrice', 'Prix unitaire')}
                        className="h-8 w-20 shrink-0 text-end tabular-nums"
                        placeholder="0"
                        value={newLine.unitPrice || ''}
                        onChange={(e) => setNewLine((prev) => ({ ...prev, unitPrice: Number(e.target.value) || 0 }))}
                      />
                      <Button
                        variant="outline" size="sm" className="h-8 shrink-0"
                        disabled={!newLine.label.trim() || newLine.unitPrice <= 0}
                        onClick={() => {
                          setCustomLines((prev) => [...prev, {
                            label: newLine.label.trim(),
                            quantity: 1,
                            unitPrice: newLine.unitPrice,
                            interventionType: null,
                          }]);
                          setNewLine({ label: '', unitPrice: 0 });
                        }}
                      >
                        <Add size={14} />
                      </Button>
                    </div>
                  </div>
                )}

                <div className={cn('grid grid-cols-2 gap-3', canSubmitOwn && 'min-[900px]:col-span-2')}>
                  <Field>
                    <FieldLabel htmlFor="quote-amount">
                      {canSubmitOwn
                        ? t('interventions.quotes.total', 'Total du devis')
                        : t('interventions.quotes.amount', 'Montant')}
                    </FieldLabel>
                    <Input
                      id="quote-amount"
                      className="tabular-nums"
                      type="number" min={0} step="0.01"
                      // Somme des lignes cochees : la modifier a la main
                      // desolidariserait le total de ce qu'il facture.
                      readOnly={canSubmitOwn && (myRates?.length ?? 0) > 0}
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
                <div className={cn('grid grid-cols-2 gap-3', canSubmitOwn && 'min-[900px]:col-span-2')}>
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
                <Field className={canSubmitOwn ? 'min-[900px]:col-span-2' : undefined}>
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
