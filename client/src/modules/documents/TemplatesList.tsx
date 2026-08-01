import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { Alert, AlertDescription, AlertAction, Button } from '../../components/ui';
import { TriangleAlert, X } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
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
import ConfirmationModal from '../../components/ConfirmationModal';
import EmptyState from '../../components/EmptyState';

export interface TemplatesListRef {
  fetchTemplates: () => void;
  openUpload: () => void;
}

const TemplatesList = forwardRef<TemplatesListRef>((_, ref) => {
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
      setActionError('Erreur lors de l\'activation du template');
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

      {templates.length === 0 ? (
        <EmptyState
          icon={<Description />}
          title="Aucun template"
          description='Cliquez sur "Nouveau template" pour en ajouter un.'
        />
      ) : (
        /* ── Cartes hairline r14 avec overline (type) ── */
        <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[repeat(2,_1fr)] min-[1200px]:grid-cols-[repeat(3,_1fr)] gap-[9px]">
          {templates.map((t) => (
            <Box
              key={t.id}
              onClick={() => navigate(`/documents/templates/${t.id}`)}
              sx={{
                display: 'flex', flexDirection: 'column', gap: 0.75,
                p: '14px 16px',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-lg)',
                bgcolor: 'var(--card)',
                cursor: 'pointer',
                transition: 'border-color .14s, box-shadow .14s',
                '&:hover': { borderColor: 'var(--accent)', boxShadow: '0 8px 22px -16px var(--accent)' },
                '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              }}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/documents/templates/${t.id}`); }}
            >
              {/* Overline type + statut -soft */}
              <div className="flex items-center justify-between gap-1.5">
                <p className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[.06em] text-[var(--faint)]">
                  {t.documentType}
                </p>
                <StatusChip
                  tone={t.active ? 'ok' : 'neutral'}
                  label={t.active ? 'Actif' : 'Inactif'}
                />
              </div>

              {/* Nom + description */}
              <div className="min-w-0">
                <p className="cn-text-body1 truncate text-[13.5px] font-semibold text-[var(--ink)]">
                  {t.name}
                </p>
                {t.description && (
                  <Typography noWrap sx={{ fontSize: '11.5px', color: 'var(--muted)', mt: '1px' }}>
                    {t.description}
                  </Typography>
                )}
              </div>

              {/* Méta muted */}
              <p className="cn-text-body1 truncate text-[11.5px] text-[var(--muted)]">
                {[t.originalFilename, `v${t.version}`, `${t.tags?.length || 0} tags`, t.createdBy]
                  .filter(Boolean).join(' · ')}
              </p>

              {/* Pied : action accent + actions secondaires */}
              <div className="flex items-center justify-between mt-0.5" onClick={(e) => e.stopPropagation()}>
                <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--accent)] whitespace-nowrap cursor-pointer hover:text-[var(--accent-deep)]" onClick={() => navigate(`/documents/templates/${t.id}`)}>
                  Aperçu
                  <ArrowRightIcon size={14} strokeWidth={1.75} />
                </span>
                <div className="flex gap-0.5">
                  {!t.active && (
                    <Tooltip title="Activer" arrow>
                      <IconButton
                        size="small"
                        onClick={() => handleActivate(t.id)}
                        aria-label="Activer"
                        sx={{
                          cursor: 'pointer',
                          color: 'var(--muted)',
                          '&:hover': { color: 'var(--ok)', backgroundColor: 'var(--ok-soft)' },
                        }}
                      >
                        <CheckCircle size={16} strokeWidth={1.75} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Supprimer" arrow>
                    <IconButton
                      size="small"
                      onClick={() => setDeleteTarget({ id: t.id, name: t.name })}
                      aria-label="Supprimer"
                      sx={{
                        cursor: 'pointer',
                        color: 'var(--muted)',
                        '&:hover': { color: 'var(--err)', backgroundColor: 'var(--err-soft)' },
                      }}
                    >
                      <Delete size={16} strokeWidth={1.75} />
                    </IconButton>
                  </Tooltip>
                </div>
              </div>
            </Box>
          ))}
        </div>
      )}

      <TemplateUpload open={uploadOpen} onClose={() => setUploadOpen(false)} onSuccess={handleUploadSuccess} />

      <ConfirmationModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Supprimer le template ?"
        message={deleteTarget ? `Le template « ${deleteTarget.name} » sera définitivement supprimé. Cette action est irréversible.` : ''}
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
