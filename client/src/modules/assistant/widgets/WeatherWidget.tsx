import React from 'react';
import { Box } from '@mui/material';
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
      <div className="mt-1.5 mb-2">
        <div className="p-3 rounded-[12px] bg-[var(--warn-soft)] text-center">
          <p className="cn-text-body1 text-[12.5px] text-[var(--warn)]">
            Aucune donnee meteo disponible.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1.5 mb-2">
      {data.title && (
        <p className="cn-text-body1 block mb-1 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)]">
          {data.title}
        </p>
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
    </div>
  );
};

const WeatherDayTile: React.FC<{ item: WeatherItem }> = ({ item }) => {
  const Icon = iconFromCode(item.conditionCode);
  const rain = item.rain_mm ?? 0;
  const tMax = item.tempMax;
  const tMin = item.tempMin;

  return (
    <div className="px-1 py-1.5 rounded-[10px] border border-[var(--line)] bg-[var(--card)] flex flex-col items-center gap-0.5 min-w-0 text-center">
      <p className="cn-text-body1 text-[10.5px] font-bold uppercase text-[var(--faint)] tracking-[.05em]">
        {formatDay(item.date)}
      </p>
      <p className="cn-text-body1 text-[10.5px] text-[var(--faint)] tabular-nums">
        {formatDate(item.date)}
      </p>
      <div className="inline-flex my-[1.5px]" style={{ color: iconColor(item.conditionCode) }}>
        <Icon size={22} />
      </div>
      {tMax !== undefined && tMax !== null && (
        <p className="cn-text-body1 font-[var(--font-display)] text-[0.95rem] font-semibold text-[var(--ink)] tabular-nums leading-[1]">
          {Math.round(tMax)}°
        </p>
      )}
      {tMin !== undefined && tMin !== null && (
        <p className="cn-text-body1 text-[11px] text-[var(--muted)] tabular-nums">
          {Math.round(tMin)}°
        </p>
      )}
      {rain > 0.1 && (
        <div className="inline-flex items-center gap-0.5 mt-0.5 text-[var(--info)]">
          <WeatherDroplets size={10} />
          <p className="cn-text-body1 text-[10.5px] text-inherit tabular-nums">
            {rain.toFixed(1)}mm
          </p>
        </div>
      )}
    </div>
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
