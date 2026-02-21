import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { organizationMembersApi, type OrganizationMemberDto } from '../../services/api/organizationMembersApi';
import { ASSIGNABLE_ORG_ROLES, getOrgRoleLabel } from '../../utils/orgRoleLabels';

interface Props {
  open: boolean;
  onClose: () => void;
  member: OrganizationMemberDto | null;
  organizationId: number;
  onRoleChanged: () => void;
}

export default function ChangeRoleDialog({ open, onClose, member, organizationId, onRoleChanged }: Props) {
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialiser le role quand le dialog s'ouvre
  React.useEffect(() => {
    if (member && open) {
      setRole(member.roleInOrg);
      setError(null);
    }
  }, [member, open]);

  const handleSubmit = async () => {
    if (!member || !role) return;

    setLoading(true);
    setError(null);

    try {
      await organizationMembersApi.changeRole(organizationId, member.id, role);
      onRoleChanged();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors du changement de role';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const memberName = member ? `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email : '';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Changer le role</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Modifier le role de <strong>{memberName}</strong> dans l'organisation.
          Role actuel : <strong>{member ? getOrgRoleLabel(member.roleInOrg) : ''}</strong>
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          select
          fullWidth
          label="Nouveau role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          size="small"
        >
          {ASSIGNABLE_ORG_ROLES.map((r) => (
            <MenuItem key={r.value} value={r.value}>
              {r.label}
            </MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Annuler
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !role || role === member?.roleInOrg}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {loading ? 'Modification...' : 'Modifier'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
