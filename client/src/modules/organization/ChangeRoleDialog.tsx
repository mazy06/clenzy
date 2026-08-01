import React, { useState } from 'react';
import { Alert, AlertDescription, Button } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Field, FieldLabel, NativeSelect, NativeSelectOption, Spinner } from '../../components/ui';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
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
        <p className="cn-text-body2 text-muted-foreground mb-3">
          Modifier le role de <strong>{memberName}</strong> dans l'organisation.
          Role actuel : <strong>{member ? getOrgRoleLabel(member.roleInOrg) : ''}</strong>
        </p>

        {error && (
          <Alert variant="destructive" className="mb-3">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Field>
          <FieldLabel htmlFor="change-role-new-role">Nouveau role</FieldLabel>
          <NativeSelect
            id="change-role-new-role"
            className="w-full"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {/* Option vide : le role actuel peut ne pas etre assignable (OWNER),
                le select natif afficherait alors le 1er role de la liste sans
                que l'etat ait change. */}
            <NativeSelectOption value="">—</NativeSelectOption>
            {ASSIGNABLE_ORG_ROLES.map((r) => (
              <NativeSelectOption key={r.value} value={r.value}>
                {r.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="ghost" disabled={loading}>
          Annuler
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading || !role || role === member?.roleInOrg}
        >
          {loading && <Spinner className="size-4" />}
          {loading ? 'Modification...' : 'Modifier'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
