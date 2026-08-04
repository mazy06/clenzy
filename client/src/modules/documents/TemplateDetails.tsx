import React, { useState, useEffect, useRef } from 'react';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { TriangleAlert, X } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Card } from '../../components/ui';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  buttonVariants,
} from '../../components/ui';
import { cn } from '../../utils/cn';
import { Field, FieldLabel, Input, Textarea } from '../../components/ui';
import StatusChip from '../../components/StatusChip';
import {
  ArrowBack,
  Edit,
  Save,
  Cancel,
  CheckCircle,
  Refresh,
  Delete,
  Download,
  Visibility,
  Upload,
  Description,
  MoreVert,
} from '../../icons';
import {
  useTemplate,
  useUpdateTemplate,
  useActivateTemplate,
  useReparseTemplate,
  useDeleteTemplate,
  useReplaceTemplateFile,
} from './hooks/useDocuments';
import TemplateTagsViewer from './TemplateTagsViewer';
import ConfirmationModal from '../../components/ConfirmationModal';
import PageHeader from '../../components/PageHeader';
import { documentsApi } from '../../services/api/documentsApi';

const TemplateDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const templateId = Number(id);

  const { data: template, isLoading, error: fetchError, refetch } = useTemplate(templateId);
  const updateMutation = useUpdateTemplate();
  const activateMutation = useActivateTemplate();
  const reparseMutation = useReparseTemplate();
  const deleteMutation = useDeleteTemplate();
  const replaceFileMutation = useReplaceTemplateFile();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Modal de confirmation pour le remplacement du fichier (remplace window.confirm)
  const [pendingReplaceFile, setPendingReplaceFile] = useState<File | null>(null);
  // Modal de confirmation pour la suppression du template (remplace window.confirm)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Kebab menu (regroupe les actions secondaires du header pour reduire l'encombrement)
  const [menuOpen, setMenuOpen] = useState(false);
  const runFromMenu = (fn: () => void | Promise<void>) => () => {
    setMenuOpen(false);
    void fn();
  };

  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    name: '',
    description: '',
    emailSubject: '',
    emailBody: '',
  });

  // Apercu PDF du template avec donnees factices.
  // L'URL est un blob local cree au load, libere quand le composant unmount
  // ou quand on regenere l'apercu apres un re-scan / une edition.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const currentBlobUrl = useRef<string | null>(null);

  const releaseBlobUrl = () => {
    if (currentBlobUrl.current) {
      window.URL.revokeObjectURL(currentBlobUrl.current);
      currentBlobUrl.current = null;
    }
  };

  const loadPreview = async () => {
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const blobUrl = await documentsApi.fetchTemplatePreviewBlobUrl(templateId);
      releaseBlobUrl();
      currentBlobUrl.current = blobUrl;
      setPreviewUrl(blobUrl);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : 'Erreur lors de la generation de l\'apercu');
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (template) {
      setEditData({
        name: template.name || '',
        description: template.description || '',
        emailSubject: template.emailSubject || '',
        emailBody: template.emailBody || '',
      });
    }
  }, [template]);

  // Charge l'apercu PDF des le premier load du template, et libere
  // l'URL blob lorsque le composant unmount.
  useEffect(() => {
    if (template?.id) {
      loadPreview();
    }
    return () => {
      releaseBlobUrl();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id]);

  const handleSave = async () => {
    setActionError(null);
    try {
      await updateMutation.mutateAsync({ id: templateId, data: editData });
      setEditing(false);
    } catch {
      setActionError('Erreur lors de la sauvegarde');
    }
  };

  const handleActivate = async () => {
    setActionError(null);
    try {
      await activateMutation.mutateAsync(templateId);
    } catch {
      setActionError('Erreur lors de l\'activation');
    }
  };

  const handleReparse = async () => {
    setActionError(null);
    try {
      await reparseMutation.mutateAsync(templateId);
    } catch {
      setActionError('Erreur lors du re-scan');
    }
  };

  const handleDelete = () => {
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(templateId);
      setDeleteConfirmOpen(false);
      navigate('/documents');
    } catch {
      setActionError('Erreur lors de la suppression');
      setDeleteConfirmOpen(false);
    }
  };

  const handleDownloadOriginal = async () => {
    setActionError(null);
    try {
      const filename = template?.originalFilename || 'template.odt';
      await documentsApi.downloadTemplateOriginal(templateId, filename);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur lors du telechargement');
    }
  };

  const handleDownloadPreview = async () => {
    setActionError(null);
    try {
      const baseName = (template?.name || 'template').replace(/[^a-zA-Z0-9_-]+/g, '_');
      await documentsApi.downloadTemplatePreview(templateId, `${baseName}_apercu.pdf`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur lors du telechargement de l\'apercu');
    }
  };

  const handleOpenPreviewInNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Remplacer le fichier .odt source du template tout en gardant le meme id /
  // les memes metadata. Re-parse les tags et regenere l'apercu apres succes.
  // Workflow : clic → input file → selection → ouvre modal de confirmation
  // (ConfirmationModal) → onConfirm → mutation + reload preview.
  const handleReplaceFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleReplaceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset l'input pour permettre de re-selectionner le meme fichier plus tard
    e.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.odt')) {
      setActionError('Seuls les fichiers .odt sont acceptes');
      return;
    }
    setActionError(null);
    setPendingReplaceFile(file);
  };

  const handleConfirmReplace = async () => {
    if (!pendingReplaceFile) return;
    const file = pendingReplaceFile;
    setActionError(null);
    try {
      await replaceFileMutation.mutateAsync({ id: templateId, file });
      setPendingReplaceFile(null);
      // Regenere l'apercu PDF avec le nouveau contenu
      await loadPreview();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erreur lors du remplacement du fichier');
      setPendingReplaceFile(null);
    }
  };

  const handleCancelReplace = () => {
    setPendingReplaceFile(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-6">
        <Spinner className="size-10" />
      </div>
    );
  }

  if (fetchError || !template) {
    return (
      <div>
        <BuiAlert variant="destructive">
          <TriangleAlert />
          <AlertDescription>Template introuvable</AlertDescription>
        </BuiAlert>
        <BuiButton variant="ghost" size="sm" className="mt-3" onClick={() => navigate('/documents')}>
          <ArrowBack />
          Retour
        </BuiButton>
      </div>
    );
  }

  const error = actionError;

  const replacePending = replaceFileMutation.isPending;
  const reparsePending = reparseMutation.isPending;

  return (
    <div>
      <PageHeader
        title={template.name}
        subtitle={`Modèle de document · v${template.version}`}
        iconBadge={<Description />}
        backPath="/documents"
        backLabel="Documents"
        titleAdornment={
          <StatusChip
            tone={template.active ? 'ok' : 'neutral'}
            label={template.active ? 'Actif' : 'Inactif'}
          />
        }
        actions={
          <div className="flex gap-1.5 items-center">
            {/* « Activer » etait un contained success : pas de variante dediee au
                succes dans le kit, on pose la teinte --ok sur un outline. Cela
                laisse aussi l'unique `default` de la zone a « Sauvegarder ». */}
            {!template.active && (
              <BuiButton
                variant="outline"
                size="sm"
                className="text-[var(--ok)] border-[var(--ok)] hover:bg-[var(--ok-soft)]"
                onClick={handleActivate}
              >
                <CheckCircle size={14} strokeWidth={1.75} />
                Activer
              </BuiButton>
            )}
            {editing ? (
              <>
                <BuiButton size="sm" onClick={handleSave}>
                  <Save size={14} strokeWidth={1.75} />
                  Sauvegarder
                </BuiButton>
                <BuiButton variant="outline" size="sm" onClick={() => setEditing(false)}>
                  <Cancel size={14} strokeWidth={1.75} />
                  Annuler
                </BuiButton>
              </>
            ) : (
              <BuiButton variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Edit size={14} strokeWidth={1.75} />
                Modifier
              </BuiButton>
            )}
            {/* Le declencheur est le bouton Radix lui-meme (pas `asChild` sur
                un primitif du kit, qui ne transmet pas de ref) : il conserve
                aria-haspopup / aria-expanded natifs. */}
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger
                    aria-label="Plus d'actions"
                    className={cn(
                      buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
                      'size-[30px] cursor-pointer rounded-[9px] border border-solid border-[var(--line-2)] hover:border-[var(--faint)] hover:bg-[var(--hover)]',
                    )}
                  >
                    <MoreVert size={16} strokeWidth={1.75} />
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Plus d'actions</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-60 text-[0.85rem]">
                <DropdownMenuItem onSelect={runFromMenu(handleDownloadOriginal)}>
                  <span className="inline-flex text-muted-foreground">
                    <Download size={18} strokeWidth={1.75} />
                  </span>
                  Télécharger le fichier source (.odt)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={runFromMenu(handleDownloadPreview)}>
                  <span className="inline-flex text-muted-foreground">
                    <Visibility size={18} strokeWidth={1.75} />
                  </span>
                  Télécharger l'aperçu PDF
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={runFromMenu(handleReplaceFileClick)} disabled={replacePending}>
                  <span className="inline-flex text-muted-foreground">
                    {replacePending ? <Spinner className="size-4" /> : <Upload size={18} strokeWidth={1.75} />}
                  </span>
                  {replacePending ? 'Remplacement…' : 'Remplacer le fichier (.odt)'}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={runFromMenu(handleReparse)} disabled={reparsePending}>
                  <span className="inline-flex text-muted-foreground">
                    {reparsePending ? <Spinner className="size-4" /> : <Refresh size={18} strokeWidth={1.75} />}
                  </span>
                  Re-scanner les tags
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={runFromMenu(handleDelete)}
                  disabled={deleteMutation.isPending}
                >
                  <Delete size={18} strokeWidth={1.75} />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <input
              ref={fileInputRef}
              type="file"
              accept=".odt,application/vnd.oasis.opendocument.text"
              style={{ display: 'none' }}
              onChange={handleReplaceFileChange}
            />
          </div>
        }
      />

      {error && <BuiAlert variant="destructive" className="mt-3 mb-3">
        <TriangleAlert />
        <AlertDescription>{error}</AlertDescription>
        <AlertAction>
          <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setActionError(null)}>
            <X />
          </BuiButton>
        </AlertAction>
      </BuiAlert>}

      <div className="grid grid-cols-12 gap-[18px] items-start">
        {/* Colonne gauche : Informations + Apercu PDF empiles */}
        <div className="col-span-12 min-[900px]:col-span-6">
          <div className="flex flex-col gap-4">
            {/* Informations */}
            <Card className="gap-0 py-0 p-3 border-[var(--line)]">
              <p className="cn-text-body1 mb-3 text-[10.5px] font-bold uppercase tracking-[.06em] text-[var(--faint)]">
                Informations
              </p>

              {editing ? (
                <div className="flex flex-col gap-3">
                  <Field>
                    <FieldLabel htmlFor="template-name">Nom</FieldLabel>
                    <Input id="template-name" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="template-description">Description</FieldLabel>
                    <Textarea id="template-description" rows={2} value={editData.description} onChange={(e) => setEditData({ ...editData, description: e.target.value })} />
                  </Field>
                  <Separator />
                  <Field>
                    <FieldLabel htmlFor="template-email-subject">Objet email</FieldLabel>
                    <Input id="template-email-subject" value={editData.emailSubject} onChange={(e) => setEditData({ ...editData, emailSubject: e.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="template-email-body">Corps email</FieldLabel>
                    <Textarea id="template-email-body" rows={3} value={editData.emailBody} onChange={(e) => setEditData({ ...editData, emailBody: e.target.value })} />
                  </Field>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <InfoRow label="Type de document" value={template.documentType} />
                  <InfoRow label="Fichier original" value={template.originalFilename} />
                  <InfoRow label="Version" value={`v${template.version}`} />
                  <InfoRow label="Créé par" value={template.createdBy || '—'} />
                  <InfoRow label="Créé le" value={template.createdAt ? new Date(template.createdAt).toLocaleDateString('fr-FR') : '—'} />
                  {template.emailSubject && (
                    <>
                      <Separator className="my-1.5" />
                      <InfoRow label="Objet email" value={template.emailSubject} />
                    </>
                  )}
                </div>
              )}
            </Card>

            {/* Apercu PDF — affiche systematiquement sous les Informations */}
            <Card className="gap-0 py-0 p-3 border-[var(--line)]">
              <div className="flex justify-between items-center mb-3 flex-wrap gap-1.5">
                <div>
                  <p className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[.06em] text-[var(--faint)]">
                    Aperçu
                  </p>
                  <span className="cn-text-caption text-muted-foreground">
                    Prévisualisation générée avec des données factices.
                  </span>
                </div>
                <div className="flex gap-0.5">
                  {/* Le span reste indispensable : `TooltipTrigger asChild` pose
                      une ref, et il garde l'infobulle vivante bouton desactive. */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <BuiButton variant="ghost" size="icon-sm" aria-label="Regénérer l'aperçu" onClick={loadPreview} disabled={previewLoading}>
                          <Refresh />
                        </BuiButton>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Regénérer l'aperçu</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <BuiButton variant="ghost" size="icon-sm" aria-label="Ouvrir dans un nouvel onglet" onClick={handleOpenPreviewInNewTab} disabled={!previewUrl || previewLoading}>
                          <Visibility />
                        </BuiButton>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Ouvrir dans un nouvel onglet</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <BuiButton variant="ghost" size="icon-sm" aria-label="Télécharger en PDF" onClick={handleDownloadPreview} disabled={previewLoading}>
                          <Download />
                        </BuiButton>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Télécharger en PDF</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {previewError && (
                <BuiAlert variant="destructive" className="mb-3">
                  <TriangleAlert />
                  <AlertDescription>{previewError}</AlertDescription>
                  <AlertAction>
                    <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setPreviewError(null)}>
                      <X />
                    </BuiButton>
                  </AlertAction>
                </BuiAlert>
              )}

              {/* Hauteur calee sur le ratio A4 portrait : la largeur du panneau
                  est ~50vw sur desktop md+, donc 1.4x cette largeur donne un
                  rendu equilibre. Min/max evitent les extremes. */}
              <div className="relative w-full h-[520px] min-[600px]:h-[640px] min-[900px]:h-[780px] min-[1200px]:h-[880px] bg-[var(--field)] border border-solid border-[var(--line)] rounded-[12px] overflow-hidden">
                {previewLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-[9px] bg-[color-mix(in_srgb,_var(--card)_60%,_transparent)] z-[1]">
                    <Spinner className="size-7" />
                    <span className="cn-text-caption text-muted-foreground">
                      Génération de l'aperçu en cours...
                    </span>
                  </div>
                )}
                {previewUrl ? (
                  <iframe
                    title="Aperçu PDF du template"
                    src={previewUrl}
                    sandbox="allow-same-origin"
                    style={{ width: '100%', height: '100%', border: 0 }}
                  />
                ) : !previewLoading && (
                  <div className="absolute inset-[0px] flex items-center justify-center">
                    <p className="cn-text-body2 text-muted-foreground">
                      Aperçu non disponible.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Colonne droite : Tags detectes (sticky sur grand ecran pour rester
            visible quand on scrolle l'apercu). */}
        <div className="col-span-12 min-[900px]:col-span-6">
          <div className="min-[900px]:sticky min-[900px]:top-[16px]">
            <TemplateTagsViewer tags={template.tags || []} />
          </div>
        </div>
      </div>

      {/* ── Modal de confirmation du remplacement de fichier ─────────── */}
      <ConfirmationModal
        open={Boolean(pendingReplaceFile)}
        onClose={handleCancelReplace}
        onConfirm={handleConfirmReplace}
        title="Remplacer le fichier du template ?"
        message={
          pendingReplaceFile
            ? `Le contenu actuel sera remplacé par « ${pendingReplaceFile.name} » et les tags seront re-scannés. Le nom, le type et le statut actif du template restent inchangés.`
            : ''
        }
        confirmText="Remplacer"
        cancelText="Annuler"
        severity="info"
        loading={replaceFileMutation.isPending}
        icon={<Upload size={22} strokeWidth={1.75} />}
        confirmIcon={<Upload size={18} strokeWidth={1.75} />}
        confirmColor="primary"
      />

      {/* ── Modal de confirmation de suppression du template ─────────── */}
      <ConfirmationModal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Supprimer le template ?"
        message={`Le template « ${template.name} » sera définitivement supprimé. Cette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        severity="error"
        loading={deleteMutation.isPending}
        icon={<Delete size={22} strokeWidth={1.75} />}
        confirmIcon={<Delete size={18} strokeWidth={1.75} />}
      />
    </div>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between">
    <p className="cn-text-body2 text-muted-foreground">{label}</p>
    <p className="cn-text-body2 font-medium">{value}</p>
  </div>
);

export default TemplateDetails;
