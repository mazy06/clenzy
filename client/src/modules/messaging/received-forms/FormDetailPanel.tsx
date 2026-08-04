import React, { useEffect, useState } from 'react';
import { cn } from '../../../utils/cn';
import { Button, Spinner } from '../../../components/ui';
import { Field, FieldLabel, FieldDescription, Input, Textarea } from '../../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import {
  Archive as ArchiveIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowRightIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  Description as FileTextIcon,
  Download as DownloadIcon,
  Email as MailIcon,
  History as HistoryIcon,
  LocationOn as MapPinIcon,
  OpenInNew as OpenInNewIcon,
  Phone as PhoneIcon,
  Restore as RestoreIcon,
  Send as SendIcon,
  Warning as AlertTriangleIcon,
} from '../../../icons';
import type { ReceivedForm } from '../../../services/api/receivedFormsApi';
import { useUpdateFormStatus } from '../../../hooks/useReceivedForms';
import { useTemplates, useGenerateDocument, useGenerationsByReference } from '../../documents/hooks/useDocuments';
import { documentsApi } from '../../../services/api/documentsApi';
import { useNotification } from '../../../hooks/useNotification';
import FormPayloadSections from './FormDetailSections';
import { EMAIL_RE, STATUS_PILL, formatFormDate, initialsOf } from './formatters';

/** Map type de formulaire → documentType serveur (parité ReceivedFormsTab). */
const FORM_TO_DOC_TYPE: Record<string, string> = {
  DEVIS: 'DEVIS',
  MAINTENANCE: 'AUTORISATION_TRAVAUX',
  SUPPORT: '',
};

interface FormDetailPanelProps {
  form: ReceivedForm;
  /** Retour mobile vers la liste (master-detail). */
  showBack?: boolean;
  onBack?: () => void;
}

/**
 * Volet droit « formulaire reçu » du hub Messagerie — détail .fr-* de la
 * référence (entête identité + statut, sections payload, actions PDF /
 * Renvoyer / Traité / Archiver-Restaurer, documents générés, aperçu PDF).
 * Données/actions : hooks et services existants (useUpdateFormStatus,
 * documents API) — aucun nouvel endpoint.
 */
