import React from 'react';
import { Box, Typography, Checkbox } from '@mui/material';
import {
  Description,
  Checklist,
  Build,
  MoreHoriz,
} from '@mui/icons-material';

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

const VARIANT_CONFIG: Record<ConsigneVariant, VariantConfig> = {
  cleaning: {
    title: 'Consignes de ménage',
    icon: <Checklist sx={{ fontSize: 16, color: 'primary.main', mt: 0.125, flexShrink: 0 }} />,
    bgColor: 'primary.50',
    borderColor: 'primary.100',
    accentColor: 'primary.main',
  },
  maintenance: {
    title: 'Consignes de travaux',
    icon: <Build sx={{ fontSize: 16, color: '#ff9800', mt: 0.125, flexShrink: 0 }} />,
    bgColor: 'rgba(255,152,0,0.05)',
    borderColor: 'rgba(255,152,0,0.2)',
    accentColor: '#ff9800',
  },
  other: {
    title: 'Consignes diverses',
    icon: <MoreHoriz sx={{ fontSize: 16, color: '#78909c', mt: 0.125, flexShrink: 0 }} />,
    bgColor: 'grey.50',
    borderColor: 'grey.200',
    accentColor: '#78909c',
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
  borderRadius: 1.5,
  border: '1px solid',
  minHeight: 80,
} as const;

const TITLE_SX = {
  fontSize: '0.625rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  mb: 0.5,
} as const;

const TEXT_SX = {
  fontSize: '0.75rem',
  color: 'text.secondary',
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
          bgcolor: 'grey.50',
          borderColor: 'grey.200',
        }}>
          <Description sx={{ fontSize: 16, color: 'text.disabled', mt: 0.125, flexShrink: 0 }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ ...TITLE_SX, color: 'text.disabled' }}>
              Description du logement
            </Typography>
            {hasDescription ? (
              <Typography sx={TEXT_SX}>
                {description}
              </Typography>
            ) : (
              <Typography sx={{ ...TEXT_SX, fontStyle: 'italic', color: 'text.disabled' }}>
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
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          color: 'text.secondary',
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
                          color: 'grey.300',
                        }}
                      />
                      <Typography
                        sx={{
                          fontSize: '0.7rem',
                          color: 'text.secondary',
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
              <Typography sx={{ ...TEXT_SX, fontStyle: 'italic', color: 'text.disabled' }}>
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
