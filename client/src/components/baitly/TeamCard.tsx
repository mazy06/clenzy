import * as React from 'react';
import { BrushIcon, CalendarIcon, MoreVerticalIcon, UsersIcon, WrenchIcon } from 'lucide-react';
import { Button, Card } from '../ui';
import StatusChip from './StatusChip';
import GuestAvatar from './GuestAvatar';
import { cn } from '../../utils/cn';

/**
 * Baitly — remaster de components/TeamCard.tsx (MUI, 401 lignes).
 * Carte d'équipe : type d'intervention, membres (pile d'avatars), statut,
 * compteurs d'activité. Typage structurel des champs utilisés (compatible
 * avec le Team de services/api/teamsApi).
 */
export interface TeamCardMember {
  id?: number;
  firstName?: string;
  lastName?: string;
  userName?: string;
}

export interface TeamCardData {
  id: number | string;
  name: string;
  description?: string;
  interventionType: string;
  status?: 'active' | 'inactive' | 'maintenance';
  members?: TeamCardMember[];
  totalInterventions?: number;
  lastIntervention?: string;
  createdAt?: string;
}

export interface TeamCardProps {
  team: TeamCardData;
  onMenuOpen?: (event: React.MouseEvent<HTMLElement>, team: TeamCardData) => void;
  activeInterventionsCount?: number;
  canEdit?: boolean;
  className?: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; accent: string }> = {
  CLEANING: { icon: <BrushIcon />, accent: 'bg-primary-soft text-primary' },
  MAINTENANCE: { icon: <WrenchIcon />, accent: 'bg-warning-soft text-warning' },
};

const STATUS_TONE = { active: 'ok', inactive: 'neutral', maintenance: 'warn' } as const;
const STATUS_LABEL = { active: 'Active', inactive: 'Inactive', maintenance: 'En pause' } as const;

const memberName = (member: TeamCardMember) =>
  [member.firstName, member.lastName].filter(Boolean).join(' ') || member.userName || '?';

export default function TeamCard({
  team,
  onMenuOpen,
  activeInterventionsCount,
  canEdit = true,
  className,
}: TeamCardProps) {
  const type = TYPE_CONFIG[team.interventionType] ?? {
    icon: <UsersIcon />,
    accent: 'bg-muted text-muted-foreground',
  };
  const members = team.members ?? [];
  const status = team.status ?? 'active';

  return (
    <Card className={cn('gap-3 py-4', className)}>
      <div className="flex items-start justify-between gap-2 px-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className={cn(
              'mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md [&>svg]:size-4',
              type.accent
            )}
          >
            {type.icon}
          </span>
          <div className="min-w-0">
            <h3 className="m-0 truncate text-sm font-semibold text-foreground">{team.name}</h3>
            {team.description && (
              <p className="m-0 mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {team.description}
              </p>
            )}
          </div>
        </div>
        {canEdit && onMenuOpen && (
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Actions"
            onClick={(event) => onMenuOpen(event, team)}
          >
            <MoreVerticalIcon />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-4">
        <StatusChip tone={STATUS_TONE[status]} label={STATUS_LABEL[status]} dot size="sm" />
        {activeInterventionsCount !== undefined && activeInterventionsCount > 0 && (
          <StatusChip tone="info" label={`${activeInterventionsCount} en cours`} size="sm" />
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-4 pt-3">
        <div className="flex items-center">
          {members.slice(0, 4).map((member, index) => (
            <span key={member.id ?? index} className={cn(index > 0 && '-ms-2')}>
              <GuestAvatar
                name={memberName(member)}
                size={26}
                className="ring-2 ring-card"
              />
            </span>
          ))}
          {members.length > 4 && (
            <span className="-ms-2 inline-flex size-[26px] items-center justify-center rounded-full bg-muted text-2xs font-semibold text-muted-foreground ring-2 ring-card">
              +{members.length - 4}
            </span>
          )}
          {members.length === 0 && (
            <span className="text-xs text-faint">Aucun membre</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {team.totalInterventions !== undefined && (
            <span className="tabular-nums">{team.totalInterventions} interventions</span>
          )}
          {team.lastIntervention && (
            <span className="flex items-center gap-1">
              <CalendarIcon className="size-3.5" />
              {team.lastIntervention}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
