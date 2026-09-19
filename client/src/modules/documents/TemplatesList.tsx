import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { cn } from '../../utils/cn';
import { Alert, AlertDescription, AlertAction, Button } from '../../components/ui';
import { TriangleAlert, X } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import StatusChip from '../../components/StatusChip';
import {
  Delete,
  CheckCircle,
  Description,
  ArrowForward as ArrowRightIcon,
} from '../../icons';
import { useNavigate } from 'react-router-dom';
import { useTemplates, useActivateTemplate, useDeleteTemplate } from './hooks/useDocuments';
import TemplateUpload from './TemplateUpload';
import { Upload as UploadIcon } from '../../icons';
import ConfirmationModal from '../../components/ConfirmationModal';
import EmptyState from '../../components/EmptyState';
import { useTranslation } from '../../hooks/useTranslation';

export interface TemplatesListRef {
  fetchTemplates: () => void;
  openUpload: () => void;
}

const TemplatesList = forwardRef<TemplatesListRef>((_, ref) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Modal de confirmation pour la suppression (remplace window.confirm)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const { data: templates = [], isLoading, error, refetch } = useTemplates();
  const activateMutation = useActivateTemplate();
  const deleteMutation = useDeleteTemplate();

  const handleActivate = async (id: number) => {
    setActionError(null);
    try {
      await activateMutation.mutateAsync(id);
    } catch {
      setActionError(t('documents.activationError'));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      setActionError('Erreur lors de la suppression');
      setDeleteTarget(null);
    }
  };

  useImperativeHandle(ref, () => ({
    fetchTemplates: () => refetch(),
    openUpload: () => setUploadOpen(true),
  }));

  const handleUploadSuccess = () => {
    setUploadOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-6">
        <Spinner className="size-10" />
      </div>
    );
  }

  const displayError = actionError || (error ? 'Erreur lors du chargement des templates' : null);

  return (
    <div>
      {displayError && <Alert variant="destructive" className="mb-3">
        <TriangleAlert />
        <AlertDescription>{displayError}</AlertDescription>
        <AlertAction>
          <Button variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setActionError(null)}>
            <X />
          </Button>
        </AlertAction>
      </Alert>}

      {/* ─── Zone d'import de la projection : l'entree principale de l'onglet,
          plus seulement un bouton d'en-tete. ── */}
      <button
        type="button"
        onClick={() => setUploadOpen(true)}
        className="mb-3 flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border p-4 text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <UploadIcon size={20} strokeWidth={1.75} />
        <span className="text-sm font-medium">{t('documents.list.import')}</span>
        <span className="text-2xs">{t('documents.list.importHint')}</span>
      </button>

      {templates.length === 0 ? (
        <EmptyState
          icon={<Description />}
          title={t('documents.list.empty')}
          description={t('documents.list.emptyHint')}
        />
      ) : (
        /* ── Cartes hairline r14 avec overline (type) ── */
        <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[repeat(2,_1fr)] min-[1200px]:grid-cols-[repeat(3,_1fr)] gap-[9px]">
          {templates.map((template) => (
            <div
              key={template.id}
              onClick={() => navigate(`/documents/templates/${template.id}`)}
              className="flex flex-col gap-[4.5px] py-[14px] px-4 border border-solid border-border rounded-lg bg-card cursor-pointer transition-[border-color,box-shadow] duration-[140ms] hover:border-primary hover:shadow-[0_8px_22px_-16px_var(--bui-primary)] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 motion-reduce:transition-none"
              role="link"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/documents/templates/${template.id}`); }}
            >
              {/* Overline type + statut -soft */}
              <div className="flex items-center justify-between gap-1.5">
                <p className="text-2xs font-bold uppercase tracking-[.06em] text-faint">
                  {template.documentType}
                </p>
                <StatusChip
                  tone={template.active ? 'ok' : 'neutral'}
                  label={template.active ? 'Actif' : 'Inactif'}
                />
              </div>

              {/* Nom + description */}
              <div className="min-w-0">
                <p dir="auto" className="truncate text-[13.5px] font-semibold text-foreground">
                  {template.name}
                </p>
                {template.description && (
                  <p className="truncate text-[11.5px] text-muted-foreground mt-px">
                    {template.description}
                  </p>
                )}
              </div>

              {/* Méta muted */}
              <p className="truncate text-[11.5px] text-muted-foreground">
                {[template.originalFilename, `v${template.version}`, `${template.tags?.length || 0} tags`, template.createdBy]
                  .filter(Boolean).join(' · ')}
              </p>

              {/* Pied : action de marque + actions secondaires */}
              <div className="flex items-center justify-between mt-0.5" onClick={(e) => e.stopPropagation()}>
                <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary whitespace-nowrap cursor-pointer hover:text-primary-deep" onClick={() => navigate(`/documents/templates/${template.id}`)}>
                  {t('documents.list.preview')}
                  <ArrowRightIcon size={14} strokeWidth={1.75} />
                </span>
                <div className="flex gap-0.5">
                  {!template.active && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleActivate(template.id)}
                            aria-label="Activer"
                            className="cursor-pointer text-muted-foreground hover:text-success-ink hover:bg-success-soft"
                          >
                            <CheckCircle size={16} strokeWidth={1.75} />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Activer</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleteTarget({ id: template.id, name: template.name })}
                          aria-label="Supprimer"
                          className="cursor-pointer text-muted-foreground hover:text-destructive-ink hover:bg-destructive-soft"
                        >
                          <Delete size={16} strokeWidth={1.75} />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Supprimer</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <TemplateUpload open={uploadOpen} onClose={() => setUploadOpen(false)} onSuccess={handleUploadSuccess} />

      <ConfirmationModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={t('documents.details.deleteTitle')}
        message={deleteTarget ? t('documents.details.deleteMessage', { name: deleteTarget.name }) : ''}
        confirmText="Supprimer"
        cancelText="Annuler"
        severity="error"
        loading={deleteMutation.isPending}
        icon={<Delete size={22} strokeWidth={1.75} />}
        confirmIcon={<Delete size={18} strokeWidth={1.75} />}
      />
    </div>
  );
});

TemplatesList.displayName = 'TemplatesList';

export default TemplatesList;
