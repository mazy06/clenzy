import React from 'react';
import StatusChip, { type StatusTone } from '../../../components/StatusChip';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui';
import type { ChipColor } from '../../../types';

// Couleur semantique → ton de la primitive StatusChip, qui porte deja le couple
// Baitly UI conforme AA (encre `-ink` sur fond `-soft`).
const SEM_TONE: Partial<Record<ChipColor, StatusTone>> = {
  success: 'ok',
  warning: 'warn',
  error: 'err',
  info: 'info',
  primary: 'accent',
  secondary: 'accent',
};
import { usersApi } from '../../../services/api/usersApi';
import type { UserDetailsData, RoleInfo, StatusInfo } from './userDetailsTypes';
import { getRoleInfo, getStatusInfo } from './userDetailsTypes';

interface UserProfileCardProps {
  user: UserDetailsData;
  roles: RoleInfo[];
  statuses: StatusInfo[];
}

const UserProfileCard: React.FC<UserProfileCardProps> = ({ user, roles, statuses }) => {
  const roleInfo = getRoleInfo(user.role, roles);
  const statusInfo = getStatusInfo(user.status, statuses);
  // Real avatar URL (PMS-served), with cache-busting on updatedAt. Falls back to initials.
  const photoUrl = user.profilePictureUrl
    ? usersApi.profilePictureUrl(user.id, user.updatedAt ?? null)
    : null;

  return (
    <header className="flex flex-col gap-5 px-4 py-7 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-4">
        <Avatar className="size-16 shrink-0 rounded-full sm:size-18">
          {photoUrl && <AvatarImage src={photoUrl} alt={`${user.firstName} ${user.lastName}`} />}
          <AvatarFallback className="bg-primary text-primary-foreground text-xl font-semibold">
            {`${user.firstName.charAt(0)}${user.lastName.charAt(0)}`}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h2 className="m-0 text-xl font-semibold tracking-tight text-foreground text-balance sm:text-2xl [overflow-wrap:anywhere]">
            {user.firstName} {user.lastName}
          </h2>
          <p className="m-0 mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {user.email}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <StatusChip
          tone={SEM_TONE[roleInfo.color] ?? 'neutral'}
          label={roleInfo.label}
          icon={<span className="inline-flex">
            {React.cloneElement(roleInfo.icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
              size: 14,
              strokeWidth: 1.75,
            })}
          </span>}
        />
        <StatusChip tone={SEM_TONE[statusInfo.color] ?? 'neutral'} label={statusInfo.label} />
      </div>
    </header>
  );
};

export default UserProfileCard;
