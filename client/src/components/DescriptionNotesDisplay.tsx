import React from 'react';
import { Box, Typography, Checkbox } from '@mui/material';
import {
  Description,
  Checklist,
  Build,
  MoreHoriz,
} from '../icons';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ConsigneVariant = 'cleaning' | 'maintenance' | 'other';

export interface DescriptionNotesDisplayProps {
  /** Property description text */
  description?: string;
  /** Cleaning/maintenance notes text (line-separated, * prefix = checklist item) */
  notes?: string;
  /** Controls the consigne title & accent color */
  variant?: ConsigneVariant;
}

// ─── Variant config ─────────────────────────────────────────────────────────

interface VariantConfig {
  title: string;
  icon: React.ReactElement;
  bgColor: string;
  borderColor: string;
  accentColor: string;
}

// Tuiles sémantiques Signature : fond -soft + hairline color-mix + texte couleur
const VARIANT_CONFIG: Record<ConsigneVariant, VariantConfig> = {
  cleaning: {
    title: 'Consignes de ménage',
    icon: <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)', mt: 0.125, flexShrink: 0 }}><Checklist size={16} strokeWidth={1.75} /></Box>,
    bgColor: 'var(--accent-soft)',
    borderColor: 'color-mix(in srgb, var(--accent) 25%, transparent)',
    accentColor: 'var(--accent)',
  },
  maintenance: {
    title: 'Consignes de travaux',
    icon: <Box component="span" sx={{ display: 'inline-flex', color: 'var(--warn)', mt: 0.125, flexShrink: 0 }}><Build size={16} strokeWidth={1.75} /></Box>,
    bgColor: 'var(--warn-soft)',
    borderColor: 'color-mix(in srgb, var(--warn) 25%, transparent)',
    accentColor: 'var(--warn)',
  },
  other: {
    title: 'Consignes diverses',
    icon: <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)', mt: 0.125, flexShrink: 0 }}><MoreHoriz size={16} strokeWidth={1.75} /></Box>,
    bgColor: 'var(--surface-2)',
    borderColor: 'var(--line)',
    accentColor: 'var(--muted)',
  },
};

// ─── Parse notes into checklist items ───────────────────────────────────────

interface ChecklistItem {
  text: string;
  isTitle: boolean;
}

function parseNotes(notes: string): ChecklistItem[] {
  return notes
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const isTitle = line.startsWith('**') && line.endsWith('**');
      const text = line
        .replace(/^\s*\*\s*/, '')     // Remove leading * bullet
        .replace(/^\*\*|\*\*$/g, '') // Remove bold markers
        .trim();
      return { text, isTitle };
    })
    .filter(item => item.text.length > 0);
}

// ─── Shared box sx ──────────────────────────────────────────────────────────

const BOX_BASE_SX = {
  flex: 1,
  display: 'flex',
  gap: 1,
  py: 1.25,
  px: 1.5,
  borderRadius: '12px',
  border: '1px solid',
  minHeight: 80,
} as const;

const TITLE_SX = {
  fontSize: '10.5px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  mb: 0.5,
} as const;

const TEXT_SX = {
  fontSize: '11.5px',
  color: 'var(--muted)',
  lineHeight: 1.4,
  whiteSpace: 'pre-line',
} as const;

// ─── Component ──────────────────────────────────────────────────────────────

const DescriptionNotesDisplay: React.FC<DescriptionNotesDisplayProps> = React.memo(
  ({ description, notes, variant = 'cleaning' }) => {
    const config = VARIANT_CONFIG[variant];
    const items = notes ? parseNotes(notes) : [];

    const hasDescription = !!description;
    const hasNotes = items.length > 0;

    return (
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        {/* Description du logement */}
        <Box sx={{
          ...BOX_BASE_SX,
          bgcolor: 'var(--surface-2)',
          borderColor: 'var(--line)',
        }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'var(--faint)', mt: 0.125, flexShrink: 0 }}><Description size={16} strokeWidth={1.75} /></Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ ...TITLE_SX, color: 'var(--faint)' }}>
              Description du logement
            </Typography>
            {hasDescription ? (
              <Typography sx={TEXT_SX}>
                {description}
              </Typography>
            ) : (
              <Typography sx={{ ...TEXT_SX, fontStyle: 'italic', color: 'var(--faint)' }}>
                Aucune description renseignée
              </Typography>
            )}
          </Box>
        </Box>

        {/* Consignes — variant-driven */}
        <Box sx={{
          ...BOX_BASE_SX,
          bgcolor: config.bgColor,
          borderColor: config.borderColor,
        }}>
          {config.icon}
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ ...TITLE_SX, color: config.accentColor }}>
              {config.title}
            </Typography>

            {hasNotes ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {items.map((item, i) => {
                  if (item.isTitle) {
                    return (
                      <Typography
                        key={i}
                        sx={{
                          fontSize: '11.5px',
                          fontWeight: 700,
                          color: 'var(--body)',
                          mt: i > 0 ? 0.75 : 0,
                          mb: 0.25,
                        }}
                      >
                        {item.text}
                      </Typography>
                    );
                  }

                  return (
                    <Box
                      key={i}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 0.25,
                        py: 0.125,
                      }}
                    >
                      <Checkbox
                        checked={false}
                        disabled
                        size="small"
                        sx={{
                          p: 0.25,
                          mt: -0.125,
                          color: 'var(--line-2)',
                        }}
                      />
                      <Typography
                        sx={{
                          fontSize: '11.5px',
                          color: 'var(--muted)',
                          lineHeight: 1.4,
                          flex: 1,
                          pt: 0.25,
                        }}
                      >
                        {item.text}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            ) : (
              <Typography sx={{ ...TEXT_SX, fontStyle: 'italic', color: 'var(--faint)' }}>
                Aucune consigne renseignée
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    );
  }
);

DescriptionNotesDisplay.displayName = 'DescriptionNotesDisplay';

export default DescriptionNotesDisplay;
