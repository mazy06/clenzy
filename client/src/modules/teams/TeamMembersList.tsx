import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  Divider,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Delete,
  SortByAlpha,
  Badge,
} from '@mui/icons-material';
import { interventionsApi } from '../../services/api';
import type { Intervention, TeamMember } from '../../services/api';
import { useTranslation } from '../../hooks/useTranslation';

interface TeamMembersListProps {
  members: TeamMember[];
  teamId: number;
  teamName: string;
  canEdit?: boolean;
  onRemoveMember?: (userId: number) => void;
}

type SortBy = 'name' | 'role';

const TeamMembersList: React.FC<TeamMembersListProps> = ({
  members,
  teamId,
  teamName,
  canEdit = false,
  onRemoveMember,
}) => {
  const { t } = useTranslation();
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [interventions, setInterventions] = useState<Intervention[]>([]);

  useEffect(() => {
    const loadInterventions = async () => {
      try {
        const data = await interventionsApi.getAll();
        const list = Array.isArray(data) ? data : (data as any).content || [];
        const teamInterventions = list.filter(
          (i: Intervention) => i.assignedToType === 'team' && i.assignedToName === teamName
        );
        setInterventions(teamInterventions);
      } catch {
        setInterventions([]);
      }
    };

    loadInterventions();
  }, [teamId, teamName]);

  // Count interventions per member (approximate: check if assignedToName contains member name)
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

  // Role labels
  const getRoleLabel = (role: string) => {
    const roleLabels: Record<string, string> = {
      housekeeper: t('teams.roles.housekeeper'),
      technician: t('teams.roles.technician'),
      supervisor: t('teams.roles.supervisor'),
      manager: t('teams.roles.manager'),
    };
    return roleLabels[role?.toLowerCase()] || role;
  };

  type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

  const getRoleColor = (role: string): ChipColor => {
    const roleColors: Record<string, ChipColor> = {
      housekeeper: 'success',
      technician: 'primary',
      supervisor: 'warning',
      manager: 'error',
    };
    return roleColors[role?.toLowerCase()] || 'default';
  };

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 600 }}>
            {t('teams.members.title')} ({members.length})
          </Typography>
          <ToggleButtonGroup
            value={sortBy}
            exclusive
            onChange={handleSortChange}
            size="small"
          >
            <ToggleButton value="name" sx={{ px: 1.5, py: 0.5 }}>
              <SortByAlpha sx={{ fontSize: 16, mr: 0.5 }} />
              <Typography variant="caption">{t('teams.members.sortByName')}</Typography>
            </ToggleButton>
            <ToggleButton value="role" sx={{ px: 1.5, py: 0.5 }}>
              <Badge sx={{ fontSize: 16, mr: 0.5 }} />
              <Typography variant="caption">{t('teams.members.sortByRole')}</Typography>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Member list */}
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
                        <IconButton
                          edge="end"
                          color="error"
                          size="small"
                          onClick={() => onRemoveMember(memberId)}
                        >
                          <Delete sx={{ fontSize: 18 }} />
                        </IconButton>
                      ) : undefined
                    }
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
                        {member.firstName?.charAt(0)}
                        {member.lastName?.charAt(0)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="body1" fontWeight={500}>
                            {member.firstName} {member.lastName}
                          </Typography>
                          <Chip
                            label={getRoleLabel(member.roleInTeam || member.role)}
                            size="small"
                            color={getRoleColor(member.roleInTeam || member.role)}
                            variant="outlined"
                            sx={{ height: 22, fontSize: '0.7rem', borderWidth: 1.5, '& .MuiChip-label': { px: 0.75 } }}
                          />
                          <Chip
                            label={isAvailable ? t('teams.workload.available') : t('teams.workload.busy')}
                            size="small"
                            variant="outlined"
                            color={isAvailable ? 'success' : 'warning'}
                            sx={{
                              height: 22,
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              borderWidth: 1.5,
                              '& .MuiChip-label': { px: 0.75 },
                            }}
                          />
                        </Box>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <Typography variant="body2" color="text.secondary">
                            {member.email || member.userEmail}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            - {interventionCount} {t('teams.members.interventionCount')}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < sortedMembers.length - 1 && <Divider />}
                </React.Fragment>
              );
            })}
          </List>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              {t('teams.members.noMembers')}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default TeamMembersList;
