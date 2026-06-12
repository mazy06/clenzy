import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  WhatsApp as WhatsAppIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  Hub as AirbnbIcon,
  Hotel as BookingIcon,
  Forum as ForumIcon,
  Search as SearchIcon,
} from '../../../../icons';
import type { ConversationDto } from '../../../../services/api/conversationApi';
import { conversationTitle } from '../../../channels/channelConfig';

/**
 * Visuels partagés des listes de conversations du hub Messagerie
 * (volets « Messages archivés » et « Messagerie OTA ») — format `.mg-conv`
 * de la référence Signature : avatar 44 r13 + pastille canal 18px,
 * nom/heure, propriété en accent, aperçu du dernier message.
 *
 * Tokens var(--…) uniquement (cf. theme/signature/tokens.css). Les couleurs
 * de pastille canal viennent de la référence : whatsapp #25A36F,
 * email var(--info) #7BA3C2, sms var(--warn) #C28A52.
 */

// ─── Pastille canal (.mg-chn) ────────────────────────────────────────────────

/** Couleur WhatsApp de la référence (« --wa ») — pas de token global dédié. */
const WA_COLOR = '#25A36F';

const CHANNEL_DOTS: Record<string, { color: string; icon: React.ReactNode }> = {
  WHATSAPP: { color: WA_COLOR, icon: <WhatsAppIcon size={10} /> },
  EMAIL: { color: 'var(--info)', icon: <EmailIcon size={10} strokeWidth={2.5} /> },
  SMS: { color: 'var(--warn)', icon: <SmsIcon size={10} strokeWidth={2.5} /> },
  AIRBNB: { color: 'var(--airbnb)', icon: <AirbnbIcon size={10} strokeWidth={2.5} /> },
  BOOKING: { color: 'var(--booking)', icon: <BookingIcon size={10} strokeWidth={2.5} /> },
};

export function getChannelDot(channel: string): { color: string; icon: React.ReactNode } {
  return CHANNEL_DOTS[channel] ?? { color: 'var(--faint)', icon: <ForumIcon size={10} strokeWidth={2.5} /> };
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

/** Palette d'avatars de la référence (teintes désaturées Signature). */
const AVATAR_PALETTE = ['#5F7E8C', '#C28A52', '#7BA3C2', '#4A9B8E', '#9A7FA3', '#4A6B9A'];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// ─── Heure compacte de la liste ──────────────────────────────────────────────

/** « 09:42 » si aujourd'hui, « Hier », sinon « 04 juin ». */
export function formatConvTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

// ─── Recherche (.mg-search) ──────────────────────────────────────────────────

export function SigSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '9px',
        height: 38,
        px: '13px',
        bgcolor: 'var(--field)',
        border: '1px solid var(--field-line)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--faint)',
      }}
    >
      <SearchIcon size={15} strokeWidth={1.75} />
      <Box
        component="input"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        sx={{
          border: 0,
          outline: 0,
          background: 'none',
          fontFamily: 'inherit',
          fontSize: 'var(--text-sm)',
          color: 'var(--body)',
          width: '100%',
          '&::placeholder': { color: 'var(--faint)' },
        }}
      />
    </Box>
  );
}

// ─── Élément de liste (.mg-conv) ─────────────────────────────────────────────

interface SigConvItemProps {
  conv: ConversationDto;
  active?: boolean;
  onClick?: () => void;
  /** Action de droite (ex. « Rouvrir » des archives) — remplace le badge non-lu. */
  trailing?: React.ReactNode;
}

export function SigConvItem({ conv, active = false, onClick, trailing }: SigConvItemProps) {
  const dot = getChannelDot(conv.channel);
  const name = conv.guestName ?? conversationTitle(conv);
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        gap: '12px',
        p: '13px 16px',
        borderBottom: '1px solid var(--line)',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        transition: 'background var(--duration-fast)',
        bgcolor: active ? 'var(--accent-soft)' : 'transparent',
        '&:hover': { bgcolor: active ? 'var(--accent-soft)' : 'var(--hover)' },
        ...(active && {
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            bgcolor: 'var(--accent)',
          },
        }),
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: '13px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-display)',
          fontWeight: 'var(--fw-semibold)',
          fontSize: 15,
          color: '#fff',
          position: 'relative',
          bgcolor: avatarColor(name),
        }}
      >
        {initials(name)}
        <Box
          sx={{
            position: 'absolute',
            bottom: -3,
            right: -3,
            width: 18,
            height: 18,
            borderRadius: '7px',
            border: '2px solid var(--card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: dot.color,
            color: '#fff',
          }}
        >
          {dot.icon}
        </Box>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Typography
            sx={{
              fontSize: '13.5px',
              fontWeight: 'var(--fw-semibold)',
              color: 'var(--ink)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {name}
          </Typography>
          <Typography
            sx={{
              ml: 'auto',
              fontSize: 'var(--text-2xs)',
              color: 'var(--faint)',
              flexShrink: 0,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatConvTime(conv.lastMessageAt)}
          </Typography>
        </Box>
        {conv.propertyName && (
          <Typography
            sx={{
              fontSize: '11px',
              color: 'var(--accent)',
              fontWeight: 'var(--fw-semibold)',
              m: '2px 0 3px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {conv.propertyName}
          </Typography>
        )}
        <Typography
          sx={{
            fontSize: '12px',
            color: 'var(--muted)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {conv.lastMessagePreview || '—'}
        </Typography>
      </Box>
      {trailing}
      {conv.unread && !trailing && (
        <Box
          sx={{
            position: 'absolute',
            right: 16,
            bottom: 16,
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor: 'var(--accent)',
          }}
        />
      )}
    </Box>
  );
}
