import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { organizationMembersApi, type OrganizationMemberDto } from '../../services/api/organizationMembersApi';

interface Props {
  open: boolean;
  onClose: () => void;
  member: OrganizationMemberDto | null;
  organizationId: number;
  onMemberRemoved: () => void;
}

export default function RemoveMemberDialog({ open, onClose, member, organizationId, onMemberRemoved }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const handleRemove = async () => {
    if (!member) return;

    setLoading(true);
    setError(null);

    try {
      await organizationMembersApi.remove(organizationId, member.id);
      onMemberRemoved();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors du retrait du membre';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const memberName = member ? `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email : '';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Retirer un membre</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Etes-vous sur de vouloir retirer <strong>{memberName}</strong> de l'organisation ?
        </Typography>
        <Typography variant="body2" color="error.main">
          Cette action retirera son acces a toutes les ressources de l'organisation.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Annuler
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleRemove}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {loading ? 'Retrait...' : 'Retirer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
