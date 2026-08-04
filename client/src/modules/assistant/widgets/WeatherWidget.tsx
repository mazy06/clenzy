import React from 'react';
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
        <div className="p-3 rounded-xl bg-warning-soft text-center">
          <p className="text-xs text-warning-ink">
            Aucune donnee meteo disponible.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1.5 mb-2">
      {data.title && (
        <p className="block mb-1 text-2xs font-bold uppercase tracking-[.05em] text-faint">
          {data.title}
        </p>
      )}

      {/* Le nombre de colonnes depend des donnees : custom property, la rupture
          sm (600px MUI) reste une variante statique. Scrollbar discrete. */}
      <div
        className="grid grid-cols-[repeat(4,_minmax(72px,_1fr))] min-[600px]:grid-cols-[var(--wx-cols)] gap-[4.5px] overflow-x-auto [&::-webkit-scrollbar]:h-[4px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
        style={{ '--wx-cols': `repeat(${items.length}, minmax(72px, 1fr))` } as React.CSSProperties}
      >
        {items.map((item) => (
          <WeatherDayTile key={item.date} item={item} />
        ))}
      </div>
    </div>
  );
};

const WeatherDayTile: React.FC<{ item: WeatherItem }> = ({ item }) => {
  const Icon = iconFromCode(item.conditionCode);
  const rain = item.rain_mm ?? 0;
  const tMax = item.tempMax;
  const tMin = item.tempMin;

  return (
    <div className="px-1 py-1.5 rounded-lg border border-border bg-card flex flex-col items-center gap-0.5 min-w-0 text-center">
      <p className="text-2xs font-bold uppercase text-faint tracking-[.05em]">
        {formatDay(item.date)}
      </p>
      <p className="text-2xs text-faint tabular-nums">
        {formatDate(item.date)}
      </p>
      <div className="inline-flex my-[1.5px]" style={{ color: iconColor(item.conditionCode) }}>
        <Icon size={22} />
      </div>
      {tMax !== undefined && tMax !== null && (
        <p className="text-[0.95rem] font-semibold text-foreground tabular-nums leading-[1]">
          {Math.round(tMax)}°
        </p>
      )}
      {tMin !== undefined && tMin !== null && (
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {Math.round(tMin)}°
        </p>
      )}
      {rain > 0.1 && (
        <div className="inline-flex items-center gap-0.5 mt-0.5 text-info-ink">
          <WeatherDroplets size={10} />
          <p className="text-2xs text-inherit tabular-nums">
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
  if (code == null) return 'var(--color-faint)';
  if (code === 0) return '#D4A574'; // soleil — accent ambre Baitly (palette validee)
  if (code >= 95 && code <= 99) return 'var(--color-warning-ink)';
  if (code >= 61 && code <= 82) return 'var(--color-info-ink)';
  if (code >= 71 && code <= 86) return 'var(--color-info-ink)';
  return 'var(--color-muted-foreground)';
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
