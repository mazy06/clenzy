import React, { useCallback, useEffect, useState } from 'react';
import StatusChip from '../../components/StatusChip';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
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
import PagePagination from '../../components/PagePagination';

interface Props {
  organizationId: number;
  refreshTrigger: number;
  onMemberChanged?: () => void;
}

const ROWS_PER_PAGE = 5;

const getInitials = (member: OrganizationMemberDto): string => {
  const first = member.firstName?.[0] || '';
  const last = member.lastName?.[0] || '';
  return (first + last).toUpperCase() || member.email?.[0]?.toUpperCase() || '?';
};

const getMemberName = (member: OrganizationMemberDto): string => {
  return `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email;
};

const CELL_NOWRAP_CLASS = 'whitespace-nowrap py-[4.5px] px-1.5';
// Cellule Actions : `pe` (padding-inline-end) et non `pr`, pour suivre les proprietes
// logiques du kit et rester correct en RTL. `ps`/`pe` explicites plutot que `px` + `pe` :
// deux utilitaires du meme groupe se departageraient sur l'ordre de la feuille generee.
const CELL_ACTIONS_CLASS = 'whitespace-nowrap py-[4.5px] ps-1.5 pe-[7.5px] text-end';
// Membre cell : shrinkable + ellipsis. `maxWidth: 0` + `width: '100%'` est le trick CSS pour
// qu'une cellule <td> accepte text-overflow:ellipsis sur ses enfants tout en remplissant
// l'espace disponible. Sans ça, l'email long pousse la table et la colonne Actions se fait
// clipper par le `overflow: hidden` du SettingsSection.
const CELL_MEMBER_CLASS = 'py-[4.5px] px-1.5 max-w-0 w-full';

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

  const loadMembers = useCallback(async () => {
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
  }, [organizationId]);

  useEffect(() => {
    setPage(0);
    loadMembers();
  }, [organizationId, refreshTrigger, loadMembers]);

  const handleRoleChanged = () => {
    loadMembers();
    onMemberChanged?.();
  };

  const handleMemberRemoved = () => {
    loadMembers();
    onMemberChanged?.();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-3">
        <TriangleAlert />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (members.length === 0) {
    return (
      <p className="cn-text-body2 text-muted-foreground py-3 text-center">
        Aucun membre dans cette organisation
      </p>
    );
  }

  // Verifier si l'utilisateur connecte est ADMIN ou OWNER de cette org
  const currentUserMember = members.find((m) => m.userId === user?.databaseId);
  const isOrgAdmin = currentUserMember?.roleInOrg === 'ADMIN' || currentUserMember?.roleInOrg === 'OWNER';
  const canManage = isPlatformStaff || isOrgAdmin;

  const paginatedMembers = members.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);

  return (
    <>
      <div className="overflow-x-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={CELL_NOWRAP_CLASS}>Membre</TableHead>
              <TableHead className={CELL_NOWRAP_CLASS}>Role</TableHead>
              <TableHead className={CELL_NOWRAP_CLASS}>Depuis</TableHead>
              {canManage && <TableHead className={CELL_ACTIONS_CLASS}>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedMembers.map((member) => {
              const isOwner = member.roleInOrg === 'OWNER';
              const roleColor = getOrgRoleHex(member.roleInOrg);
              const RoleIcon = getOrgRoleIcon(member.roleInOrg);

              return (
                <TableRow key={member.id}>
                  {/* Membre (avatar + nom + email) */}
                  <TableCell className={CELL_MEMBER_CLASS}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="size-8 shrink-0 rounded-[10px]">
                        <AvatarImage
                          src={usersApi.profilePictureUrl(member.userId)}
                          alt={`${member.firstName} ${member.lastName}`.trim() || member.email}
                          className="rounded-[10px]"
                        />
                        {/* La teinte derive du role (valeur runtime) : elle ne peut
                            pas naitre d'une classe, d'ou le style inline. */}
                        <AvatarFallback
                          className="rounded-[10px] text-[0.78rem] font-[family-name:var(--font-display)] font-semibold tracking-[0.02em]"
                          style={{ backgroundColor: `${roleColor}1F`, color: roleColor }}
                        >
                          {getInitials(member)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="cn-text-body1 text-[0.82rem] font-semibold text-foreground leading-[1.25] overflow-hidden text-ellipsis whitespace-nowrap" title={getMemberName(member)}>
                          {getMemberName(member)}
                        </p>
                        <p className="cn-text-body1 text-[0.7rem] text-muted-foreground leading-[1.3] overflow-hidden text-ellipsis whitespace-nowrap" title={member.email}>
                          {member.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  {/* Role : org + plateforme (les deux, parite avec l'Annuaire) */}
                  <TableCell className={CELL_NOWRAP_CLASS}>
                    <div className="flex gap-0.5 flex-wrap">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {/* Le `span` porte la ref que Tooltip pose sur son enfant :
                              StatusChip est une fonction et n'en transmet pas. */}
                          <span className="inline-flex">
                            <StatusChip tokens={{ color: roleColor, bg: `${roleColor}18` }} label={getOrgRoleLabel(member.roleInOrg)} icon={<RoleIcon size={11} strokeWidth={2} />} />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Rôle dans l'organisation</TooltipContent>
                      </Tooltip>
                      {member.userRole && member.userRole !== member.roleInOrg && (() => {
                        const pHex = getPlatformRoleHex(member.userRole);
                        const PlatformIcon = getPlatformRoleIcon(member.userRole);
                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <StatusChip
                                  color={pHex}
                                  icon={<PlatformIcon size={11} strokeWidth={2} />}
                                  label={getPlatformRoleLabel(member.userRole)}
                                />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Rôle sur la plateforme</TooltipContent>
                          </Tooltip>
                        );
                      })()}
                    </div>
                  </TableCell>

                  {/* Depuis */}
                  <TableCell className={CELL_NOWRAP_CLASS}>
                    <p className="cn-text-body1 text-[0.72rem] text-muted-foreground tabular-nums">
                      {member.joinedAt
                        ? new Date(member.joinedAt).toLocaleDateString('fr-FR')
                        : '—'}
                    </p>
                  </TableCell>

                  {/* Actions — visible uniquement pour staff plateforme ou admin org */}
                  {canManage && (
                    <TableCell className={CELL_ACTIONS_CLASS}>
                      {!isOwner && (
                        <div className="inline-flex items-center gap-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon-sm"
                                  onClick={() => setChangeRoleMember(member)}
                                  aria-label="Changer le rôle"
                                  className="rounded-[7px] border-solid border-[var(--line-2)] bg-[var(--card)] text-[var(--muted)] transition-[border-color,background-color,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none hover:text-[var(--accent)] hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)] hover:bg-[var(--accent-soft)]"
                                >
                                  <EditIcon size={13} strokeWidth={1.75} />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Changer le rôle</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon-sm"
                                  onClick={() => setRemoveMember(member)}
                                  aria-label="Retirer de l'organisation"
                                  className="rounded-[7px] border-solid border-[var(--line-2)] bg-[var(--card)] text-[var(--muted)] transition-[border-color,background-color,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none hover:text-[var(--err)] hover:border-[color-mix(in_srgb,var(--err)_40%,transparent)] hover:bg-[var(--err-soft)]"
                                >
                                  <PersonRemoveIcon size={13} strokeWidth={1.75} />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Retirer de l'organisation</TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {members.length > ROWS_PER_PAGE && (
        <PagePagination
          count={members.length}
          page={page}
          onPageChange={(newPage) => setPage(newPage)}
          rowsPerPage={ROWS_PER_PAGE}
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
