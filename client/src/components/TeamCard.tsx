import React from 'react';
import {
  Box,
  Card,
  CardContent,
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
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { INTERVENTION_TYPE_OPTIONS } from '../types/interventionTypes';
import type { Team } from '../services/api';
import { useTranslation } from '../hooks/useTranslation';
import { formatShortDate } from '../utils/formatUtils';

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

interface TeamCardProps {
  team: Team;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, team: Team) => void;
  activeInterventionsCount?: number;
  canEdit?: boolean;
}

// ─── Banner gradient par catégorie de type ─────────────────────────────────────

const getTypeGradient = (type: string): string => {
  const opt = INTERVENTION_TYPE_OPTIONS.find(t => t.value === type);
  if (!opt) return 'linear-gradient(135deg, #1e2a35 0%, #2a3a4a 50%, #243242 100%)';

  switch (opt.category) {
    case 'cleaning':
      return 'linear-gradient(135deg, #1a3a5c 0%, #234b73 50%, #1e3d63 100%)';
    case 'maintenance':
      return 'linear-gradient(135deg, #3d2e10 0%, #5c4520 50%, #4a3818 100%)';
    case 'specialized':
      return 'linear-gradient(135deg, #1a3d35 0%, #265c4f 50%, #1f4a40 100%)';
    case 'other':
      return 'linear-gradient(135deg, #3d1a1a 0%, #5c2626 50%, #4a1f1f 100%)';
    default:
      return 'linear-gradient(135deg, #1e2a35 0%, #2a3a4a 50%, #243242 100%)';
  }
};

// ─── Accent color par catégorie ─────────────────────────────────────────────────

const getAccentColor = (type: string): string => {
  const opt = INTERVENTION_TYPE_OPTIONS.find(t => t.value === type);
  if (!opt) return '#6B8A9A';

  switch (opt.category) {
    case 'cleaning': return '#5B9BD5';
    case 'maintenance': return '#E8A838';
    case 'specialized': return '#4ECDC4';
    case 'other': return '#E06060';
    default: return '#6B8A9A';
  }
};

// ─── Icône de type pour le banner ────────────────────────────────────────────

const getTypeIcon = (type: string, size: number = 44) => {
  const iconProps = { sx: { fontSize: size, color: 'rgba(255,255,255,0.18)' } };
  const opt = INTERVENTION_TYPE_OPTIONS.find(t => t.value === type);
  if (!opt) return <Category {...iconProps} />;

  switch (opt.category) {
    case 'cleaning': return <AutoAwesome {...iconProps} />;
    case 'maintenance': return <Build {...iconProps} />;
    case 'specialized':
      if (type === 'GARDENING') return <Yard {...iconProps} />;
      if (type === 'PEST_CONTROL') return <BugReport {...iconProps} />;
      if (type === 'RESTORATION') return <AutoFixHigh {...iconProps} />;
      return <Category {...iconProps} />;
    default: return <Category {...iconProps} />;
  }
};

// ─── Petite icône pour le label type ─────────────────────────────────────────

