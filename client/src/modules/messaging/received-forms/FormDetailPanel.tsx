import React, { useEffect, useState } from 'react';
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
    <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto', p: '26px 30px', bgcolor: 'var(--bg)' }}>
      {/* Retour mobile vers la liste */}
      {showBack && (
        <Box
          component="button"
          onClick={onBack}
          aria-label="Retour"
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, mb: '14px', borderRadius: '8px',
            border: '1px solid var(--line-2)', bgcolor: 'var(--card)', color: 'var(--muted)',
            cursor: 'pointer', p: 0, transition: 'color .14s, border-color .14s',
            '&:hover': { color: 'var(--accent)', borderColor: 'var(--accent)' },
          }}
        >
          <ArrowBackIcon size={16} strokeWidth={1.75} />
        </Box>
      )}

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
          {initialsOf(form.fullName)}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{
            fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 600,
            color: 'var(--ink)', letterSpacing: '-.01em',
          }}>
            {form.fullName || 'Anonyme'}
          </Typography>
          <Typography sx={{ fontSize: '13px', color: 'var(--muted)', mt: '2px' }}>
            {form.subject || `Formulaire #${form.id}`}
          </Typography>
          {/* .fr-dcontact : email / tél / adresse avec icônes accent */}
          <Box sx={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '7px 16px',
            mt: '11px', fontSize: '13px', color: 'var(--body)',
            '& svg': { color: 'var(--accent)', flexShrink: 0 },
          }}>
            {form.email && (
              <Box component="a" href={`mailto:${form.email}`} sx={{
                display: 'inline-flex', alignItems: 'center', gap: '7px',
                color: 'inherit', textDecoration: 'none', '&:hover': { color: 'var(--ink)' },
              }}>
                <MailIcon size={15} strokeWidth={1.75} />
                {form.email}
              </Box>
            )}
            {form.phone && (
              <Box component="a" href={`tel:${form.phone.replace(/\s/g, '')}`} sx={{
                display: 'inline-flex', alignItems: 'center', gap: '7px',
                color: 'inherit', textDecoration: 'none', '&:hover': { color: 'var(--ink)' },
              }}>
                <PhoneIcon size={15} strokeWidth={1.75} />
                {form.phone}
              </Box>
            )}
            {(form.city || form.postalCode) && (
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                <MapPinIcon size={15} strokeWidth={1.75} />
                {[form.city, form.postalCode].filter(Boolean).join(' ')}
              </Box>
            )}
          </Box>
        </Box>
        {/* .fr-dright : pilule statut + date + IP */}
        <Box sx={{ ml: 'auto', textAlign: 'right', flexShrink: 0 }}>
          <Box component="span" sx={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            fontSize: '11px', fontWeight: 700, p: '5px 12px', borderRadius: '20px',
            bgcolor: pill.bg, color: pill.fg,
          }}>
            <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'currentColor' }} />
            {pill.label}
          </Box>
          <Typography sx={{ fontSize: '13px', color: 'var(--muted)', mt: '8px' }}>
            {formatFormDate(form.createdAt)}
          </Typography>
          {form.ipAddress && (
            <Typography component="span" sx={{
              display: 'inline-block', fontFamily: 'var(--font-display)', fontSize: '11px',
              color: 'var(--faint)', bgcolor: 'var(--field)', borderRadius: '6px',
              p: '3px 8px', mt: '8px', fontVariantNumeric: 'tabular-nums',
            }}>
              IP : {form.ipAddress}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Sections payload (aperçu du bien / services / planning) */}
      <FormPayloadSections form={form} />

      {/* .fr-actions : filet top + boutons */}
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
              onClick={() => handleGeneratePdf()}
              disabled={generateDocumentMutation.isPending}
            >
              {generateDocumentMutation.isPending ? 'Génération…' : 'Générer PDF'}
            </Button>
          </Tooltip>
        )}
        {canResend && (
          <Tooltip title={`Renvoyer le devis à ${form.email}`} placement="top" arrow>
            <Button
              variant="outlined"
              size="small"
              startIcon={<SendIcon size={15} strokeWidth={1.75} />}
              onClick={openResendModal}
              disabled={generateDocumentMutation.isPending}
            >
              Renvoyer
            </Button>
          </Tooltip>
        )}
        {form.status !== 'PROCESSED' && form.status !== 'ARCHIVED' && (
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
        {form.status !== 'ARCHIVED' ? (
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
        {!tpl && form.formType === 'DEVIS' && (
          <Typography sx={{ fontSize: '11px', color: 'var(--faint)', fontStyle: 'italic', flex: 1, minWidth: 200 }}>
            Aucun template DEVIS actif — ajoute-en un dans Documents & Communications pour activer la génération PDF.
          </Typography>
        )}
      </Box>

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
          {form.email ? (
            <Typography variant="body2" sx={{ color: 'var(--muted)', mt: 0.5 }}>
              À {form.email} — info@clenzy.fr en copie
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
