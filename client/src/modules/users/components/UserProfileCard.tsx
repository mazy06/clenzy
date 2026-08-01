import React from 'react';
import StatusChip from '../../../components/StatusChip';
import { Avatar, Card, CardContent, Typography } from '@mui/material';
import { cn } from '../../../utils/cn';
import { Mail as MailIcon, Phone as PhoneIcon, Business } from '../../../icons';
import { semanticToHex } from '../../../utils/statusUtils';
import type { ChipColor } from '../../../types';

// Couleur semantique → tokens (chips -soft : texte couleur + fond -soft)
const SEM_TOKEN: Partial<Record<ChipColor, { fg: string; bg: string }>> = {
  success: { fg: 'var(--ok)', bg: 'var(--ok-soft)' },
  warning: { fg: 'var(--warn)', bg: 'var(--warn-soft)' },
  error: { fg: 'var(--err)', bg: 'var(--err-soft)' },
  info: { fg: 'var(--info)', bg: 'var(--info-soft)' },
  primary: { fg: 'var(--accent)', bg: 'var(--accent-soft)' },
};

const NEUTRAL_TOKEN = { fg: 'var(--muted)', bg: 'var(--hover)' };
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
 *   <li>Avatar uses a brand gradient instead of a flat fill (no glassmorphism, no neon).</li>
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
    <Card
      variant="outlined"
      sx={{
        mb: 2,
        borderRadius: 'var(--radius-lg)',
        bgcolor: 'var(--card)',
        borderColor: 'var(--line)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <CardContent sx={{ p: { xs: 2, md: 2.75 }, '&:last-child': { pb: { xs: 2, md: 2.75 } } }}>
        <div className="flex items-start min-[900px]:items-center justify-between gap-3 flex-wrap">
          {/* Identity */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative shrink-0">
              <Avatar
                src={photoUrl ?? undefined}
                sx={{
                  width: 60,
                  height: 60,
                  fontSize: '1.25rem',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  color: 'var(--on-accent)',
                  bgcolor: photoUrl ? 'transparent' : 'var(--accent)',
                  letterSpacing: '0.04em',
                }}
              >
                {!photoUrl && `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`}
              </Avatar>
              {/* Tiny active dot — green pulse if status === ACTIVE. */}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-[var(--ok)] border-2 border-solid border-[var(--card)]"
                />
              )}
            </div>
            <div className="min-w-0">
              <Typography
                variant="h5"
                sx={{
                  fontSize: { xs: '1.125rem', md: '1.375rem' },
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  color: 'text.primary',
                  textWrap: 'balance',
                  lineHeight: 1.2,
                }}
              >
                {user.firstName} {user.lastName}
              </Typography>
              <p className="cn-text-body1 text-[0.8125rem] text-muted-foreground mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
                {user.email}
              </p>
            </div>
          </div>

          {/* Chips */}
          <div className="flex gap-1 flex-wrap shrink-0">
            <StatusChip tokens={{ color: semanticToHex(roleInfo.color), bg: `${semanticToHex(roleInfo.color)}18` }} label={roleInfo.label} icon={<span className="inline-flex">
                  {React.cloneElement(roleInfo.icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
                    size: 14,
                    strokeWidth: 1.75,
                  })}
                </span>} />
            <StatusChip tokens={{ color: (SEM_TOKEN[statusInfo.color] ?? NEUTRAL_TOKEN).fg, bg: (SEM_TOKEN[statusInfo.color] ?? NEUTRAL_TOKEN).bg }} label={statusInfo.label} />
          </div>
        </div>

        {/* Meta row — replaces the 3-up centered KPI tiles. */}
        <div className="mt-3 pt-[9px] border-t border-solid border-[var(--line)] flex items-center gap-[9px] min-[600px]:gap-[18px] flex-wrap">
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
        'inline-flex items-center gap-[3.75px] text-[0.75rem] text-[var(--muted)] min-w-0',
        'transition-colors duration-150 ease-[ease] motion-reduce:transition-none',
        href && 'hover:text-[var(--accent)]',
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
