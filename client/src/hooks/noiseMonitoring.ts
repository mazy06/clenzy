// Modele de domaine du monitoring sonore (capteurs Minut) : types partages et
// seuils d'alerte. Consomme par NoiseMonitorChart, NoiseDetail et
// useNoiseDeviceDetail, qui lisent les vraies mesures des capteurs.

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
