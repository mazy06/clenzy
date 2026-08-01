import React from 'react';
import StatusChip from './StatusChip';
import { Card, CardContent, CardActions, IconButton, Avatar, AvatarGroup, Button } from '@mui/material';
import {
  MoreVert,
  Visibility,
  Edit,
  Group as GroupIcon,
  AutoAwesome,
  Build,
  Category,
  Yard,
  BugReport,
  AutoFixHigh,
  Assignment,
  Person as PersonIcon,
} from '../icons';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { INTERVENTION_TYPE_OPTIONS } from '../types/interventionTypes';
import type { Team } from '../services/api';
import { formatShortDate } from '../utils/formatUtils';
import type { ChipColor } from '../types';

interface TeamCardProps {
  team: Team;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, team: Team) => void;
  activeInterventionsCount?: number;
  canEdit?: boolean;
}

// ─── Accent color par catégorie (palette Baitly) ─────────────────────────────

const getAccentColor = (type: string): string => {
  const opt = INTERVENTION_TYPE_OPTIONS.find(t => t.value === type);
  if (!opt) return '#6B8A9A';

  switch (opt.category) {
    case 'cleaning': return '#7BA3C2';
    case 'maintenance': return '#D4A574';
    case 'specialized': return '#4A9B8E';
    case 'other': return '#C97A7A';
    default: return '#6B8A9A';
  }
};

// ─── Type icon component ─────────────────────────────────────────────────────

const getTypeIconComponent = (type: string): LucideIcon => {
  const opt = INTERVENTION_TYPE_OPTIONS.find(t => t.value === type);
  if (!opt) return Category;

  switch (opt.category) {
    case 'cleaning': return AutoAwesome;
    case 'maintenance': return Build;
    case 'specialized':
      if (type === 'GARDENING') return Yard;
      if (type === 'PEST_CONTROL') return BugReport;
      if (type === 'RESTORATION') return AutoFixHigh;
      return Category;
    default: return Category;
  }
};

// ─── Statut helpers ──────────────────────────────────────────────────────────

const getTeamStatus = (team: Team): string => {
  if (team.status) return team.status;
  if (team.lastIntervention) {
    const days = Math.floor((Date.now() - new Date(team.lastIntervention).getTime()) / (1000 * 60 * 60 * 24));
    if (days > 30) return 'inactive';
    if (days > 7) return 'maintenance';
    return 'active';
  }
  return 'active';
};

const getStatusHex = (status: string): string => {
  switch (status) {
    case 'active': return '#4A9B8E';
    case 'inactive': return '#C97A7A';
    case 'maintenance': return '#D4A574';
    default: return '#8A8378';
  }
};

const getStatusColor = (status: string): ChipColor => {
  switch (status) {
    case 'active': return 'success';
    case 'inactive': return 'error';
    case 'maintenance': return 'warning';
    default: return 'default';
  }
};

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'active': return 'Active';
    case 'inactive': return 'Inactive';
    case 'maintenance': return 'Maintenance';
    default: return 'Inconnu';
  }
};

const INTERVENTION_BLUE = '#6B8A9A';

