import { useState, useEffect, useMemo, useCallback } from 'react';
import storageService, { STORAGE_KEYS } from '../services/storageService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NoiseDataPoint {
  time: string;       // ex: "08:00", "08:30"
  decibels: number;   // dB level
  property: string;   // property name
}

export interface NoiseAlert {
  id: string;
  propertyName: string;
  timestamp: string;
  level: number;       // dB
  severity: 'warning' | 'critical';
  message: string;
}

export interface PropertyNoiseData {
  propertyId: number;
  propertyName: string;
  currentLevel: number;
  averageLevel: number;
  maxLevel: number;
  history: NoiseDataPoint[];
  alerts: NoiseAlert[];
}

export interface NoiseMonitoringData {
  enabled: boolean;
  properties: PropertyNoiseData[];
  allAlerts: NoiseAlert[];
  globalAverage: number;
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

export const NOISE_THRESHOLDS = {
  normal: 50,      // ≤ 50 dB = normal
  warning: 70,     // 50-70 dB = elevated
  critical: 85,    // > 85 dB = critical alert
} as const;

// ─── Mock data generator ──────────────────────────────────────────────────────

export function generateMockNoiseHistory(propertyName: string, baseLevel: number, hoursBack: number = 24): NoiseDataPoint[] {
  const points: NoiseDataPoint[] = [];
  const now = new Date();

  for (let i = hoursBack * 2; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 30 * 60 * 1000);
    const hour = time.getHours();

    // Simulate realistic noise patterns
    let noise = baseLevel;

    // Night time (22h-7h): quieter
    if (hour >= 22 || hour < 7) {
      noise = baseLevel - 15 + Math.random() * 10;
    }
    // Morning (7h-9h): moderate activity
    else if (hour >= 7 && hour < 9) {
      noise = baseLevel + Math.random() * 15;
    }
    // Day (9h-18h): normal
    else if (hour >= 9 && hour < 18) {
      noise = baseLevel + Math.random() * 10 - 5;
    }
    // Evening (18h-22h): social activity — louder
    else {
      noise = baseLevel + 5 + Math.random() * 20;
    }

    // Random spikes (party simulation)
    if (Math.random() < 0.03) {
      noise += 20 + Math.random() * 15;
    }

    points.push({
      time: `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`,
      decibels: Math.round(Math.max(25, Math.min(100, noise))),
      property: propertyName,
    });
  }

  return points;
}

export function generateMockAlerts(propertyName: string, history: NoiseDataPoint[]): NoiseAlert[] {
  const alerts: NoiseAlert[] = [];
  const now = new Date();

  history.forEach((point, idx) => {
    if (point.decibels >= NOISE_THRESHOLDS.critical) {
      alerts.push({
        id: `alert-${propertyName}-${idx}`,
        propertyName,
        timestamp: new Date(now.getTime() - (history.length - idx) * 30 * 60 * 1000).toISOString(),
        level: point.decibels,
        severity: 'critical',
        message: `Niveau sonore critique (${point.decibels} dB) - Intervention recommandée`,
      });
    } else if (point.decibels >= NOISE_THRESHOLDS.warning) {
      alerts.push({
        id: `alert-${propertyName}-${idx}`,
        propertyName,
        timestamp: new Date(now.getTime() - (history.length - idx) * 30 * 60 * 1000).toISOString(),
        level: point.decibels,
        severity: 'warning',
        message: `Niveau sonore élevé (${point.decibels} dB) - Surveillance accrue`,
      });
    }
  });

  // Keep only the latest 5 alerts
  return alerts.slice(-5);
}

function generateMockData(): NoiseMonitoringData {
  const properties: PropertyNoiseData[] = [
    { propertyId: 1, propertyName: 'Appartement Haussmann', baseLevel: 42 },
    { propertyId: 2, propertyName: 'Studio Marais', baseLevel: 48 },
    { propertyId: 3, propertyName: 'Loft Bastille', baseLevel: 45 },
  ].map(({ propertyId, propertyName, baseLevel }) => {
    const history = generateMockNoiseHistory(propertyName, baseLevel);
    const alerts = generateMockAlerts(propertyName, history);
    const levels = history.map(h => h.decibels);

    return {
      propertyId,
      propertyName,
      currentLevel: levels[levels.length - 1] || 0,
      averageLevel: Math.round(levels.reduce((a, b) => a + b, 0) / levels.length),
      maxLevel: Math.max(...levels),
      history,
      alerts,
    };
  });

  const allAlerts = properties
    .flatMap(p => p.alerts)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  const globalAverage = Math.round(
    properties.reduce((sum, p) => sum + p.averageLevel, 0) / properties.length
  );

  return {
    enabled: true,
    properties,
    allAlerts,
    globalAverage,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNoiseMonitoring() {
  const [enabled, setEnabledState] = useState(
    () => localStorage.getItem(STORAGE_KEYS.NOISE_MONITORING_MOCK) === 'true'
  );

  const [data, setData] = useState<NoiseMonitoringData | null>(null);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    storageService.setItem(STORAGE_KEYS.NOISE_MONITORING_MOCK, value ? 'true' : 'false');
  }, []);

  // Generate mock data when enabled
  useEffect(() => {
    if (enabled) {
      setData(generateMockData());

      // Refresh data every 5 minutes to simulate real-time updates
      const interval = setInterval(() => {
        setData(generateMockData());
      }, 5 * 60 * 1000);

      return () => clearInterval(interval);
    } else {
      setData(null);
    }
  }, [enabled]);

  // Merged chart data for all properties (for the combined chart)
  const combinedChartData = useMemo(() => {
    if (!data) return [];

    // Use the first property's history as the time axis, merge others
    const firstProp = data.properties[0];
    if (!firstProp) return [];

    return firstProp.history.map((point, idx) => {
      const entry: Record<string, string | number> = { time: point.time };
      data.properties.forEach(prop => {
        entry[prop.propertyName] = prop.history[idx]?.decibels || 0;
      });
      return entry;
    });
  }, [data]);

  return {
    enabled,
    setEnabled,
    data,
    combinedChartData,
    thresholds: NOISE_THRESHOLDS,
  };
}
