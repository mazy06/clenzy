import React from 'react';
import StatusChip, { type StatusTone } from '../../../components/StatusChip';
import { Avatar, AvatarFallback, AvatarImage, Card, CardContent } from '../../../components/ui';
import { cn } from '../../../utils/cn';
import { Mail as MailIcon, Phone as PhoneIcon, Business } from '../../../icons';
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

/**
 * Hero card for the user details page.
 *
 * <h4>Design</h4>
 * <ul>
 *   <li>Avatar sur l'aplat de marque (no glassmorphism, no neon).</li>
 *   <li>Asymmetric layout: identity on the left, chips on the right. No 3-up KPI tile
 *       template (an Impeccable absolute ban).</li>
 *   <li>Meta row underneath is a thin inline list (email / phone / org) — communicates the
 *       same info without faking metrics.</li>
 * </ul>
 */
const UserProfileCard: React.FC<UserProfileCardProps> = ({ user, roles, statuses }) => {
  const roleInfo = getRoleInfo(user.role, roles);
  const statusInfo = getStatusInfo(user.status, statuses);
  const isActive = user.status === 'ACTIVE';
  // Real avatar URL (PMS-served), with cache-busting on updatedAt. Falls back to initials.
  const photoUrl = user.profilePictureUrl
    ? usersApi.profilePictureUrl(user.id, user.updatedAt ?? null)
    : null;

  return (
    // mb: 2 = 12 px ; p: 2 / 2.75 = 12 / 16,5 px (theme.spacing vaut 6).
    <Card className="relative mb-3 overflow-hidden rounded-lg border border-solid border-border bg-card">
      <CardContent className="p-3 min-[900px]:p-[16.5px]">
        <div className="flex items-start min-[900px]:items-center justify-between gap-3 flex-wrap">
          {/* Identity */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative shrink-0">
              <Avatar className="size-[60px] rounded-full">
                {photoUrl && <AvatarImage src={photoUrl} alt={`${user.firstName} ${user.lastName}`} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-[1.25rem] font-semibold tracking-[0.04em] font-[family-name:var(--font-display)]">
                  {`${user.firstName.charAt(0)}${user.lastName.charAt(0)}`}
                </AvatarFallback>
              </Avatar>
              {/* Tiny active dot — aplat de 12 px, donc la teinte vive et non `-ink`. */}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute bottom-0.5 end-0.5 size-3 rounded-full bg-success border-2 border-solid border-card"
                />
              )}
            </div>
            <div className="min-w-0">
              {/* `m-0` : sans preflight Tailwind, un <h5>/<p> natif reprend les
                  marges UA que neutralisait `cn-text-*`. */}
              <h5 className="m-0 text-[1.125rem] min-[900px]:text-[1.375rem] font-bold tracking-[-0.01em] text-foreground text-balance leading-[1.2]">
                {user.firstName} {user.lastName}
              </h5>
              <p className="m-0 mt-0.5 text-[0.8125rem] text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                {user.email}
              </p>
            </div>
          </div>

          {/* Chips */}
          <div className="flex gap-1 flex-wrap shrink-0">
            <StatusChip tone={SEM_TONE[roleInfo.color] ?? 'neutral'} label={roleInfo.label} icon={<span className="inline-flex">
                  {React.cloneElement(roleInfo.icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
                    size: 14,
                    strokeWidth: 1.75,
                  })}
                </span>} />
            <StatusChip tone={SEM_TONE[statusInfo.color] ?? 'neutral'} label={statusInfo.label} />
          </div>
        </div>

        {/* Meta row — replaces the 3-up centered KPI tiles. */}
        <div className="mt-3 pt-[9px] border-t border-solid border-border flex items-center gap-[9px] min-[600px]:gap-[18px] flex-wrap">
          <MetaItem
            icon={<MailIcon size={14} strokeWidth={1.75} />}
            value={user.email}
            href={`mailto:${user.email}`}
          />
          {user.phoneNumber && (
            <MetaItem
              icon={<PhoneIcon size={14} strokeWidth={1.75} />}
              value={user.phoneNumber}
              href={`tel:${user.phoneNumber}`}
            />
          )}
          {user.organizationName && (
            <MetaItem
              icon={<Business size={14} strokeWidth={1.75} />}
              value={user.organizationName}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const MetaItem: React.FC<{
  icon: React.ReactNode;
  value: string;
  href?: string;
}> = ({ icon, value, href }) => {
  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-[3.75px] text-xs text-muted-foreground min-w-0',
        'transition-colors duration-150 ease-out-quart motion-reduce:transition-none',
        href && 'hover:text-primary',
      )}
    >
      <span className="inline-flex text-muted-foreground opacity-60">
        {icon}
      </span>
      <span className="overflow-hidden text-ellipsis whitespace-nowrap max-w-[180px] min-[600px]:max-w-[240px] min-[900px]:max-w-[320px]">
        {value}
      </span>
    </span>
  );

  if (href) {
    return (
      <a className="no-underline" href={href}>
        {content}
      </a>
    );
  }
  return content;
};

export default UserProfileCard;