const getTypeSmallIcon = (type: string) => {
  const iconProps = { sx: { fontSize: 16, color: 'rgba(255,255,255,0.85)' } };
  const opt = INTERVENTION_TYPE_OPTIONS.find(t => t.value === type);
  if (!opt) return <Category {...iconProps} />;

  switch (opt.category) {
    case 'cleaning': return <AutoAwesome {...iconProps} />;
    case 'maintenance': return <Build {...iconProps} />;
    case 'specialized':
      if (type === 'GARDENING') return <Yard {...iconProps} />;
      if (type === 'PEST_CONTROL') return <BugReport {...iconProps} />;
      if (type === 'RESTORATION') return <AutoFixHigh {...iconProps} />;
      return <Category {...iconProps} />;
    default: return <Category {...iconProps} />;
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

// ─── Extracted sx styles ────────────────────────────────────────────────────

const styles = {
  cardRoot: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 12px 28px rgba(0,0,0,0.12), 0 4px 10px rgba(0,0,0,0.08)',
    },
  },
  bannerBox: {
    position: 'relative',
    height: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  typeLabelBox: {
    position: 'absolute',
    top: 10,
    left: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 0.6,
    bgcolor: 'rgba(255,255,255,0.08)',
    backdropFilter: 'blur(8px)',
    borderRadius: 1.5,
    border: '1px solid rgba(255,255,255,0.1)',
    px: 1,
    py: 0.4,
  },
  typeLabelText: {
    color: 'rgba(255,255,255,0.9)',
    fontWeight: 600,
    fontSize: '0.68rem',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  memberCountBadge: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
    bgcolor: 'rgba(255,255,255,0.12)',
    backdropFilter: 'blur(8px)',
    borderRadius: 1.5,
    border: '1px solid rgba(255,255,255,0.1)',
    px: 1,
    py: 0.4,
  },
  menuButton: {
    position: 'absolute',
    top: 10,
    right: 12,
    color: 'rgba(255,255,255,0.6)',
    bgcolor: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.08)',
    '&:hover': { bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' },
    width: 28,
    height: 28,
  },
  badgeBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    px: 1.5,
    py: 0.75,
    bgcolor: 'grey.50',
    borderBottom: '1px solid',
    borderColor: 'grey.100',
    gap: 0.75,
    minHeight: 34,
  },
  statusChip: {
    height: 22,
    fontSize: '0.62rem',
    fontWeight: 600,
    borderWidth: 1.5,
    '& .MuiChip-label': { px: 0.75 },
  },
  workloadChip: {
    height: 22,
    fontSize: '0.62rem',
    fontWeight: 600,
    borderWidth: 1.5,
    '& .MuiChip-label': { px: 0.75 },
    '& .MuiChip-icon': { fontSize: 12, ml: 0.5 },
  },
  infoContent: {
    flexGrow: 1,
    p: 1.75,
    pb: '8px !important',
  },
  titleText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '0.95rem',
    mb: 0.25,
    color: 'text.primary',
  },
  descriptionText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
    fontSize: '0.7rem',
    mb: 1,
  },
  actionBar: {
    px: 1.75,
    pb: 1.25,
    pt: 0,
    display: 'flex',
    gap: 0.75,
  },
  detailsButton: {
    fontSize: '0.72rem',
    py: 0.5,
    borderColor: 'grey.300',
    color: 'text.secondary',
    '&:hover': {
      borderColor: 'primary.main',
      color: 'primary.main',
      bgcolor: 'rgba(107, 138, 154, 0.04)',
    },
  },
} as const;

