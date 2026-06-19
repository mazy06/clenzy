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
  TablePagination,
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
} from '../../icons';
import { organizationMembersApi, type OrganizationMemberDto } from '../../services/api/organizationMembersApi';
import { usersApi } from '../../services/api/usersApi';
import {
  getOrgRoleLabel, getOrgRoleHex, getOrgRoleIcon,
  getPlatformRoleLabel, getPlatformRoleHex, getPlatformRoleIcon,
} from '../../utils/orgRoleLabels';
import { useAuth } from '../../hooks/useAuth';
import ChangeRoleDialog from './ChangeRoleDialog';
import RemoveMemberDialog from './RemoveMemberDialog';

interface Props {
  organizationId: number;
  refreshTrigger: number;
  onMemberChanged?: () => void;
}

const ROWS_PER_PAGE = 5;

export default function MembersList({ organizationId, refreshTrigger, onMemberChanged }: Props) {
  const { hasAnyRole, user } = useAuth();
  const [members, setMembers] = useState<OrganizationMemberDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // L'utilisateur peut gerer les membres s'il est staff plateforme ou ADMIN/OWNER de l'org
  const isPlatformStaff = hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']);

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
    setPage(0);
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

  // Verifier si l'utilisateur connecte est ADMIN ou OWNER de cette org
  const currentUserMember = members.find((m) => m.userId === user?.databaseId);
  const isOrgAdmin = currentUserMember?.roleInOrg === 'ADMIN' || currentUserMember?.roleInOrg === 'OWNER';
  const canManage = isPlatformStaff || isOrgAdmin;

  const paginatedMembers = members.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);

  const CELL_NOWRAP_SX = { whiteSpace: 'nowrap' as const, py: 0.75, px: 1 };
  // Membre cell : shrinkable + ellipsis. `maxWidth: 0` + `width: '100%'` est le trick CSS pour
  // qu'une cellule <td> accepte text-overflow:ellipsis sur ses enfants tout en remplissant
  // l'espace disponible. Sans ça, l'email long pousse la table et la colonne Actions se fait
  // clipper par le `overflow: hidden` du SettingsSection.
  const CELL_MEMBER_SX = { py: 0.75, px: 1, maxWidth: 0, width: '100%' };

  return (
    <>
      <TableContainer sx={{ overflowX: 'hidden' }}>
        <Table size="small" sx={{ tableLayout: 'auto', width: '100%' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={CELL_NOWRAP_SX}>Membre</TableCell>
              <TableCell sx={CELL_NOWRAP_SX}>Role</TableCell>
              <TableCell sx={CELL_NOWRAP_SX}>Depuis</TableCell>
              {canManage && <TableCell align="right" sx={{ ...CELL_NOWRAP_SX, pr: 1.25 }}>Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedMembers.map((member) => {
              const isOwner = member.roleInOrg === 'OWNER';
              const roleColor = getOrgRoleHex(member.roleInOrg);
              const RoleIcon = getOrgRoleIcon(member.roleInOrg);

              return (
                <TableRow key={member.id} hover>
                  {/* Membre (avatar + nom + email) */}
                  <TableCell sx={CELL_MEMBER_SX}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                      <Avatar
                        src={usersApi.profilePictureUrl(member.userId)}
                        alt={`${member.firstName} ${member.lastName}`.trim() || member.email}
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '10px',
                          fontSize: '0.78rem',
                          fontFamily: 'var(--font-display)',
                          fontWeight: 600,
                          letterSpacing: '0.02em',
                          bgcolor: `${roleColor}1F`,
                          color: roleColor,
                          flexShrink: 0,
                        }}
                      >
                        {getInitials(member)}
                      </Avatar>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                          sx={{
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            color: 'text.primary',
                            lineHeight: 1.25,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={getMemberName(member)}
                        >
                          {getMemberName(member)}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: '0.7rem',
                            color: 'text.secondary',
                            lineHeight: 1.3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={member.email}
                        >
                          {member.email}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>

                  {/* Role : org + plateforme (les deux, parite avec l'Annuaire) */}
                  <TableCell sx={CELL_NOWRAP_SX}>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      <Tooltip title="Rôle dans l'organisation">
                        <Chip
                          icon={<RoleIcon size={11} strokeWidth={2} />}
                          label={getOrgRoleLabel(member.roleInOrg)}
                          size="small"
                          sx={{
                            backgroundColor: `${roleColor}18`,
                            color: roleColor,
                            '& .MuiChip-icon': { color: roleColor, ml: '6px', mr: '-2px' },
                          }}
                        />
                      </Tooltip>
                      {member.userRole && member.userRole !== member.roleInOrg && (() => {
                        const pHex = getPlatformRoleHex(member.userRole);
                        const PlatformIcon = getPlatformRoleIcon(member.userRole);
                        return (
                          <Tooltip title="Rôle sur la plateforme">
                            <Chip
                              icon={<PlatformIcon size={11} strokeWidth={2} />}
                              label={getPlatformRoleLabel(member.userRole)}
                              size="small"
                              variant="outlined"
                              sx={{
                                backgroundColor: 'transparent',
                                color: pHex,
                                borderColor: `${pHex}55`,
                                '& .MuiChip-icon': { color: pHex, ml: '6px', mr: '-2px' },
                              }}
                            />
                          </Tooltip>
                        );
                      })()}
                    </Box>
                  </TableCell>

                  {/* Depuis */}
                  <TableCell sx={CELL_NOWRAP_SX}>
                    <Typography
                      sx={{
                        fontSize: '0.72rem',
                        color: 'text.secondary',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {member.joinedAt
                        ? new Date(member.joinedAt).toLocaleDateString('fr-FR')
                        : '—'}
                    </Typography>
                  </TableCell>

                  {/* Actions — visible uniquement pour staff plateforme ou admin org */}
                  {canManage && (
                    <TableCell align="right" sx={{ ...CELL_NOWRAP_SX, pr: 1.25 }}>
                      {!isOwner && (
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                          <Tooltip title="Changer le rôle">
                            <IconButton
                              size="small"
                              onClick={() => setChangeRoleMember(member)}
                              aria-label="Changer le rôle"
                              sx={{
                                width: 28,
                                height: 28,
                                borderRadius: '7px',
                                color: 'var(--muted)',
                                border: '1px solid var(--line-2)',
                                backgroundColor: 'var(--card)',
                                transition:
                                  'border-color 150ms cubic-bezier(0.22, 1, 0.36, 1), background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), color 150ms cubic-bezier(0.22, 1, 0.36, 1)',
                                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                                '&:hover': {
                                  color: 'var(--accent)',
                                  borderColor: 'color-mix(in srgb, var(--accent) 40%, transparent)',
                                  backgroundColor: 'var(--accent-soft)',
                                },
                                '&:focus-visible': {
                                  outline: '2px solid var(--accent)',
                                  outlineOffset: 2,
                                },
                              }}
                            >
                              <EditIcon size={13} strokeWidth={1.75} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Retirer de l'organisation">
                            <IconButton
                              size="small"
                              onClick={() => setRemoveMember(member)}
                              aria-label="Retirer de l'organisation"
                              sx={{
                                width: 28,
                                height: 28,
                                borderRadius: '7px',
                                color: 'var(--muted)',
                                border: '1px solid var(--line-2)',
                                backgroundColor: 'var(--card)',
                                transition:
                                  'border-color 150ms cubic-bezier(0.22, 1, 0.36, 1), background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), color 150ms cubic-bezier(0.22, 1, 0.36, 1)',
                                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                                '&:hover': {
                                  color: 'var(--err)',
                                  borderColor: 'color-mix(in srgb, var(--err) 40%, transparent)',
                                  backgroundColor: 'var(--err-soft)',
                                },
                                '&:focus-visible': {
                                  outline: '2px solid var(--err)',
                                  outlineOffset: 2,
                                },
                              }}
                            >
                              <PersonRemoveIcon size={13} strokeWidth={1.75} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {members.length > ROWS_PER_PAGE && (
        <TablePagination
          component="div"
          count={members.length}
          page={page}
          onPageChange={(_e, newPage) => setPage(newPage)}
          rowsPerPage={ROWS_PER_PAGE}
          rowsPerPageOptions={[]}
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
        />
      )}

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
