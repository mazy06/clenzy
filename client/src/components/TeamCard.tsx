import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  IconButton,
  Avatar,
  AvatarGroup,
  Button,
} from '@mui/material';
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

// ─── Accent color par catégorie (palette Clenzy) ─────────────────────────────

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
        borderRadius: '10px',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: 'none',
        overflow: 'hidden',
        transition: 'border-color 200ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms cubic-bezier(0.22, 1, 0.36, 1), transform 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        '&:hover': {
          borderColor: `${accent}66`,
          boxShadow: '0 1px 2px rgba(45, 55, 72, 0.04), 0 4px 12px rgba(45, 55, 72, 0.06)',
          transform: 'translateY(-1px)',
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1, p: 1.75, pb: 1.25 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25, gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: `${accent}1F`,
                color: accent,
                border: `1px solid ${accent}33`,
                flexShrink: 0,
              }}
            >
              <TypeIcon size={18} strokeWidth={1.75} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                fontWeight={600}
                sx={{
                  fontSize: '0.9rem',
                  lineHeight: 1.25,
                  color: 'text.primary',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={team.name}
              >
                {team.name}
              </Typography>
              <Typography
                color="text.secondary"
                sx={{
                  fontSize: '0.7rem',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                }}
                title={team.description || 'Aucune description'}
              >
                {team.description || 'Aucune description'}
              </Typography>
            </Box>
          </Box>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onMenuOpen(e, team); }}
            sx={{ p: 0.5, ml: 0.25, color: 'text.secondary' }}
            aria-label="Options"
          >
            <MoreVert size={16} strokeWidth={1.75} />
          </IconButton>
        </Box>

        {/* Type, statut, charge */}
        <Box sx={{ display: 'flex', gap: 0.5, mb: 1.25, flexWrap: 'wrap' }}>
          <Chip
            icon={<TypeIcon size={11} strokeWidth={2} />}
            label={typeLabel}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.01em',
              backgroundColor: `${accent}14`,
              color: accent,
              border: `1px solid ${accent}33`,
              borderRadius: '6px',
              px: 0.25,
              '& .MuiChip-icon': {
                color: `${accent} !important`,
                ml: '6px',
                mr: '-2px',
              },
              '& .MuiChip-label': { px: 0.875 },
            }}
          />
          <Chip
            label={getStatusLabel(status)}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.01em',
              backgroundColor: `${statusHex}14`,
              color: statusHex,
              border: `1px solid ${statusHex}33`,
              borderRadius: '6px',
              '& .MuiChip-label': { px: 0.875 },
            }}
          />
          {activeInterventionsCount > 0 && (
            <Chip
              icon={<Assignment size={11} strokeWidth={2} />}
              label={`${activeInterventionsCount} active${activeInterventionsCount > 1 ? 's' : ''}`}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.6875rem',
                fontWeight: 600,
                letterSpacing: '0.01em',
                backgroundColor: `${workloadColor}14`,
                color: workloadColor,
                border: `1px solid ${workloadColor}33`,
                borderRadius: '6px',
                fontVariantNumeric: 'tabular-nums',
                px: 0.25,
                '& .MuiChip-icon': {
                  color: `${workloadColor} !important`,
                  ml: '6px',
                  mr: '-2px',
                },
                '& .MuiChip-label': { px: 0.875 },
              }}
            />
          )}
        </Box>

        {/* Membres + interventions totales */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
          {members.length > 0 ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <AvatarGroup
                max={4}
                sx={{
                  '& .MuiAvatar-root': {
                    width: 24,
                    height: 24,
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    border: '2px solid',
                    borderColor: 'background.paper',
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
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  color: 'text.secondary',
                  fontVariantNumeric: 'tabular-nums',
                  ml: 0.25,
                }}
              >
                {members.length} {members.length > 1 ? 'membres' : 'membre'}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
              <Box sx={{ display: 'inline-flex', color: 'text.disabled' }}>
                <PersonIcon size={13} strokeWidth={1.75} />
              </Box>
              <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
                Aucun membre
              </Typography>
            </Box>
          )}

          {(team.totalInterventions ?? 0) > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
              <Box sx={{ display: 'inline-flex', color: 'text.secondary' }}>
                <Build size={12} strokeWidth={1.75} />
              </Box>
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  color: 'text.secondary',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {team.totalInterventions}
              </Typography>
            </Box>
          )}
        </Box>

        {team.createdAt && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ display: 'inline-flex', color: 'text.secondary', flexShrink: 0 }}>
              <GroupIcon size={13} strokeWidth={1.75} />
            </Box>
            <Typography
              sx={{
                fontSize: '0.7rem',
                color: 'text.secondary',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              Créée le {formatShortDate(team.createdAt)}
            </Typography>
          </Box>
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
            borderColor: 'divider',
            color: 'text.primary',
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
              borderColor: 'divider',
              color: 'text.primary',
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
