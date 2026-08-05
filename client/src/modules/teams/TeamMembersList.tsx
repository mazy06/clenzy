import React, { useState, useMemo } from 'react';
import StatusChip from '../../components/StatusChip';
import {
  Avatar,
  AvatarFallback,
  Button,
  Card,
  CardContent,
  Separator,
  ToggleGroup,
  ToggleGroupItem,
} from '../../components/ui';
import {
  Delete,
  SortByAlpha,
  Badge,
} from '../../icons';
import { useQuery } from '@tanstack/react-query';
import { interventionsApi } from '../../services/api/interventionsApi';
import type { Intervention, TeamMember } from '../../services/api';
import { extractApiList } from '../../types';
import type { ChipColor } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { teamsKeys } from './useTeamsList';

interface TeamMembersListProps {
  members: TeamMember[];
  teamId: number;
  teamName: string;
  canEdit?: boolean;
  onRemoveMember?: (userId: number) => void;
}

type SortBy = 'name' | 'role';

const getRoleHex = (role: string): string => {
  // Palette Baitly validee (alignee UsersList / orgRoleLabels)
  const roleHexMap: Record<string, string> = {
    housekeeper: '#4A9B8E',
    technician: '#6B8A9A',
    supervisor: '#7BA3C2',
    manager: '#D4A574',
    laundry: '#8A8378',
    exterior_tech: '#6B8A9A',
    leader: '#7B68A8',
  };
  return roleHexMap[role?.toLowerCase()] || '#8A8378';
};

const getRoleColor = (role: string): ChipColor => {
  const roleColors: Record<string, ChipColor> = {
    housekeeper: 'success',
    technician: 'primary',
    supervisor: 'warning',
    manager: 'error',
    laundry: 'default',
    exterior_tech: 'primary',
    leader: 'secondary',
  };
  return roleColors[role?.toLowerCase()] || 'default';
};

const TeamMembersList: React.FC<TeamMembersListProps> = ({
  members,
  teamId,
  teamName,
  canEdit = false,
  onRemoveMember,
}) => {
  const { t } = useTranslation();
  const [sortBy, setSortBy] = useState<SortBy>('name');

  // ─── Team interventions query (shared key for caching) ──────────────────
  const interventionsQuery = useQuery({
    queryKey: teamsKeys.workload(teamName),
    queryFn: async () => {
      const data = await interventionsApi.getAll();
      const list = extractApiList<Intervention>(data);
      return list.filter(
        (i) => i.assignedToType === 'team' && i.assignedToName === teamName
      );
    },
    staleTime: 30_000,
  });

  const interventions = useMemo(() => interventionsQuery.data ?? [], [interventionsQuery.data]);

  // Count interventions per member
  const memberInterventionCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    const activeCounts: Record<number, number> = {};

    members.forEach((member) => {
      const memberId = member.userId || member.id;
      const fullName = `${member.firstName} ${member.lastName}`;
      const memberInterventions = interventions.filter(
        (i) => i.assignedToName?.toLowerCase().includes(fullName.toLowerCase())
      );
      counts[memberId] = memberInterventions.length;
      activeCounts[memberId] = memberInterventions.filter(
        (i) => i.status === 'IN_PROGRESS'
      ).length;
    });

    return { counts, activeCounts };
  }, [members, interventions]);

  // Sort members
  const sortedMembers = useMemo(() => {
    const sorted = [...members];
    if (sortBy === 'name') {
      sorted.sort((a, b) =>
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
      );
    } else {
      sorted.sort((a, b) => (a.role || '').localeCompare(b.role || ''));
    }
    return sorted;
  }, [members, sortBy]);

  // ToggleGroup rend une chaine vide quand on deselectionne l'item actif :
  // on ignore ce cas pour garder un tri toujours defini (equivalent du
  // `newSort !== null` de ToggleButtonGroup).
  const handleSortChange = (newSort: string) => {
    if (newSort === 'name' || newSort === 'role') {
      setSortBy(newSort);
    }
  };

  const getRoleLabel = (role: string) => {
    const roleLabels: Record<string, string> = {
      housekeeper: t('teams.roles.housekeeper'),
      technician: t('teams.roles.technician'),
      supervisor: t('teams.roles.supervisor'),
      manager: t('teams.roles.manager'),
      laundry: 'Blanchisserie',
      exterior_tech: 'Tech. Extérieur',
      leader: "Chef d'équipe",
    };
    return roleLabels[role?.toLowerCase()] || role;
  };

  return (
    <Card>
      <CardContent className="p-[18px]">
        <div className="flex justify-between items-center mb-3">
          <h6 className="text-sm font-semibold text-foreground">
            {t('teams.members.title')} ({members.length})
          </h6>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={sortBy}
            onValueChange={handleSortChange}
          >
            <ToggleGroupItem value="name">
              <SortByAlpha size={16} strokeWidth={1.75} />
              <span className="text-2xs">{t('teams.members.sortByName')}</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="role">
              <Badge size={16} strokeWidth={1.75} />
              <span className="text-2xs">{t('teams.members.sortByRole')}</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {sortedMembers.length > 0 ? (
          <div>
            {sortedMembers.map((member, index) => {
              const memberId = member.userId || member.id;
              const interventionCount = memberInterventionCounts.counts[memberId] || 0;
              const activeCount = memberInterventionCounts.activeCounts[memberId] || 0;
              const isAvailable = activeCount < 3;

              return (
                <React.Fragment key={memberId}>
                  <div className="flex items-center gap-3 px-1.5 py-[9px]">
                    <Avatar className="size-9 rounded-[10px] shrink-0">
                      <AvatarFallback className="rounded-[10px] bg-primary text-primary-foreground font-[family-name:var(--font-display)] font-semibold">
                        {member.firstName?.charAt(0)}{member.lastName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium">
                          {member.firstName} {member.lastName}
                        </p>
                        {/* Teinte de rôle : valeur runtime hors palette sémantique,
                            la primitive en dérive le fond doux elle-même. */}
                        <StatusChip
                          color={getRoleHex(member.roleInTeam || member.role)}
                          label={getRoleLabel(member.roleInTeam || member.role)}
                          className="h-[24px] text-[0.7rem]"
                        />
                        <StatusChip
                          tone={isAvailable ? 'ok' : 'warn'}
                          label={isAvailable ? t('teams.workload.available') : t('teams.workload.busy')}
                          className="h-[24px] text-[0.7rem]"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-xs text-muted-foreground">
                          {member.email || member.userEmail}
                        </p>
                        <span className="text-2xs text-muted-foreground tabular-nums">
                          - {interventionCount} {t('teams.members.interventionCount')}
                        </span>
                      </div>
                    </div>
                    {canEdit && onRemoveMember && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('teams.members.removeMember', 'Retirer le membre')}
                        className="shrink-0 text-destructive hover:text-destructive"
                        onClick={() => onRemoveMember(memberId)}
                      >
                        <Delete size={18} strokeWidth={1.75} />
                      </Button>
                    )}
                  </div>
                  {index < sortedMembers.length - 1 && <Separator />}
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              {t('teams.members.noMembers')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TeamMembersList;
