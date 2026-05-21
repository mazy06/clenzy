import React from 'react';
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { Mail as MailIcon, Phone as PhoneIcon, Business } from '../../../icons';
import { semanticToHex, softChipSx } from '../../../utils/statusUtils';
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
  const theme = useTheme();
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
        borderRadius: 2,
        borderColor: 'divider',
        overflow: 'hidden',
        position: 'relative',
        // Subtle brand wash on the background, anchored top-right — avoids the flat grey hero.
        backgroundImage: `radial-gradient(circle at top right, ${alpha(theme.palette.primary.main, 0.06)}, transparent 60%)`,
      }}
    >
      <CardContent sx={{ p: { xs: 2, md: 2.75 }, '&:last-child': { pb: { xs: 2, md: 2.75 } } }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          {/* Identity */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flex: 1 }}>
            <Box sx={{ position: 'relative', flexShrink: 0 }}>
              <Avatar
                src={photoUrl ?? undefined}
                sx={{
                  width: 60,
                  height: 60,
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: 'primary.contrastText',
                  // Brand gradient fallback when no photo is set.
                  backgroundImage: photoUrl
                    ? 'none'
                    : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.main, 0.75)} 100%)`,
                  letterSpacing: '0.04em',
                }}
              >
                {!photoUrl && `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`}
              </Avatar>
              {/* Tiny active dot — green pulse if status === ACTIVE. */}
              {isActive && (
                <Box
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    bottom: 2,
                    right: 2,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: '#22C55E',
                    border: '2px solid',
                    borderColor: 'background.paper',
                  }}
                />
              )}
            </Box>
            <Box sx={{ minWidth: 0 }}>
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
              <Typography
                sx={{
                  fontSize: '0.8125rem',
                  color: 'text.secondary',
                  mt: 0.25,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.email}
              </Typography>
            </Box>
          </Box>

          {/* Chips */}
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', flexShrink: 0 }}>
            <Chip
              icon={
                <Box component="span" sx={{ display: 'inline-flex' }}>
                  {React.cloneElement(roleInfo.icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
                    size: 14,
                    strokeWidth: 1.75,
                  })}
                </Box>
              }
              label={roleInfo.label}
              size="small"
              sx={softChipSx(semanticToHex(roleInfo.color))}
            />
            <Chip
              label={statusInfo.label}
              size="small"
              sx={softChipSx(semanticToHex(statusInfo.color))}
            />
          </Box>
        </Box>

        {/* Meta row — replaces the 3-up centered KPI tiles. */}
        <Box
          sx={{
            mt: 2,
            pt: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1.5, sm: 3 },
            flexWrap: 'wrap',
          }}
        >
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
        </Box>
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
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.625,
        fontSize: '0.75rem',
        color: 'text.secondary',
        minWidth: 0,
        transition: 'color 150ms ease',
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        '&:hover': href ? { color: 'primary.main' } : undefined,
      }}
    >
      <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled' }}>
        {icon}
      </Box>
      <Box
        component="span"
        sx={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: { xs: 180, sm: 240, md: 320 },
        }}
      >
        {value}
      </Box>
    </Box>
  );

  if (href) {
    return (
      <Box component="a" href={href} sx={{ textDecoration: 'none' }}>
        {content}
      </Box>
    );
  }
  return content;
};

export default UserProfileCard;
