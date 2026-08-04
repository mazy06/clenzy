import React from 'react';
import StatusChip from './StatusChip';
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  Button,
  Card,
  CardContent,
} from './ui';
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

/** Pastilles d'avatars affichees au maximum, compteur de surplus inclus. */
const MAX_AVATARS = 4;

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
  // Le groupe d'avatars du kit ne tronque pas : on reproduit le `max={4}` de MUI
  // (4 pastilles au total, la derniere devenant le compteur de surplus).
  const shownMembers = members.slice(0, members.length > MAX_AVATARS ? MAX_AVATARS - 1 : MAX_AVATARS);
  const surplusMembers = members.length - shownMembers.length;
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
    // La bordure de survol derive de l'accent de categorie, connu a l'execution :
    // Tailwind ne peut pas en emettre la classe, on la fait transiter par une
    // custom property posee en style, que la classe de survol consomme.
    <Card
      onClick={handleViewDetails}
      style={{ '--team-accent': `${accent}66` } as React.CSSProperties}
      className="h-full cursor-pointer overflow-hidden rounded-[var(--radius-lg)] border border-solid border-[var(--line)] bg-[var(--card)] ring-0 shadow-none [--card-spacing:0px] transition-[border-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none hover:border-[var(--team-accent)] hover:shadow-[var(--shadow-card)] hover:-translate-y-px"
    >
      <CardContent className="grow p-[10.5px] pb-[7.5px]">
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
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => { e.stopPropagation(); onMenuOpen(e, team); }}
            className="ms-[1.5px] text-[var(--muted)]"
            aria-label="Options"
          >
            <MoreVert size={16} strokeWidth={1.75} />
          </Button>
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
              <AvatarGroup className="*:data-[slot=avatar]:ring-[var(--card)]">
                {shownMembers.map((member) => (
                  <Avatar key={member.id} size="sm">
                    <AvatarFallback
                      className="text-[0.625rem] font-[family-name:var(--font-display)] font-semibold"
                      style={{ backgroundColor: `${accent}1F`, color: accent }}
                    >
                      {member.firstName?.charAt(0)}{member.lastName?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {surplusMembers > 0 && (
                  <AvatarGroupCount
                    className="text-[0.625rem] font-[family-name:var(--font-display)] font-semibold ring-[var(--card)] tabular-nums"
                    style={{ backgroundColor: `${accent}1F`, color: accent }}
                  >
                    +{surplusMembers}
                  </AvatarGroupCount>
                )}
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

      {/* Actions — pied de carte : deux actions de meme rang, la carte entiere
          etant deja cliquable. Le survol teinte a l'accent de categorie
          disparait au profit du survol du kit — il dependait d'une valeur
          calculee. `shrink` neutralise le `shrink-0` du Button, sans quoi deux
          boutons `w-full` freres deborderaient. */}
      <div className="flex items-center gap-[4.5px] px-[10.5px] pt-0 pb-[9px]">
        <Button
          variant="outline"
          size="sm"
          className="w-full shrink"
          onClick={(e) => { e.stopPropagation(); handleViewDetails(); }}
        >
          <Visibility strokeWidth={1.75} />
          Détails
        </Button>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            className="w-full shrink"
            onClick={(e) => { e.stopPropagation(); navigate(`/teams/${team.id}/edit`); }}
          >
            <Edit strokeWidth={1.75} />
            Modifier
          </Button>
        )}
      </div>
    </Card>
  );
});

TeamCard.displayName = 'TeamCard';

export default TeamCard;
