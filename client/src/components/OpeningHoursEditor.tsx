import React, { useCallback } from 'react';
import {
  Box,
  Chip,
  TextField,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import { ContentCopy as CopyIcon } from '@mui/icons-material';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DayKey = 'lun' | 'mar' | 'mer' | 'jeu' | 'ven' | 'sam' | 'dim';

export interface DaySchedule {
  open: string;
  close: string;
}

export type OpeningHoursMap = Record<DayKey, DaySchedule | null>;

const DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: 'lun', label: 'Lundi', short: 'Lun' },
  { key: 'mar', label: 'Mardi', short: 'Mar' },
  { key: 'mer', label: 'Mercredi', short: 'Mer' },
  { key: 'jeu', label: 'Jeudi', short: 'Jeu' },
  { key: 'ven', label: 'Vendredi', short: 'Ven' },
  { key: 'sam', label: 'Samedi', short: 'Sam' },
  { key: 'dim', label: 'Dimanche', short: 'Dim' },
];

const DEFAULT_SCHEDULE: DaySchedule = { open: '09:00', close: '19:00' };

// ─── Helpers (exported for reuse) ────────────────────────────────────────────

export const EMPTY_HOURS: OpeningHoursMap = {
  lun: null, mar: null, mer: null, jeu: null, ven: null, sam: null, dim: null,
};

export function serializeOpeningHours(map: OpeningHoursMap): string {
  return JSON.stringify(map);
}

export function parseOpeningHours(str: string | null | undefined): OpeningHoursMap {
  if (!str) return { ...EMPTY_HOURS };
  try {
    const parsed = JSON.parse(str);
    if (typeof parsed === 'object' && parsed !== null && 'lun' in parsed) {
      return parsed as OpeningHoursMap;
    }
    return { ...EMPTY_HOURS };
  } catch {
    return { ...EMPTY_HOURS };
  }
}

/**
 * Format structured opening hours for human-readable display.
 * Groups consecutive days with identical schedules.
 * e.g. "Lun-Ven: 9h-19h, Sam: 10h-13h"
 */
export function formatOpeningHoursDisplay(str: string | null | undefined): string {
  if (!str) return '';

  // Try parsing as JSON
  let map: OpeningHoursMap;
  try {
    const parsed = JSON.parse(str);
    if (typeof parsed !== 'object' || parsed === null || !('lun' in parsed)) {
      return str; // Fallback: return raw text
    }
    map = parsed as OpeningHoursMap;
  } catch {
    return str; // Fallback: return raw text for legacy data
  }

  const formatTime = (t: string) => {
    const [h, m] = t.split(':');
    return m === '00' ? `${parseInt(h)}h` : `${parseInt(h)}h${m}`;
  };

  // Build groups of consecutive days with same schedule
  type Group = { days: DayKey[]; schedule: DaySchedule };
  const groups: Group[] = [];

  for (const day of DAYS) {
    const sched = map[day.key];
    if (!sched) continue;

    const last = groups[groups.length - 1];
    if (last && last.schedule.open === sched.open && last.schedule.close === sched.close) {
      last.days.push(day.key);
    } else {
      groups.push({ days: [day.key], schedule: { ...sched } });
    }
  }

  if (groups.length === 0) return '';

  const dayLabel = (key: DayKey) => DAYS.find(d => d.key === key)!.short;

  return groups.map(g => {
    const timeStr = `${formatTime(g.schedule.open)}-${formatTime(g.schedule.close)}`;
    if (g.days.length === 1) {
      return `${dayLabel(g.days[0])}: ${timeStr}`;
    }
    return `${dayLabel(g.days[0])}-${dayLabel(g.days[g.days.length - 1])}: ${timeStr}`;
  }).join(', ');
}

// ─── Component ───────────────────────────────────────────────────────────────

interface OpeningHoursEditorProps {
  value: OpeningHoursMap;
  onChange: (value: OpeningHoursMap) => void;
  label?: string;
}

export function OpeningHoursEditor({
  value,
  onChange,
  label = "Horaires d'ouverture",
}: OpeningHoursEditorProps) {

  const toggleDay = useCallback((day: DayKey) => {
    const updated = { ...value };
    if (updated[day]) {
      updated[day] = null;
    } else {
      updated[day] = { ...DEFAULT_SCHEDULE };
    }
    onChange(updated);
  }, [value, onChange]);

  const updateDayTime = useCallback((day: DayKey, field: 'open' | 'close', time: string) => {
    const updated = { ...value };
    const current = updated[day];
    if (current) {
      updated[day] = { ...current, [field]: time };
      onChange(updated);
    }
  }, [value, onChange]);

  // Copy the first active day's schedule to all other active days
  const copyToAll = useCallback(() => {
    const firstActive = DAYS.find(d => value[d.key] !== null);
    if (!firstActive) return;
    const sourceSchedule = value[firstActive.key]!;
    const updated = { ...value };
    for (const day of DAYS) {
      if (updated[day.key] !== null) {
        updated[day.key] = { ...sourceSchedule };
      }
    }
    onChange(updated);
  }, [value, onChange]);

  const activeDays = DAYS.filter(d => value[d.key] !== null);
  const hasMultipleActive = activeDays.length > 1;

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {label}
      </Typography>

      {/* Day chips */}
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
        {DAYS.map(day => {
          const isActive = value[day.key] !== null;
          return (
            <Chip
              key={day.key}
              label={day.short}
              size="small"
              variant={isActive ? 'filled' : 'outlined'}
              color={isActive ? 'primary' : 'default'}
              onClick={() => toggleDay(day.key)}
              sx={{
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                minWidth: 44,
              }}
            />
          );
        })}
      </Box>

      {/* Time inputs for active days */}
      {activeDays.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {activeDays.map((day, idx) => {
            const sched = value[day.key]!;
            return (
              <Box
                key={day.key}
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <Typography
                  variant="body2"
                  sx={{ minWidth: 32, fontSize: '0.8rem', color: 'text.secondary', fontWeight: 500 }}
                >
                  {day.short}
                </Typography>
                <TextField
                  type="time"
                  size="small"
                  value={sched.open}
                  onChange={(e) => updateDayTime(day.key, 'open', e.target.value)}
                  inputProps={{ step: 300 }}
                  sx={{ width: 120, '& input': { fontSize: '0.8rem', py: 0.6 } }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                  —
                </Typography>
                <TextField
                  type="time"
                  size="small"
                  value={sched.close}
                  onChange={(e) => updateDayTime(day.key, 'close', e.target.value)}
                  inputProps={{ step: 300 }}
                  sx={{ width: 120, '& input': { fontSize: '0.8rem', py: 0.6 } }}
                />
                {/* Show copy button on the first active day row only */}
                {idx === 0 && hasMultipleActive && (
                  <Tooltip title="Appliquer ces horaires aux autres jours" arrow>
                    <IconButton size="small" onClick={copyToAll} sx={{ ml: 0.5 }}>
                      <CopyIcon sx={{ fontSize: '1rem' }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
