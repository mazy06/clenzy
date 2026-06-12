import React, { useState, forwardRef, useImperativeHandle } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
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
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const displayError = actionError || (error ? 'Erreur lors du chargement des templates' : null);

  return (
    <Box>
      {displayError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>{displayError}</Alert>}

      {templates.length === 0 ? (
        <EmptyState
          icon={<Description />}
          title="Aucun template"
          description='Cliquez sur "Nouveau template" pour en ajouter un.'
        />
      ) : (
        /* ── Cartes hairline r14 avec overline (type) ── */
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
            gap: 1.5,
          }}
        >
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
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--faint)' }}>
                  {t.documentType}
                </Typography>
                <Chip
                  label={t.active ? 'Actif' : 'Inactif'}
                  size="small"
                  sx={t.active
                    ? { color: 'var(--ok)', bgcolor: 'var(--ok-soft)' }
                    : { color: 'var(--muted)', bgcolor: 'var(--hover)' }}
                />
              </Box>

              {/* Nom + description */}
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)' }}>
                  {t.name}
                </Typography>
                {t.description && (
                  <Typography noWrap sx={{ fontSize: '11.5px', color: 'var(--muted)', mt: '1px' }}>
                    {t.description}
                  </Typography>
                )}
              </Box>

              {/* Méta muted */}
              <Typography noWrap sx={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                {[t.originalFilename, `v${t.version}`, `${t.tags?.length || 0} tags`, t.createdBy]
                  .filter(Boolean).join(' · ')}
              </Typography>

              {/* Pied : action accent + actions secondaires */}
              <Box
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}
                onClick={(e) => e.stopPropagation()}
              >
                <Box
                  component="span"
                  onClick={() => navigate(`/documents/templates/${t.id}`)}
                  sx={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    fontSize: '12.5px', fontWeight: 600, color: 'var(--accent)',
                    whiteSpace: 'nowrap', cursor: 'pointer',
                    '&:hover': { color: 'var(--accent-deep)' },
                  }}
                >
                  Aperçu
                  <ArrowRightIcon size={14} strokeWidth={1.75} />
                </Box>
                <Box sx={{ display: 'flex', gap: 0.25 }}>
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
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
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
    </Box>
  );
});

TemplatesList.displayName = 'TemplatesList';

export default TemplatesList;