const TeamCard: React.FC<TeamCardProps> = React.memo(({
  team,
  onMenuOpen,
  activeInterventionsCount = 0,
  canEdit = false,
}) => {
  const navigate = useNavigate();

  const status = getTeamStatus(team);
  const statusHex = getStatusHex(status);
  const typeOption = INTERVENTION_TYPE_OPTIONS.find(t => t.value === team.interventionType);
  const typeLabel = typeOption?.label || team.interventionType;
  const members = team.members ?? [];
  const accent = getAccentColor(team.interventionType);
  const TypeIcon = getTypeIconComponent(team.interventionType);

  const handleViewDetails = () => {
    navigate(`/teams/${team.id}`);
  };

  const workloadColor = activeInterventionsCount > 5
    ? '#C97A7A'
    : activeInterventionsCount > 2
      ? '#D4A574'
      : INTERVENTION_BLUE;

  return (
    <Card
      onClick={handleViewDetails}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--line)',
        bgcolor: 'var(--card)',
        boxShadow: 'none',
        overflow: 'hidden',
        transition: 'border-color 200ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms cubic-bezier(0.22, 1, 0.36, 1), transform 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        '&:hover': {
          borderColor: `${accent}66`,
          boxShadow: 'var(--shadow-card)',
          transform: 'translateY(-1px)',
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1, p: 1.75, pb: 1.25 }}>
        {/* Header */}
        <div className="flex justify-between items-start mb-2 gap-1.5">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-[38px] h-[38px] rounded-[8px] inline-flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}1F`, color: accent }}>
              <TypeIcon size={18} strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="cn-text-body1 font-semibold text-[0.9rem] leading-[1.25] text-foreground overflow-hidden text-ellipsis whitespace-nowrap" title={team.name}>
                {team.name}
              </p>
              <p className="cn-text-body1 text-muted-foreground text-[0.7rem] leading-[1.3] overflow-hidden text-ellipsis whitespace-nowrap block" title={team.description || 'Aucune description'}>
                {team.description || 'Aucune description'}
              </p>
            </div>
          </div>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onMenuOpen(e, team); }}
            sx={{ p: 0.5, ml: 0.25, color: 'text.secondary' }}
            aria-label="Options"
          >
            <MoreVert size={16} strokeWidth={1.75} />
          </IconButton>
        </div>

        {/* Type, statut, charge */}
        <div className="flex gap-0.5 mb-2 flex-wrap">
          <StatusChip tokens={{ color: accent, bg: `${accent}18` }} label={typeLabel} icon={<TypeIcon size={11} strokeWidth={2} />} />
          <StatusChip tokens={{ color: statusHex, bg: `${statusHex}18` }} label={getStatusLabel(status)} />
          {activeInterventionsCount > 0 && (
            <StatusChip tokens={{ color: workloadColor, bg: `${workloadColor}18` }} label={`${activeInterventionsCount} active${activeInterventionsCount > 1 ? 's' : ''}`} icon={<Assignment size={11} strokeWidth={2} />} className="tabular-nums" />
          )}
        </div>

        {/* Membres + interventions totales */}
        <div className="flex items-center justify-between gap-1.5 mb-1">
          {members.length > 0 ? (
            <div className="flex items-center gap-1">
              <AvatarGroup
                max={4}
                sx={{
                  '& .MuiAvatar-root': {
                    width: 24,
                    height: 24,
                    fontSize: '0.625rem',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    border: '2px solid var(--card)',
                    bgcolor: `${accent}1F`,
                    color: accent,
                  },
                }}
              >
                {members.map((member) => (
                  <Avatar key={member.id}>
                    {member.firstName?.charAt(0)}{member.lastName?.charAt(0)}
                  </Avatar>
                ))}
              </AvatarGroup>
              <p className="cn-text-body1 text-[0.7rem] text-muted-foreground tabular-nums ms-0.5">
                {members.length} {members.length > 1 ? 'membres' : 'membre'}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <div className="inline-flex text-muted-foreground opacity-60">
                <PersonIcon size={13} strokeWidth={1.75} />
              </div>
              <p className="cn-text-body1 text-[0.7rem] text-muted-foreground opacity-60">
                Aucun membre
              </p>
            </div>
          )}

          {(team.totalInterventions ?? 0) > 0 && (
            <div className="flex items-center gap-0.5 shrink-0">
              <div className="inline-flex text-muted-foreground">
                <Build size={12} strokeWidth={1.75} />
              </div>
              <p className="cn-text-body1 text-[0.7rem] text-muted-foreground tabular-nums">
                {team.totalInterventions}
              </p>
            </div>
          )}
        </div>

        {team.createdAt && (
          <div className="flex items-center gap-1.5">
            <div className="inline-flex text-muted-foreground shrink-0">
              <GroupIcon size={13} strokeWidth={1.75} />
            </div>
            <p className="cn-text-body1 text-[0.7rem] text-muted-foreground tabular-nums">
              Créée le {formatShortDate(team.createdAt)}
            </p>
          </div>
        )}
      </CardContent>

      {/* Actions */}
      <CardActions sx={{ pt: 0, px: 1.75, pb: 1.5, gap: 0.75 }}>
        <Button
          fullWidth
          size="small"
          startIcon={<Visibility size={14} strokeWidth={1.75} />}
          onClick={(e) => { e.stopPropagation(); handleViewDetails(); }}
          variant="outlined"
          sx={{
            fontSize: '0.72rem',
            fontWeight: 600,
            letterSpacing: '0.01em',
            borderRadius: '6px',
            borderColor: 'var(--line-2)',
            color: 'var(--body)',
            textTransform: 'none',
            py: 0.625,
            '&:hover': {
              borderColor: `${accent}80`,
              backgroundColor: `${accent}10`,
            },
          }}
        >
          Détails
        </Button>
        {canEdit && (
          <Button
            fullWidth
            size="small"
            startIcon={<Edit size={14} strokeWidth={1.75} />}
            onClick={(e) => { e.stopPropagation(); navigate(`/teams/${team.id}/edit`); }}
            variant="outlined"
            sx={{
              fontSize: '0.72rem',
              fontWeight: 600,
              letterSpacing: '0.01em',
              borderRadius: '6px',
              borderColor: 'var(--line-2)',
              color: 'var(--body)',
              textTransform: 'none',
              py: 0.625,
              '&:hover': {
                borderColor: `${accent}80`,
                backgroundColor: `${accent}10`,
              },
            }}
          >
            Modifier
          </Button>
        )}
      </CardActions>
    </Card>
  );
});

TeamCard.displayName = 'TeamCard';

export default TeamCard;
