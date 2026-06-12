import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Archive as ArchiveIcon,
  ArrowForward as ArrowRightIcon,
  Check as CheckIcon,
  CheckCircle as CheckCircleIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon,
  Description as FileTextIcon,
  Download as DownloadIcon,
  Email as MailIcon,
  Handyman as HandymanIcon,
  History as HistoryIcon,
  Inbox as InboxIcon,
  LocationOn as MapPinIcon,
  OpenInNew as OpenInNewIcon,
  Phone as PhoneIcon,
  Restore as RestoreIcon,
  Send as SendIcon,
  SupportAgent as SupportIcon,
  Warning as AlertTriangleIcon,
} from '../../../icons';
import type { ReceivedForm } from '../../../services/api/receivedFormsApi';
import { useReceivedForms, useUpdateFormStatus } from '../../../hooks/useReceivedForms';
import { useTemplates, useGenerateDocument, useGenerationsByReference } from '../../documents/hooks/useDocuments';
import { documentsApi } from '../../../services/api/documentsApi';
import { useNotification } from '../../../hooks/useNotification';
import FormPayloadSections from './received-forms/FormDetailSections';
import { EMAIL_RE, STATUS_PILL, formatFormDate, initialsOf } from './received-forms/formatters';

const PAGE_SIZE = 20;

/** Map type de formulaire → documentType serveur (parité ReceivedFormsTab). */
const FORM_TO_DOC_TYPE: Record<string, string> = {
  DEVIS: 'DEVIS',
  MAINTENANCE: 'AUTORISATION_TRAVAUX',
  SUPPORT: '',
};

function typeIcon(formType: ReceivedForm['formType'], size = 12) {
  if (formType === 'MAINTENANCE') return <HandymanIcon size={size} strokeWidth={1.75} />;
  if (formType === 'SUPPORT') return <SupportIcon size={size} strokeWidth={1.75} />;
  return <FileTextIcon size={size} strokeWidth={1.75} />;
}

/** Bouton du pager (.fr-pager button) : 28×28 r8 hairline, hover accent. */
function PagerButton({ disabled, onClick, children, label }: {
  disabled: boolean; onClick: () => void; children: React.ReactNode; label: string;
}) {
  return (
    <Box
      component="button"
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      sx={{
        width: 28, height: 28, borderRadius: '8px', border: '1px solid var(--line-2)',
        bgcolor: 'var(--card)', color: 'var(--muted)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', p: 0,
        transition: 'color .14s, border-color .14s',
        '&:hover:not(:disabled)': { color: 'var(--accent)', borderColor: 'var(--accent)' },
        '&:disabled': { opacity: 0.45, cursor: 'default' },
      }}
    >
      {children}
    </Box>
  );
}

/**
 * Volet « Formulaires reçus » du hub Messagerie.
 *
 * Design : référence « Messagerie Formulaires », section B (.fr-*) — liste
 * 380px + détail (aperçu du bien, services, planning, actions, documents).
 * Données/actions : hooks et services existants de l'écran Contact
 * (useReceivedForms, useUpdateFormStatus, documents API) — aucun nouvel endpoint.
 */
