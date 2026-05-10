import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Switch,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Chip,
  CircularProgress,
} from '@mui/material';
import { DeleteForever, ToggleOn, Warning } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { propertiesApi } from '../../services/api/propertiesApi';
import { propertyDetailsKeys } from '../../hooks/usePropertyDetails';
import { useNotification } from '../../hooks/useNotification';

interface PropertySettingsTabProps {
  propertyId: number;
  propertyName: string;
  status: string;
  canEdit: boolean;
}

const SECTION_TITLE_SX = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  color: 'text.secondary',
  mb: 1,
};

const CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  borderRadius: 1.5,
  p: 2,
};

const PropertySettingsTab: React.FC<PropertySettingsTabProps> = ({
  propertyId,
  propertyName,
  status,
  canEdit,
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useNotification();

  const [statusUpdating, setStatusUpdating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // status from PropertyDetailsData is lowercased ('active'/'inactive') while
  // backend persists uppercase. We normalise here.
  const isActive = status.toUpperCase() === 'ACTIVE';

  const handleToggleStatus = async () => {
    if (!canEdit || statusUpdating) return;
    const next = isActive ? 'INACTIVE' : 'ACTIVE';
    setStatusUpdating(true);
    try {
      await propertiesApi.updateStatus(propertyId, next);
      queryClient.invalidateQueries({ queryKey: propertyDetailsKeys.detail(String(propertyId)) });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      notify.success(
        next === 'INACTIVE' ? 'Propriete desactivee' : 'Propriete reactivee',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      notify.error(`Echec changement de statut : ${message}`);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!canEdit || deleting) return;
    setDeleting(true);
    try {
      await propertiesApi.delete(propertyId);
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: propertyDetailsKeys.detail(String(propertyId)) });
      notify.success(`"${propertyName}" supprimee`);
      navigate('/properties');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      notify.error(`Echec suppression : ${message}`);
      setDeleting(false);
    }
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeleteOpen(false);
    setConfirmText('');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 720 }}>
      {/* ── Activation ─────────────────────────────────────────────────── */}
      <Paper sx={CARD_SX}>
        <Typography sx={SECTION_TITLE_SX}>
          <ToggleOn sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
          Statut de la propriete
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                {isActive ? 'Active' : 'Inactive'}
              </Typography>
              <Chip
                label={isActive ? 'Visible' : 'Masquee'}
                size="small"
                color={isActive ? 'success' : 'default'}
                variant="outlined"
                sx={{ height: 20, fontSize: '0.6875rem' }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {isActive
                ? "Une propriete active apparait dans le planning, les recherches et le booking engine."
                : "Une propriete inactive est masquee partout dans l'application mais ses donnees sont conservees."}
            </Typography>
          </Box>
          {statusUpdating ? (
            <CircularProgress size={24} />
          ) : (
            <Switch
              checked={isActive}
              disabled={!canEdit}
              onChange={handleToggleStatus}
              color="success"
            />
          )}
        </Box>
      </Paper>

      {/* ── Suppression definitive ─────────────────────────────────────── */}
      <Paper
        sx={{
          ...CARD_SX,
          borderColor: 'error.light',
          bgcolor: (t) => (t.palette.mode === 'dark' ? 'error.dark' : 'error.50'),
        }}
      >
        <Typography sx={{ ...SECTION_TITLE_SX, color: 'error.main' }}>
          <Warning sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
          Zone dangereuse
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 0.5 }}>
              Supprimer cette propriete
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Action irreversible. Reservations, photos, interventions associees seront egalement supprimees.
              Si tu veux juste la masquer temporairement, desactive-la plutot via le toggle ci-dessus.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteForever />}
            disabled={!canEdit || deleting}
            onClick={() => setDeleteOpen(true)}
            sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
          >
            Supprimer
          </Button>
        </Box>
      </Paper>

      {/* ── Confirmation suppression ───────────────────────────────────── */}
      <Dialog open={deleteOpen} onClose={closeDelete} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600 }}>
          Supprimer "{propertyName}" ?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.875rem', mb: 2 }}>
            Cette action est <strong>irreversible</strong>. Toutes les donnees liees a cette propriete (reservations, photos, interventions) seront definitivement perdues.
          </DialogContentText>
          <DialogContentText sx={{ fontSize: '0.8125rem', mb: 1 }}>
            Pour confirmer, tape <strong>{propertyName}</strong> ci-dessous :
          </DialogContentText>
          <Box
            component="input"
            type="text"
            value={confirmText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmText(e.target.value)}
            disabled={deleting}
            sx={{
              width: '100%',
              p: 1,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              fontSize: '0.875rem',
              fontFamily: 'inherit',
              outline: 'none',
              '&:focus': { borderColor: 'error.main' },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDelete} disabled={deleting} sx={{ textTransform: 'none' }}>
            Annuler
          </Button>
          <Button
            onClick={handleDelete}
            disabled={deleting || confirmText !== propertyName}
            color="error"
            variant="contained"
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteForever />}
            sx={{ textTransform: 'none' }}
          >
            Supprimer definitivement
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PropertySettingsTab;
