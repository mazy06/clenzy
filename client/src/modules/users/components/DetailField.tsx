import React, { useState } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { ContentCopy, Check } from '../../../icons';

interface DetailFieldProps {
  /** Small uppercase label rendered above the value (Baitly product register). */
  label: string;
  /** Primary value. Falls back to em-dash when empty. */
  value?: React.ReactNode;
  /** Optional value used for copy-to-clipboard. Defaults to `value` when it's a string. */
  copyValue?: string;
  /** Optional inline icon next to the label. */
  icon?: React.ReactNode;
  /** Optional href to render the value as an `<a>` (mailto / tel / external). */
  href?: string;
  /** Tone for the value text. Default = primary text. */
  tone?: 'default' | 'muted';
  /** Use tabular-nums (dates, ids, phone). */
  monospace?: boolean;
}

/**
 * One labeled field. Used inside `DetailSection` for consistent typography across the
 * user details page (and reusable elsewhere).
 *
 * Notes:
 * - Avoids the "centered KPI tile" template — left-aligned, single column.
 * - Optional copy button gives an inline action without a modal-first reflex.
 */
const DetailField: React.FC<DetailFieldProps> = ({
  label,
  value,
  copyValue,
  icon,
  href,
  tone = 'default',
  monospace = false,
}) => {
  const [copied, setCopied] = useState(false);
  const isEmpty = value === undefined || value === null || value === '';

  const copyableString = copyValue ?? (typeof value === 'string' ? value : undefined);
  const canCopy = !!copyableString && !isEmpty;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!copyableString) return;
    try {
      await navigator.clipboard.writeText(copyableString);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  const valueColor = isEmpty
    ? 'text.disabled'
    : tone === 'muted'
      ? 'text.secondary'
      : 'text.primary';

  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        {icon && (
          <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled' }}>
            {icon}
          </Box>
        )}
        <Typography
          variant="caption"
          sx={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'text.secondary',
          }}
        >
          {label}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
        <Typography
          component={href && !isEmpty ? 'a' : 'span'}
          href={href && !isEmpty ? href : undefined}
          sx={{
            fontSize: '0.875rem',
            fontWeight: 500,
            color: valueColor,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontVariantNumeric: monospace ? 'tabular-nums' : undefined,
            textDecoration: href && !isEmpty ? 'none' : undefined,
            transition: 'color 150ms ease',
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            ...(href && !isEmpty && {
              '&:hover': { color: 'var(--accent)', textDecoration: 'underline' },
            }),
          }}
        >
          {isEmpty ? '—' : value}
        </Typography>
        {canCopy && (
          <Tooltip title={copied ? 'Copié' : 'Copier'} arrow>
            <IconButton
              size="small"
              onClick={handleCopy}
              sx={{ p: 0.25, color: copied ? 'var(--ok)' : 'text.disabled' }}
              aria-label={copied ? 'Copié' : `Copier ${label}`}
            >
              {copied ? (
                <Check size={14} strokeWidth={2} />
              ) : (
                <ContentCopy size={13} strokeWidth={1.75} />
              )}
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};

export default DetailField;