export default function ReceivedFormsPane() {
  const [page, setPage] = useState(0);
  const [selectedForm, setSelectedForm] = useState<ReceivedForm | null>(null);

  // Éditeur de renvoi du devis (objet + corps modifiables avant envoi).
  const [resend, setResend] = useState<{
    open: boolean; form: ReceivedForm | null; subject: string; body: string; loading: boolean;
  }>({ open: false, form: null, subject: '', body: '', loading: false });

  // Aperçu PDF inline (blob URL).
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{ generationId: number; filename: string; createdAt?: string } | null>(null);

  const queryParams = useMemo(() => ({ page, size: PAGE_SIZE }), [page]);
  const { data: formsPage, isLoading } = useReceivedForms(queryParams);
  const updateStatusMutation = useUpdateFormStatus();
  const { data: templates } = useTemplates();
  const generateDocumentMutation = useGenerateDocument();
  const { data: priorGenerations } = useGenerationsByReference('RECEIVED_FORM', selectedForm?.id ?? 0);
  const { notify } = useNotification();

  const forms = formsPage?.content ?? [];
  const totalElements = formsPage?.totalElements ?? 0;

  // Auto-sélection du premier formulaire (référence : frSel = 0). Ne marque
  // PAS « lu » — seul un clic utilisateur déclenche NEW → READ.
  useEffect(() => {
    if (formsPage && formsPage.content.length > 0) {
      setSelectedForm((prev) => prev ?? formsPage.content[0]);
    }
  }, [formsPage]);

  // Libère le blob URL au close pour ne pas leak de mémoire.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // ─── Handlers (parité ReceivedFormsTab) ────────────────────────────────────

  const handleSelect = (form: ReceivedForm) => {
    setSelectedForm(form);
    if (form.status === 'NEW') {
      updateStatusMutation.mutate({ id: form.id, status: 'READ' });
    }
  };

  const handleUpdateStatus = (status: string) => {
    if (!selectedForm) return;
    updateStatusMutation.mutate(
      { id: selectedForm.id, status },
      {
        onSuccess: (updated) => {
          if (updated) {
            setSelectedForm((prev) => (prev && prev.id === selectedForm.id ? { ...prev, ...updated } : prev));
          }
        },
      },
    );
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
    form: ReceivedForm,
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

  const openResendModal = async (form: ReceivedForm) => {
    setResend({ open: true, form, subject: '', body: '', loading: true });
    try {
      const tpl = await documentsApi.getQuoteEmailTemplate();
      setResend((r) => ({ ...r, subject: tpl.subject ?? '', body: tpl.body ?? '', loading: false }));
    } catch {
      setResend((r) => ({ ...r, loading: false }));
    }
  };

  const confirmResend = async () => {
    const { form, subject, body } = resend;
    if (!form) return;
    setResend((r) => ({ ...r, open: false }));
    await handleGeneratePdf(form, { send: true, forceResend: true, overrides: { subject, body } });
  };

  // ─── Pager ─────────────────────────────────────────────────────────────────

  const pageStart = totalElements === 0 ? 0 : page * PAGE_SIZE + 1;
  const pageEnd = Math.min((page + 1) * PAGE_SIZE, totalElements);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flex: 1, height: '100%', minHeight: 0, overflow: 'hidden', bgcolor: 'var(--bg)' }}>

      {/* ─── .fr-list : liste 380px ─── */}
      <Box sx={{
        width: 380, flexShrink: 0, borderRight: '1px solid var(--line)',
        display: 'flex', flexDirection: 'column', bgcolor: 'var(--card)', minHeight: 0,
      }}>
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: '48px' }}>
              <CircularProgress size={26} sx={{ color: 'var(--accent)' }} />
            </Box>
          ) : forms.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', pt: '56px', px: '24px' }}>
              <Box sx={{
                width: 44, height: 44, borderRadius: '50%', bgcolor: 'var(--accent-soft)', color: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <InboxIcon size={20} strokeWidth={1.75} />
              </Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>Aucun formulaire reçu</Typography>
              <Typography sx={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }}>
                Les formulaires soumis depuis la landing page apparaîtront ici.
              </Typography>
            </Box>
          ) : (
            forms.map((form) => {
              const isSelected = selectedForm?.id === form.id;
              return (
                <Box
                  key={form.id}
                  onClick={() => handleSelect(form)}
                  sx={{
                    display: 'flex', gap: '12px', p: '14px 16px', borderBottom: '1px solid var(--line)',
                    cursor: 'pointer', position: 'relative', transition: 'background .12s',
                    bgcolor: isSelected ? 'var(--accent-soft)' : 'transparent',
                    '&:hover': { bgcolor: isSelected ? 'var(--accent-soft)' : 'var(--bg)' },
                    ...(isSelected && {
                      '&::before': {
                        content: '""', position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: '3px', bgcolor: 'var(--accent)',
                      },
                    }),
                  }}
                >
                  {/* .fr-avt : avatar rond 42 accent */}
                  <Box sx={{
                    width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '14px',
                    color: 'var(--on-accent)', bgcolor: 'var(--accent)',
                  }}>
                    {initialsOf(form.fullName)}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Typography sx={{
                        fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {form.fullName}
                      </Typography>
                      <Typography sx={{ ml: 'auto', fontSize: '11px', color: 'var(--faint)', flexShrink: 0 }}>
                        {formatFormDate(form.createdAt)}
                      </Typography>
                    </Box>
                    <Box sx={{
                      display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px',
                      color: 'var(--muted)', m: '2px 0 4px',
                    }}>
                      {typeIcon(form.formType)}
                      {form.city && (
                        <>
                          <MapPinIcon size={12} strokeWidth={1.75} />
                          <Typography component="span" sx={{
                            fontSize: '11.5px', color: 'var(--muted)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {form.city}
                          </Typography>
                        </>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <Typography sx={{
                        fontSize: '12px', color: 'var(--body)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {form.subject || `Formulaire #${form.id}`}
                      </Typography>
                      {form.status === 'PROCESSED' && (
                        <Box component="span" sx={{ display: 'inline-flex', color: 'var(--ok)', flexShrink: 0 }}>
                          <CheckIcon size={13} strokeWidth={2.25} />
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Box>
              );
            })
          )}
        </Box>

        {/* .fr-pager : 1–N sur M */}
        {totalElements > 0 && (
          <Box sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px',
            p: '12px', borderTop: '1px solid var(--line)', fontSize: '12px', color: 'var(--muted)', flexShrink: 0,
          }}>
            <PagerButton label="Page précédente" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              <ChevronLeftIcon size={15} strokeWidth={1.75} />
            </PagerButton>
            <Typography component="span" sx={{ fontSize: '12px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
              {pageStart}–{pageEnd} sur {totalElements}
            </Typography>
            <PagerButton label="Page suivante" disabled={pageEnd >= totalElements} onClick={() => setPage((p) => p + 1)}>
              <ChevronRightIcon size={15} strokeWidth={1.75} />
            </PagerButton>
          </Box>
        )}
      </Box>

      {/* ─── .fr-detail ─── */}
      <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto', p: '26px 30px' }}>
        {selectedForm ? (
          <>
            {/* .fr-dhead : entête identité + statut */}
            <Box sx={{
              display: 'flex', alignItems: 'flex-start', gap: '14px',
              pb: '18px', borderBottom: '1px solid var(--line)',
            }}>
              <Box sx={{
                width: 60, height: 60, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '20px',
                color: 'var(--on-accent)', bgcolor: 'var(--accent)',
              }}>
                {initialsOf(selectedForm.fullName)}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{
                  fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 600,
                  color: 'var(--ink)', letterSpacing: '-.01em',
                }}>
                  {selectedForm.fullName || 'Anonyme'}
                </Typography>
                <Typography sx={{ fontSize: '13px', color: 'var(--muted)', mt: '2px' }}>
                  {selectedForm.subject || `Formulaire #${selectedForm.id}`}
                </Typography>
                {/* .fr-dcontact : email / tél / adresse avec icônes accent */}
                <Box sx={{
                  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '7px 16px',
                  mt: '11px', fontSize: '13px', color: 'var(--body)',
                  '& svg': { color: 'var(--accent)', flexShrink: 0 },
                }}>
                  {selectedForm.email && (
                    <Box component="a" href={`mailto:${selectedForm.email}`} sx={{
                      display: 'inline-flex', alignItems: 'center', gap: '7px',
                      color: 'inherit', textDecoration: 'none', '&:hover': { color: 'var(--ink)' },
                    }}>
                      <MailIcon size={15} strokeWidth={1.75} />
                      {selectedForm.email}
                    </Box>
                  )}
                  {selectedForm.phone && (
                    <Box component="a" href={`tel:${selectedForm.phone.replace(/\s/g, '')}`} sx={{
                      display: 'inline-flex', alignItems: 'center', gap: '7px',
                      color: 'inherit', textDecoration: 'none', '&:hover': { color: 'var(--ink)' },
                    }}>
                      <PhoneIcon size={15} strokeWidth={1.75} />
                      {selectedForm.phone}
                    </Box>
                  )}
                  {(selectedForm.city || selectedForm.postalCode) && (
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                      <MapPinIcon size={15} strokeWidth={1.75} />
                      {[selectedForm.city, selectedForm.postalCode].filter(Boolean).join(' ')}
                    </Box>
                  )}
                </Box>
              </Box>
              {/* .fr-dright : pilule statut + date + IP */}
              <Box sx={{ ml: 'auto', textAlign: 'right', flexShrink: 0 }}>
                {(() => {
                  const pill = STATUS_PILL[selectedForm.status] ?? STATUS_PILL.NEW;
                  return (
                    <Box component="span" sx={{
                      display: 'inline-flex', alignItems: 'center', gap: '7px',
                      fontSize: '11px', fontWeight: 700, p: '5px 12px', borderRadius: '20px',
                      bgcolor: pill.bg, color: pill.fg,
                    }}>
                      <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'currentColor' }} />
                      {pill.label}
                    </Box>
                  );
                })()}
                <Typography sx={{ fontSize: '13px', color: 'var(--muted)', mt: '8px' }}>
                  {formatFormDate(selectedForm.createdAt)}
                </Typography>
                {selectedForm.ipAddress && (
                  <Typography component="span" sx={{
                    display: 'inline-block', fontFamily: 'var(--font-display)', fontSize: '11px',
                    color: 'var(--faint)', bgcolor: 'var(--field)', borderRadius: '6px',
                    p: '3px 8px', mt: '8px', fontVariantNumeric: 'tabular-nums',
                  }}>
                    IP : {selectedForm.ipAddress}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Sections payload (aperçu du bien / services / planning) */}
            <FormPayloadSections form={selectedForm} />

            {/* .fr-actions : filet top + boutons */}
            {(() => {
              const tpl = findActiveTemplate(selectedForm.formType);
              const canResend = Boolean(tpl)
                && (priorGenerations?.length ?? 0) > 0
                && EMAIL_RE.test(selectedForm.email?.trim() || '');
              return (
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                  m: '26px 0 0', pt: '20px', borderTop: '1px solid var(--line)',
                }}>
                  {tpl && (
                    <Tooltip title={`Génère un PDF à partir du template « ${tpl.name} »`} placement="top" arrow>
                      <Button
                        variant="contained"
                        color="primary"
                        size="small"
                        startIcon={generateDocumentMutation.isPending
                          ? <CircularProgress size={13} color="inherit" />
                          : <FileTextIcon size={15} strokeWidth={1.75} />}
                        onClick={() => handleGeneratePdf(selectedForm)}
                        disabled={generateDocumentMutation.isPending}
                      >
                        {generateDocumentMutation.isPending ? 'Génération…' : 'Générer PDF'}
                      </Button>
                    </Tooltip>
                  )}
                  {canResend && (
                    <Tooltip title={`Renvoyer le devis à ${selectedForm.email}`} placement="top" arrow>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<SendIcon size={15} strokeWidth={1.75} />}
                        onClick={() => openResendModal(selectedForm)}
                        disabled={generateDocumentMutation.isPending}
                      >
                        Renvoyer
                      </Button>
                    </Tooltip>
                  )}
                  {selectedForm.status !== 'PROCESSED' && selectedForm.status !== 'ARCHIVED' && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<CheckCircleIcon size={15} strokeWidth={1.75} />}
                      onClick={() => handleUpdateStatus('PROCESSED')}
                      disabled={updateStatusMutation.isPending}
                    >
                      Marquer traité
                    </Button>
                  )}
                  {selectedForm.status !== 'ARCHIVED' ? (
                    <Button
                      variant="text"
                      size="small"
                      startIcon={<ArchiveIcon size={15} strokeWidth={1.75} />}
                      onClick={() => handleUpdateStatus('ARCHIVED')}
                      disabled={updateStatusMutation.isPending}
                      sx={{
                        color: 'var(--muted)', px: '8px',
                        '&:hover': { color: 'var(--err)', bgcolor: 'transparent' },
                      }}
                    >
                      Archiver
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<RestoreIcon size={15} strokeWidth={1.75} />}
                      onClick={() => handleUpdateStatus('READ')}
                      disabled={updateStatusMutation.isPending}
                    >
                      Restaurer
                    </Button>
                  )}
                  {!tpl && selectedForm.formType === 'DEVIS' && (
                    <Typography sx={{ fontSize: '11px', color: 'var(--faint)', fontStyle: 'italic', flex: 1, minWidth: 200 }}>
                      Aucun template DEVIS actif — ajoute-en un dans Documents & Communications pour activer la génération PDF.
                    </Typography>
                  )}
                </Box>
              );
            })()}

            {/* .fr-docs : documents générés */}
            {priorGenerations && priorGenerations.length > 0 && (
              <Box sx={{ mt: '24px' }}>
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: '8px', mb: '12px',
                  fontSize: '13px', fontWeight: 700, color: 'var(--ink)',
                  '& svg': { color: 'var(--muted)' },
                }}>
                  <HistoryIcon size={15} strokeWidth={1.75} />
                  Documents générés ({priorGenerations.length})
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {priorGenerations.slice(0, 5).map((gen) => {
                    const isFailed = gen.status === 'FAILED';
                    return (
                      <Box
                        key={gen.id}
                        onClick={isFailed ? undefined : () => openPreview(gen)}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: '12px', p: '13px 15px',
                          border: '1px solid', borderColor: isFailed ? 'var(--err)' : 'var(--line)',
                          borderRadius: '12px', cursor: isFailed ? 'default' : 'pointer',
                          bgcolor: isFailed ? 'var(--err-soft)' : 'transparent',
                          transition: 'border-color .14s, box-shadow .14s',
                          ...(isFailed ? {} : {
                            '&:hover': { borderColor: 'var(--accent)', boxShadow: '0 8px 22px -16px var(--accent)' },
                          }),
                        }}
                      >
                        <Box sx={{
                          width: 34, height: 34, borderRadius: '9px', bgcolor: 'var(--err)', color: 'var(--on-accent)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          fontSize: '9px', fontWeight: 800,
                        }}>
                          {isFailed ? <AlertTriangleIcon size={15} strokeWidth={1.75} /> : 'PDF'}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{
                            fontSize: '13px', fontWeight: 600, color: isFailed ? 'var(--err)' : 'var(--ink)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isFailed ? 'normal' : 'nowrap',
                          }}>
                            {isFailed ? 'Échec de génération' : (gen.fileName || `document-${gen.id}.pdf`)}
                          </Typography>
                          <Typography sx={{ fontSize: '11.5px', color: 'var(--muted)', mt: '1px' }}>
                            {isFailed
                              ? `${gen.errorMessage || 'Cause inconnue'}${gen.createdAt ? ` · ${formatFormDate(gen.createdAt)}` : ''}`
                              : [gen.legalNumber, gen.createdAt ? formatFormDate(gen.createdAt) : '']
                                  .filter(Boolean).join(' · ')}
                          </Typography>
                        </Box>
                        {!isFailed && (
                          <Box component="span" sx={{
                            ml: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px',
                            fontSize: '12.5px', fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap', flexShrink: 0,
                          }}>
                            Aperçu
                            <ArrowRightIcon size={14} strokeWidth={1.75} />
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}
          </>
        ) : (
          <Box sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: '10px', color: 'var(--faint)',
          }}>
            <FileTextIcon size={44} strokeWidth={1.5} />
            <Typography sx={{ fontSize: '13px', color: 'var(--muted)' }}>
              Sélectionnez un formulaire pour voir son contenu
            </Typography>
          </Box>
        )}
      </Box>

      {/* ── Aperçu PDF inline ── */}
      <Dialog
        open={Boolean(previewUrl)}
        onClose={closePreview}
        fullWidth
        maxWidth="lg"
        PaperProps={{ sx: { height: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
      >
        <DialogTitle sx={{
          display: 'flex', alignItems: 'center', gap: 1, py: 1.25, px: 2,
          borderBottom: '1px solid var(--line)', bgcolor: 'var(--surface-2)',
        }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'var(--err)' }}>
            <FileTextIcon size={18} strokeWidth={1.75} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{
              fontSize: '13px', fontWeight: 700, color: 'var(--ink)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {previewMeta?.filename || 'Aperçu du document'}
            </Typography>
            {previewMeta?.createdAt && (
              <Typography sx={{ fontSize: '11px', color: 'var(--muted)' }}>
                Généré le {formatFormDate(previewMeta.createdAt)}
              </Typography>
            )}
          </Box>
          {previewUrl && (
            <>
              <Tooltip title="Ouvrir dans un nouvel onglet">
                <IconButton size="small" onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}>
                  <OpenInNewIcon size={16} strokeWidth={1.75} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Télécharger">
                <IconButton
                  size="small"
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
                </IconButton>
              </Tooltip>
              <Tooltip title="Fermer">
                <IconButton size="small" onClick={closePreview}>
                  <CloseIcon size={18} strokeWidth={1.75} />
                </IconButton>
              </Tooltip>
            </>
          )}
        </DialogTitle>
        <DialogContent sx={{ p: 0, flex: 1, bgcolor: '#525659' /* gris viewer PDF standard */ }}>
          {previewUrl && (
            <Box
              component="iframe"
              src={previewUrl}
              title={previewMeta?.filename || 'PDF'}
              sx={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Éditeur de renvoi du devis (objet + corps modifiables) ── */}
      <Dialog
        open={resend.open}
        onClose={() => setResend((r) => ({ ...r, open: false }))}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>
          Renvoyer le devis
          {resend.form?.email ? (
            <Typography variant="body2" sx={{ color: 'var(--muted)', mt: 0.5 }}>
              À {resend.form.email} — info@clenzy.fr en copie
            </Typography>
          ) : null}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {resend.loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={22} sx={{ color: 'var(--accent)' }} />
            </Box>
          ) : (
            <>
              <TextField
                label="Objet"
                value={resend.subject}
                onChange={(e) => setResend((r) => ({ ...r, subject: e.target.value }))}
                fullWidth
                size="small"
              />
              <TextField
                label="Corps du message"
                value={resend.body}
                onChange={(e) => setResend((r) => ({ ...r, body: e.target.value }))}
                fullWidth
                multiline
                minRows={6}
                helperText="Conservez, modifiez ou videz le contenu. Le PDF du devis est joint automatiquement."
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="text"
            onClick={() => setResend((r) => ({ ...r, body: '' }))}
            disabled={resend.loading}
            sx={{ mr: 'auto' }}
          >
            Vider le contenu
          </Button>
          <Button variant="text" onClick={() => setResend((r) => ({ ...r, open: false }))}>
            Annuler
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={confirmResend}
            disabled={resend.loading || generateDocumentMutation.isPending || !resend.subject.trim()}
          >
            Renvoyer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
