import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  WeatherSun,
  WeatherCloudSun,
  WeatherCloud,
  WeatherRain,
  WeatherDrizzle,
  WeatherSnow,
  WeatherStorm,
  WeatherFog,
  WeatherDroplets,
} from '../../../icons';

interface WeatherItem {
  date: string;
  tempMax?: number | null;
  tempMin?: number | null;
  rain_mm?: number | null;
  conditionCode?: number | null;
  conditionLabel?: string;
}

interface WeatherData {
  title?: string;
  city?: string;
  countryCode?: string;
  days?: number;
  items?: WeatherItem[];
}

interface WeatherWidgetProps {
  data: WeatherData;
}

/**
 * Widget de rendu pour {@code displayHint="weather"} — previsions Open-Meteo.
 *
 * <p>Grille horizontale 1..7 jours, chaque jour rendu en colonne :
 * <ul>
 *   <li>Jour de la semaine + date courte</li>
 *   <li>Icone meteo (mappee depuis weathercode WMO)</li>
 *   <li>Temperature max (grand) / min (petit)</li>
 *   <li>Precipitations en mm si > 0</li>
 * </ul>
 *
 * <p>Borderless, bg tonal, scroll horizontal sur mobile si necessaire.</p>
 */
export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ data }) => {
  const items = data.items ?? [];

  if (items.length === 0) {
    return (
      <Box sx={{ mt: 1, mb: 1.5 }}>
        <Box sx={{
          p: 2, borderRadius: '12px',
          bgcolor: 'var(--warn-soft)',
          textAlign: 'center',
        }}>
          <Typography sx={{ fontSize: '12.5px', color: 'var(--warn)' }}>
            Aucune donnee meteo disponible.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 1, mb: 1.5 }}>
      {data.title && (
        <Typography sx={{
          display: 'block', mb: 0.75, fontSize: '10.5px', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '.05em',
          color: 'var(--faint)',
        }}>
          {data.title}
        </Typography>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(4, minmax(72px, 1fr))', sm: `repeat(${items.length}, minmax(72px, 1fr))` },
          gap: 0.75,
          overflowX: 'auto',
          // Scrollbar discrete
          '&::-webkit-scrollbar': { height: 4 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'var(--line-2)',
            borderRadius: 2,
          },
        }}
      >
        {items.map((item) => (
          <WeatherDayTile key={item.date} item={item} />
        ))}
      </Box>
    </Box>
  );
};

const WeatherDayTile: React.FC<{ item: WeatherItem }> = ({ item }) => {
  const Icon = iconFromCode(item.conditionCode);
  const rain = item.rain_mm ?? 0;
  const tMax = item.tempMax;
  const tMin = item.tempMin;

  return (
    <Box
      sx={{
        px: 0.75, py: 1,
        borderRadius: '10px',
        border: '1px solid var(--line)',
        bgcolor: 'var(--card)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.4,
        minWidth: 0,
        textAlign: 'center',
      }}
    >
      <Typography sx={{
        fontSize: '10.5px', fontWeight: 700,
        textTransform: 'uppercase',
        color: 'var(--faint)',
        letterSpacing: '.05em',
      }}>
        {formatDay(item.date)}
      </Typography>
      <Typography sx={{
        fontSize: '10.5px', color: 'var(--faint)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {formatDate(item.date)}
      </Typography>
      <Box sx={{
        color: iconColor(item.conditionCode),
        display: 'inline-flex', my: 0.25,
      }}>
        <Icon size={22} />
      </Box>
      {tMax !== undefined && tMax !== null && (
        <Typography sx={{
          fontFamily: 'var(--font-display)',
          fontSize: '0.95rem', fontWeight: 600,
          color: 'var(--ink)',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}>
          {Math.round(tMax)}°
        </Typography>
      )}
      {tMin !== undefined && tMin !== null && (
        <Typography sx={{
          fontSize: '11px',
          color: 'var(--muted)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {Math.round(tMin)}°
        </Typography>
      )}
      {rain > 0.1 && (
        <Box sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.25,
          mt: 0.25,
          color: 'var(--info)',
        }}>
          <WeatherDroplets size={10} />
          <Typography sx={{
            fontSize: '10.5px',
            color: 'inherit',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {rain.toFixed(1)}mm
          </Typography>
        </Box>
      )}
    </Box>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

type WeatherIcon = typeof WeatherSun;

/**
 * Map WMO weather code → icone Lucide. Codes documentes par Open-Meteo :
 * https://open-meteo.com/en/docs (table "Weather variable documentation").
 */
function iconFromCode(code: number | null | undefined): WeatherIcon {
  if (code == null) return WeatherCloud;
  if (code === 0) return WeatherSun;
  if (code === 1 || code === 2) return WeatherCloudSun;
  if (code === 3) return WeatherCloud;
  if (code === 45 || code === 48) return WeatherFog;
  if (code >= 51 && code <= 57) return WeatherDrizzle;
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return WeatherRain;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return WeatherSnow;
  if (code === 95 || code === 96 || code === 99) return WeatherStorm;
  return WeatherCloud;
}

function iconColor(code: number | null | undefined): string {
  if (code == null) return 'var(--faint)';
  if (code === 0) return '#D4A574'; // soleil — accent ambre Baitly (palette validee)
  if (code >= 95 && code <= 99) return 'var(--warn)';
  if (code >= 61 && code <= 82) return 'var(--info)';
  if (code >= 71 && code <= 86) return 'var(--info)';
  return 'var(--muted)';
}

function formatDay(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
  } catch {
    return '';
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  } catch {
    return iso;
  }
}