const TeamCard: React.FC<TeamCardProps> = React.memo(({
  team,
  onMenuOpen,
  activeInterventionsCount = 0,
  canEdit = false,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const status = getTeamStatus(team);
  const typeOption = INTERVENTION_TYPE_OPTIONS.find(t => t.value === team.interventionType);
  const typeLabel = typeOption?.label || team.interventionType;
  const members = team.members ?? [];
  const accent = getAccentColor(team.interventionType);

  const handleViewDetails = () => {
    navigate(`/teams/${team.id}`);
  };

  return (
    <Card
      sx={styles.cardRoot}
      onClick={handleViewDetails}
    >
      {/* ─── Zone visuelle : Bandeau gradient + dots ─── */}
      <Box
        sx={{
          ...styles.bannerBox,
          background: getTypeGradient(team.interventionType),
        }}
      >
        {/* Dots pattern layer */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `radial-gradient(circle, ${accent} 1.5px, transparent 1.5px)`,
            backgroundSize: '24px 24px',
            opacity: 0.2,
          }}
        />

        {/* Glow layer */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at 30% 50%, ${accent}30 0%, transparent 70%)`,
            opacity: 0.7,
          }}
        />

        {/* Large background icon */}
        <Box sx={{ position: 'absolute', right: 16, bottom: 8, opacity: 1 }}>
          {getTypeIcon(team.interventionType)}
        </Box>

        {/* Vignette */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.3) 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* Type label — glassmorphism */}
        <Box sx={styles.typeLabelBox}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {getTypeSmallIcon(team.interventionType)}
          </Box>
          <Typography variant="caption" sx={styles.typeLabelText}>
            {typeLabel}
          </Typography>
        </Box>

        {/* Member count badge — bottom left */}
        <Box sx={styles.memberCountBadge}>
          <GroupIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }} />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600, fontSize: '0.68rem' }}>
            {members.length} {members.length > 1 ? 'membres' : 'membre'}
          </Typography>
        </Box>

        {/* Menu contextuel — coin supérieur droit */}
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onMenuOpen(e, team); }}
          sx={styles.menuButton}
        >
          <MoreVert sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* ─── Barre de badges ─── */}
      <Box sx={styles.badgeBar}>
        {/* Gauche : statut */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          <Chip
            label={getStatusLabel(status)}
            color={getStatusColor(status)}
            size="small"
            variant="outlined"
            sx={styles.statusChip}
          />
        </Box>

        {/* Droite : workload + date */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          {activeInterventionsCount > 0 && (
            <Chip
              icon={<Assignment sx={{ fontSize: 12 }} />}
              label={`${activeInterventionsCount} active${activeInterventionsCount > 1 ? 's' : ''}`}
              size="small"
              color={activeInterventionsCount > 5 ? 'error' : activeInterventionsCount > 2 ? 'warning' : 'info'}
              variant="outlined"
              sx={styles.workloadChip}
            />
          )}
          {team.createdAt && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.68rem', lineHeight: 1 }}>
              {formatShortDate(team.createdAt)}
            </Typography>
          )}
        </Box>
      </Box>

      {/* ─── Zone info ─── */}
      <CardContent sx={styles.infoContent}>
        {/* Titre */}
        <Typography
          variant="subtitle1"
          fontWeight={700}
          sx={styles.titleText}
          title={team.name}
        >
          {team.name}
        </Typography>

        {/* Description */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={styles.descriptionText}
          title={team.description || 'Aucune description'}
        >
          {team.description || 'Aucune description'}
        </Typography>

        {/* Membres — AvatarGroup + stats */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          {members.length > 0 ? (
            <AvatarGroup
              max={4}
              sx={{
                '& .MuiAvatar-root': {
                  width: 24,
                  height: 24,
                  fontSize: '0.6rem',
                  border: '2px solid #fff',
                },
              }}
            >
              {members.map((member) => (
                <Avatar
                  key={member.id}
                  sx={{ bgcolor: 'primary.main' }}
                >
                  {member.firstName?.charAt(0)}{member.lastName?.charAt(0)}
                </Avatar>
              ))}
            </AvatarGroup>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <PersonIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.62rem' }}>
                Aucun membre
              </Typography>
            </Box>
          )}

          {/* Spacer */}
          <Box sx={{ flex: 1 }} />

          {/* Total interventions chip */}
          {(team.totalInterventions ?? 0) > 0 && (
            <Chip
              icon={<Build sx={{ fontSize: 12 }} />}
              label={`${team.totalInterventions} interv.`}
              size="small"
              color="primary"
              variant="outlined"
              sx={{
                height: 22,
                fontSize: '0.62rem',
                fontWeight: 600,
                borderWidth: 1.5,
                '& .MuiChip-label': { px: 0.75 },
                '& .MuiChip-icon': { fontSize: 12, ml: 0.5 },
                flexShrink: 0,
              }}
            />
          )}
        </Box>
      </CardContent>

      {/* ─── Zone actions ─── */}
      <Box sx={styles.actionBar}>
        <Button
          fullWidth
          size="small"
          startIcon={<Visibility sx={{ fontSize: 15 }} />}
          onClick={(e) => { e.stopPropagation(); handleViewDetails(); }}
          variant="outlined"
          sx={styles.detailsButton}
        >
          Détails
        </Button>
        {canEdit && (
          <Button
            fullWidth
            size="small"
            startIcon={<Edit sx={{ fontSize: 15 }} />}
            onClick={(e) => { e.stopPropagation(); navigate(`/teams/${team.id}/edit`); }}
            variant="outlined"
            color="primary"
            sx={{ fontSize: '0.72rem', py: 0.5 }}
          >
            Modifier
          </Button>
        )}
      </Box>
    </Card>
  );
});

TeamCard.displayName = 'TeamCard';

export default TeamCard;
