import React, { useState, useMemo } from 'react';
import { Card, CardContent, List, ListItem, ListItemAvatar, ListItemText, Avatar, Chip, Divider, IconButton, ToggleButton, ToggleButtonGroup } from '@mui/material';
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

  const handleSortChange = (_: React.MouseEvent<HTMLElement>, newSort: SortBy | null) => {
    if (newSort !== null) {
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
      <CardContent sx={{ p: 3 }}>
        <div className="flex justify-between items-center mb-3">
          <h6 className="cn-text-h6 text-[var(--ink)] font-semibold">
            {t('teams.members.title')} ({members.length})
          </h6>
          <ToggleButtonGroup value={sortBy} exclusive onChange={handleSortChange} size="small">
            <ToggleButton value="name" sx={{ px: 1.5, py: 0.5 }}>
              <span className="inline-flex me-0.5"><SortByAlpha size={16} strokeWidth={1.75} /></span>
              <span className="cn-text-caption">{t('teams.members.sortByName')}</span>
            </ToggleButton>
            <ToggleButton value="role" sx={{ px: 1.5, py: 0.5 }}>
              <span className="inline-flex me-0.5"><Badge size={16} strokeWidth={1.75} /></span>
              <span className="cn-text-caption">{t('teams.members.sortByRole')}</span>
            </ToggleButton>
          </ToggleButtonGroup>
        </div>

        {sortedMembers.length > 0 ? (
          <List>
            {sortedMembers.map((member, index) => {
              const memberId = member.userId || member.id;
              const interventionCount = memberInterventionCounts.counts[memberId] || 0;
              const activeCount = memberInterventionCounts.activeCounts[memberId] || 0;
              const isAvailable = activeCount < 3;

              return (
                <React.Fragment key={memberId}>
                  <ListItem
                    sx={{ px: 1, py: 1.5 }}
                    secondaryAction={
                      canEdit && onRemoveMember ? (
                        <IconButton edge="end" color="error" size="small" onClick={() => onRemoveMember(memberId)}>
                          <Delete size={18} strokeWidth={1.75} />
                        </IconButton>
                      ) : undefined
                    }
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'var(--accent)', color: 'var(--on-accent)', fontFamily: 'var(--font-display)', fontWeight: 600, borderRadius: '10px', width: 36, height: 36 }}>
                        {member.firstName?.charAt(0)}{member.lastName?.charAt(0)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="cn-text-body1 font-medium">
                            {member.firstName} {member.lastName}
                          </p>
                          {(() => { const c = getRoleHex(member.roleInTeam || member.role); return (
                            <Chip
                              label={getRoleLabel(member.roleInTeam || member.role)}
                              size="small"
                              sx={{ height: 24, fontSize: '0.7rem', fontWeight: 600, backgroundColor: `${c}18`, color: c, '& .MuiChip-label': { px: 0.75 } }}
                            />
                          ); })()}
                          {(() => { const c = isAvailable ? '#4A9B8E' : '#D4A574'; return (
                            <Chip
                              label={isAvailable ? t('teams.workload.available') : t('teams.workload.busy')}
                              size="small"
                              sx={{ height: 24, fontSize: '0.7rem', fontWeight: 600, backgroundColor: `${c}18`, color: c, '& .MuiChip-label': { px: 0.75 } }}
                            />
                          ); })()}
                        </div>
                      }
                      secondary={
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="cn-text-body2 text-muted-foreground">
                            {member.email || member.userEmail}
                          </p>
                          <span className="cn-text-caption text-muted-foreground">
                            - {interventionCount} {t('teams.members.interventionCount')}
                          </span>
                        </div>
                      }
                    />
                  </ListItem>
                  {index < sortedMembers.length - 1 && <Divider />}
                </React.Fragment>
              );
            })}
          </List>
        ) : (
          <div className="text-center py-6">
            <p className="cn-text-body1 text-muted-foreground">
              {t('teams.members.noMembers')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TeamMembersList;
