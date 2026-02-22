import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Avatar,
} from '@mui/material';
import {
  Edit as EditIcon,
  PersonRemove as PersonRemoveIcon,
} from '@mui/icons-material';
import { organizationMembersApi, type OrganizationMemberDto } from '../../services/api/organizationMembersApi';
import { getOrgRoleLabel, getOrgRoleColor } from '../../utils/orgRoleLabels';
import ChangeRoleDialog from './ChangeRoleDialog';
import RemoveMemberDialog from './RemoveMemberDialog';

interface Props {
  organizationId: number;
  refreshTrigger: number;
  onMemberChanged?: () => void;
}

export default function MembersList({ organizationId, refreshTrigger, onMemberChanged }: Props) {
  const [members, setMembers] = useState<OrganizationMemberDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialogs
  const [changeRoleMember, setChangeRoleMember] = useState<OrganizationMemberDto | null>(null);
  const [removeMember, setRemoveMember] = useState<OrganizationMemberDto | null>(null);

  const loadMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await organizationMembersApi.list(organizationId);
      // Trier : OWNER en premier, puis par nom
      const sorted = [...data].sort((a, b) => {
        if (a.roleInOrg === 'OWNER') return -1;
        if (b.roleInOrg === 'OWNER') return 1;
        const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
        const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });
      setMembers(sorted);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement des membres';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [organizationId, refreshTrigger]);

  const handleRoleChanged = () => {
    loadMembers();
    onMemberChanged?.();
  };

  const handleMemberRemoved = () => {
    loadMembers();
    onMemberChanged?.();
  };

  const getInitials = (member: OrganizationMemberDto): string => {
    const first = member.firstName?.[0] || '';
    const last = member.lastName?.[0] || '';
    return (first + last).toUpperCase() || member.email?.[0]?.toUpperCase() || '?';
  };

  const getMemberName = (member: OrganizationMemberDto): string => {
    return `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (members.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
        Aucun membre dans cette organisation
      </Typography>
    );
  }

  return (
    <>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Membre</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Depuis</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map((member) => {
              const isOwner = member.roleInOrg === 'OWNER';

              return (
                <TableRow key={member.id} hover>
                  {/* Membre (avatar + nom + email) */}
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          fontSize: '0.8rem',
                          bgcolor: 'primary.main',
                        }}
                      >
                        {getInitials(member)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {getMemberName(member)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {member.email}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>

                  {/* Role */}
                  <TableCell>
                    <Chip
                      label={getOrgRoleLabel(member.roleInOrg)}
                      size="small"
                      color={getOrgRoleColor(member.roleInOrg)}
                      variant={isOwner ? 'filled' : 'outlined'}
                    />
                  </TableCell>

                  {/* Depuis */}
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {member.joinedAt
                        ? new Date(member.joinedAt).toLocaleDateString('fr-FR')
                        : '—'}
                    </Typography>
                  </TableCell>

                  {/* Actions */}
                  <TableCell align="right">
                    {!isOwner && (
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        <Tooltip title="Changer le role">
                          <IconButton
                            size="small"
                            onClick={() => setChangeRoleMember(member)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Retirer de l'organisation">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setRemoveMember(member)}
                          >
                            <PersonRemoveIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialogs */}
      <ChangeRoleDialog
        open={!!changeRoleMember}
        onClose={() => setChangeRoleMember(null)}
        member={changeRoleMember}
        organizationId={organizationId}
        onRoleChanged={handleRoleChanged}
      />

      <RemoveMemberDialog
        open={!!removeMember}
        onClose={() => setRemoveMember(null)}
        member={removeMember}
        organizationId={organizationId}
        onMemberRemoved={handleMemberRemoved}
      />
    </>
  );
}