export default function FormDetailPanel({ form, showBack = false, onBack }: FormDetailPanelProps) {
  // Éditeur de renvoi du devis (objet + corps modifiables avant envoi).
  const [resend, setResend] = useState<{
    open: boolean; subject: string; body: string; loading: boolean;
  }>({ open: false, subject: '', body: '', loading: false });

  // Aperçu PDF inline (blob URL).
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{ generationId: number; filename: string; createdAt?: string } | null>(null);

  // Détail d'erreur de génération : la liste n'affiche que la 1re ligne ;
  // un clic ouvre la modale avec le message complet.
  const [errorDetail, setErrorDetail] = useState<{ message: string; date?: string } | null>(null);

  const updateStatusMutation = useUpdateFormStatus();
  const { data: templates } = useTemplates();
  const generateDocumentMutation = useGenerateDocument();
  const { data: priorGenerations } = useGenerationsByReference('RECEIVED_FORM', form.id);
  const { notify } = useNotification();

  // Libère le blob URL au close pour ne pas leak de mémoire.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // ─── Handlers (parité ReceivedFormsTab) ────────────────────────────────────

  const handleUpdateStatus = (status: string) => {
    updateStatusMutation.mutate({ id: form.id, status });
  };

  const findActiveTemplate = (formType: string) => {
    const docType = FORM_TO_DOC_TYPE[formType];
    if (!docType || !templates) return null;
    return templates.find((tpl) => tpl.documentType === docType && tpl.active) ?? null;
  };

  const openPreview = async (gen: { id: number; fileName?: string; createdAt?: string }) => {
    try {
      const url = await documentsApi.fetchGenerationBlobUrl(gen.id);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setPreviewMeta({
        generationId: gen.id,
        filename: gen.fileName || `document-${gen.id}.pdf`,
        createdAt: gen.createdAt,
      });
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Impossible de charger le document');
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewMeta(null);
  };

  // « Générer PDF » (send=false) génère + prévisualise SANS envoyer d'email.
  // L'envoi ne part QUE via « Renvoyer » (send=true) après validation explicite.
  const handleGeneratePdf = async (
    opts: { send?: boolean; forceResend?: boolean; overrides?: { subject?: string; body?: string } } = {},
  ) => {
    const { send = false, forceResend = false, overrides } = opts;
    const tpl = findActiveTemplate(form.formType);
    if (!tpl) {
      notify.error('Aucun template actif trouvé pour ce type de formulaire');
      return;
    }
    const emailTo = form.email?.trim() || '';
    const hasValidEmail = EMAIL_RE.test(emailTo);
    const wantsEmail = send && hasValidEmail;
    try {
      const generation = await generateDocumentMutation.mutateAsync({
        documentType: tpl.documentType,
        referenceId: form.id,
        referenceType: 'RECEIVED_FORM',
        sendEmail: wantsEmail,
        emailTo: wantsEmail ? emailTo : undefined,
        forceResend,
        emailSubject: overrides?.subject,
        emailBody: overrides?.body,
      });
      if (generation?.id) {
        if (!send) {
          notify.success("PDF généré — non envoyé. Utilisez « Renvoyer » pour l'adresser au client.");
        } else if (!hasValidEmail) {
          notify.warning('PDF généré, mais email non envoyé : adresse manquante ou invalide.');
        } else if (generation.emailStatus === 'SKIPPED') {
          notify.info(`Le devis avait déjà été envoyé à ${emailTo}.`);
        } else if (generation.emailStatus === 'FAILED') {
          notify.warning("L'envoi de l'email a échoué — réessayez.");
        } else {
          notify.success(`Devis envoyé à ${emailTo}`);
        }
        await openPreview({ id: generation.id, fileName: generation.fileName, createdAt: generation.createdAt });
      } else {
        notify.error('Génération impossible — vérifie que le template DEVIS est compatible avec ce type de formulaire');
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Erreur lors de la génération du PDF');
    }
  };

  const openResendModal = async () => {
    setResend({ open: true, subject: '', body: '', loading: true });
    try {
      const tpl = await documentsApi.getQuoteEmailTemplate();
      setResend((r) => ({ ...r, subject: tpl.subject ?? '', body: tpl.body ?? '', loading: false }));
    } catch {
      setResend((r) => ({ ...r, loading: false }));
    }
  };

  const confirmResend = async () => {
    const { subject, body } = resend;
    setResend((r) => ({ ...r, open: false }));
    await handleGeneratePdf({ send: true, forceResend: true, overrides: { subject, body } });
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const tpl = findActiveTemplate(form.formType);
  const canResend = Boolean(tpl)
    && (priorGenerations?.length ?? 0) > 0
    && EMAIL_RE.test(form.email?.trim() || '');
  const pill = STATUS_PILL[form.status] ?? STATUS_PILL.NEW;

  return (
    <div className="flex-1 min-w-0 overflow-y-auto p-[26px 30px] bg-[var(--bg)]">
      {/* Retour mobile vers la liste */}
      {showBack && (
        <button className="flex items-center justify-center w-[32px] h-[32px] mb-3.5 rounded-[8px] border border-solid border-[var(--line-2)] bg-[var(--card)] text-[var(--muted)] cursor-pointer p-0 hover:text-[var(--accent)] hover:border-[var(--accent)]" style={{ transition: 'color .14s, border-color .14s' }} onClick={onBack} aria-label="Retour">
          <ArrowBackIcon size={16} strokeWidth={1.75} />
        </button>
      )}

      {/* .fr-dhead : entête identité + statut */}
      <div className="flex items-start gap-3.5 pb-[18px]" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="w-[60px] h-[60px] rounded-[50%] shrink-0 flex items-center justify-center font-[family-name:var(--font-display)] font-semibold text-[20px] text-[var(--on-accent)] bg-[var(--accent)]">
          {initialsOf(form.fullName)}
        </div>
        <div className="min-w-0">
          <p className="cn-text-body1 font-[family-name:var(--font-display)] text-[20px] font-semibold text-[var(--ink)] tracking-[-.01em]">
            {form.fullName || 'Anonyme'}
          </p>
          <p className="cn-text-body1 text-[13px] text-[var(--muted)] mt-0.5">
            {form.subject || `Formulaire #${form.id}`}
          </p>
          {/* .fr-dcontact : email / tél / adresse avec icônes accent */}
          <div className="flex flex-wrap items-center gap-y-[7px] gap-x-4 mt-[11px] text-[13px] text-[var(--body)] [&_svg]:text-[var(--accent)] [&_svg]:shrink-0">
            {form.email && (
              <a className="inline-flex items-center gap-[7px] text-[inherit] decoration-[none] hover:text-[var(--ink)]" href={`mailto:${form.email}`}>
                <MailIcon size={15} strokeWidth={1.75} />
                {form.email}
              </a>
            )}
            {form.phone && (
              <a className="inline-flex items-center gap-[7px] text-[inherit] decoration-[none] hover:text-[var(--ink)]" href={`tel:${form.phone.replace(/\s/g, '')}`}>
                <PhoneIcon size={15} strokeWidth={1.75} />
                {form.phone}
              </a>
            )}
            {(form.city || form.postalCode) && (
              <span className="inline-flex items-center gap-[7px]">
                <MapPinIcon size={15} strokeWidth={1.75} />
                {[form.city, form.postalCode].filter(Boolean).join(' ')}
              </span>
            )}
          </div>
        </div>
        {/* .fr-dright : pilule statut + date + IP */}
        <div className="ms-auto text-end shrink-0">
          <span className="inline-flex items-center gap-[7px] text-[11px] font-bold p-[5px 12px] rounded-[20px]" style={{ backgroundColor: pill.bg, color: pill.fg }}>
            <span className="w-[7px] h-[7px] rounded-[50%] bg-[currentColor]" />
            {pill.label}
          </span>
          <p className="cn-text-body1 text-[13px] text-[var(--muted)] mt-2">
            {formatFormDate(form.createdAt)}
          </p>
          {form.ipAddress && (
            <span className="cn-text-body1 inline-block text-[11px] text-[var(--faint)] bg-[var(--field)] rounded-[6px] p-[3px 8px] mt-2 tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>
              IP : {form.ipAddress}
            </span>
          )}
        </div>
      </div>

      {/* Sections payload (aperçu du bien / services / planning) */}
      <FormPayloadSections form={form} />

      {/* .fr-actions : filet top + boutons */}
      <div className="flex items-center gap-2.5 flex-wrap m-[26px 0 0] pt-5" style={{ borderTop: '1px solid var(--line)' }}>
        {/* Un bouton desactive n'emet pas d'evenement de survol : l'enveloppe
            porte le declencheur du Tooltip a sa place. */}
        {tpl && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  onClick={() => handleGeneratePdf()}
                  disabled={generateDocumentMutation.isPending}
                >
                  {generateDocumentMutation.isPending
                    ? <Spinner className="size-[13px]" />
                    : <FileTextIcon size={15} strokeWidth={1.75} />}
                  {generateDocumentMutation.isPending ? 'Génération…' : 'Générer PDF'}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              {`Génère un PDF à partir du template « ${tpl.name} »`}
            </TooltipContent>
          </Tooltip>
        )}
        {canResend && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  variant="outline"
                  onClick={openResendModal}
                  disabled={generateDocumentMutation.isPending}
                >
                  <SendIcon size={15} strokeWidth={1.75} />
                  Renvoyer
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">{`Renvoyer le devis à ${form.email}`}</TooltipContent>
          </Tooltip>
        )}
        {form.status !== 'PROCESSED' && form.status !== 'ARCHIVED' && (
          <Button
            variant="outline"
            onClick={() => handleUpdateStatus('PROCESSED')}
            disabled={updateStatusMutation.isPending}
          >
            <CheckCircleIcon size={15} strokeWidth={1.75} />
            Marquer traité
          </Button>
        )}
        {form.status !== 'ARCHIVED' ? (
          <Button
            variant="ghost"
            className="text-[var(--muted)] hover:text-[var(--err)]"
            onClick={() => handleUpdateStatus('ARCHIVED')}
            disabled={updateStatusMutation.isPending}
          >
            <ArchiveIcon size={15} strokeWidth={1.75} />
            Archiver
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => handleUpdateStatus('READ')}
            disabled={updateStatusMutation.isPending}
          >
            <RestoreIcon size={15} strokeWidth={1.75} />
            Restaurer
          </Button>
        )}
        {!tpl && form.formType === 'DEVIS' && (
          <p className="cn-text-body1 text-[11px] text-[var(--faint)] italic flex-1 min-w-[200px]">
            Aucun template DEVIS actif — ajoute-en un dans Documents & Communications pour activer la génération PDF.
          </p>
        )}
      </div>

      {/* .fr-docs : documents générés */}
      {priorGenerations && priorGenerations.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3 text-[13px] font-bold text-[var(--ink)] [&_svg]:text-[var(--muted)]">
            <HistoryIcon size={15} strokeWidth={1.75} />
            Documents générés ({priorGenerations.length})
          </div>
          <div className="flex flex-col gap-2">
            {priorGenerations.slice(0, 5).map((gen) => {
              const isFailed = gen.status === 'FAILED';
              return (
                <div
                  key={gen.id}
                  onClick={isFailed
                    ? () => setErrorDetail({ message: gen.errorMessage || 'Cause inconnue', date: gen.createdAt })
                    : () => openPreview(gen)}
                  className={cn(
                    'flex items-center gap-3 py-[13px] px-[15px] border border-solid rounded-[12px] cursor-pointer',
                    'transition-[border-color,box-shadow] duration-[140ms]',
                    isFailed
                      ? 'border-[var(--err)] bg-[var(--err-soft)] hover:shadow-[0_8px_22px_-16px_var(--err)]'
                      : 'border-[var(--line)] bg-transparent hover:border-[var(--accent)] hover:shadow-[0_8px_22px_-16px_var(--accent)]',
                  )}
                >
                  <div className="w-[34px] h-[34px] rounded-[9px] bg-[var(--err)] text-[var(--on-accent)] flex items-center justify-center shrink-0 text-[9px] font-extrabold">
                    {isFailed ? <AlertTriangleIcon size={15} strokeWidth={1.75} /> : 'PDF'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'cn-text-body1 text-[13px] font-semibold truncate',
                      isFailed ? 'text-[var(--err)]' : 'text-[var(--ink)]',
                    )}>
                      {isFailed ? 'Échec de génération' : (gen.fileName || `document-${gen.id}.pdf`)}
                    </p>
                    {/* Erreur : 1re ligne uniquement (tronquée) — détail complet dans la modale au clic. */}
                    <p className="cn-text-body1 text-[11.5px] text-[var(--muted)] mt-[1px] truncate">
                      {isFailed
                        ? `${gen.errorMessage || 'Cause inconnue'}${gen.createdAt ? ` · ${formatFormDate(gen.createdAt)}` : ''}`
                        : [gen.legalNumber, gen.createdAt ? formatFormDate(gen.createdAt) : '']
                            .filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className={cn('ms-auto inline-flex items-center gap-1 text-[12.5px] font-semibold whitespace-nowrap shrink-0', isFailed ? 'text-[var(--err)]' : 'text-[var(--accent)]')}>
                    {isFailed ? 'Détail' : 'Aperçu'}
                    <ArrowRightIcon size={14} strokeWidth={1.75} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Aperçu PDF inline ── */}
      <Dialog open={Boolean(previewUrl)} onOpenChange={(next) => { if (!next) closePreview(); }}>
        {/* Visionneuse plein cadre : padding annule, la croix maison remplace celle du kit. */}
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-5xl h-[92vh] flex flex-col gap-0 p-0 overflow-hidden"
        >
          <DialogHeader className="flex-row items-center gap-1.5 py-[7.5px] px-3 border-b border-solid border-b-[var(--line)] bg-[var(--surface-2)]">
            <span className="inline-flex text-[var(--err)]">
              <FileTextIcon size={18} strokeWidth={1.75} />
            </span>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-[13px] font-bold text-[var(--ink)] overflow-hidden text-ellipsis whitespace-nowrap">
                {previewMeta?.filename || 'Aperçu du document'}
              </DialogTitle>
              {previewMeta?.createdAt && (
                <DialogDescription className="text-[11px] text-[var(--muted)]">
                  Généré le {formatFormDate(previewMeta.createdAt)}
                </DialogDescription>
              )}
            </div>
            {previewUrl && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Ouvrir dans un nouvel onglet"
                      onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
                    >
                      <OpenInNewIcon size={16} strokeWidth={1.75} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ouvrir dans un nouvel onglet</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Télécharger"
                      onClick={() => {
                        if (!previewMeta) return;
                        const link = document.createElement('a');
                        link.href = previewUrl;
                        link.download = previewMeta.filename;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                    >
                      <DownloadIcon size={16} strokeWidth={1.75} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Télécharger</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Fermer" onClick={closePreview}>
                      <CloseIcon size={18} strokeWidth={1.75} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Fermer</TooltipContent>
                </Tooltip>
              </>
            )}
          </DialogHeader>
          {/* #525659 : gris du visionneur PDF standard */}
          <div className="flex-1 min-h-0 bg-[#525659]">
            {previewUrl && (
              <iframe className="w-full h-full border-none block" src={previewUrl} title={previewMeta?.filename || 'PDF'} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Éditeur de renvoi du devis (objet + corps modifiables) ── */}
      <Dialog
        open={resend.open}
        onOpenChange={(next) => { if (!next) setResend((r) => ({ ...r, open: false })); }}
      >
        <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-bold text-[1rem]">
            Renvoyer le devis
          </DialogTitle>
          {form.email ? (
            <DialogDescription className="cn-text-body2 text-[var(--muted)]">
              À {form.email} — info@clenzy.fr en copie
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {resend.loading ? (
            <div className="flex justify-center py-6">
              <Spinner className="size-[22px] text-[var(--accent)]" />
            </div>
          ) : (
            <>
              <Field>
                <FieldLabel htmlFor="resend-quote-subject">Objet</FieldLabel>
                <Input
                  id="resend-quote-subject"
                  className="w-full"
                  value={resend.subject}
                  onChange={(e) => setResend((r) => ({ ...r, subject: e.target.value }))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="resend-quote-body">Corps du message</FieldLabel>
                {/* Le primitif pose field-sizing:content, qui neutralise `rows` :
                    la hauteur de 6 lignes est garantie par min-h. */}
                <Textarea
                  id="resend-quote-body"
                  className="w-full min-h-[6lh]"
                  value={resend.body}
                  onChange={(e) => setResend((r) => ({ ...r, body: e.target.value }))}
                />
                <FieldDescription>
                  Conservez, modifiez ou videz le contenu. Le PDF du devis est joint automatiquement.
                </FieldDescription>
              </Field>
            </>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            className="me-auto"
            onClick={() => setResend((r) => ({ ...r, body: '' }))}
            disabled={resend.loading}
          >
            Vider le contenu
          </Button>
          <Button variant="ghost" onClick={() => setResend((r) => ({ ...r, open: false }))}>
            Annuler
          </Button>
          <Button
            onClick={confirmResend}
            disabled={resend.loading || generateDocumentMutation.isPending || !resend.subject.trim()}
          >
            Renvoyer
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modale : message d'erreur de génération complet (la liste n'en montre que la 1re ligne). */}
      <Dialog
        open={errorDetail !== null}
        onOpenChange={(next) => { if (!next) setErrorDetail(null); }}
      >
        {/* La croix de fermeture est fournie par DialogContent : `pe-14` reserve sa place. */}
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="flex-row items-center gap-1.5 pe-14">
            <span className="inline-flex text-[var(--err)]">
              <AlertTriangleIcon size={18} strokeWidth={1.75} />
            </span>
            <DialogTitle className="font-bold text-[1rem] text-[var(--err)]">
              Échec de génération
            </DialogTitle>
          </DialogHeader>
          <div>
            {errorDetail?.date && (
              <p className="cn-text-body1 text-[12px] text-[var(--muted)] mb-1.5">
                {formatFormDate(errorDetail.date)}
              </p>
            )}
            <div className="text-[12.5px] leading-[1.6] text-[var(--ink)] whitespace-pre-wrap break-words bg-[var(--err-soft)] border border-solid border-[var(--err)] rounded-[10px] p-[9px] max-h-[55vh] overflow-y-auto select-text" style={{ fontFamily: 'monospace' }}>
              {errorDetail?.message}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
