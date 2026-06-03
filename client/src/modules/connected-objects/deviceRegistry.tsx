import React from 'react';
import { Lock, VolumeUp, VpnKey, PhotoCamera, Thermostat } from '../../icons';
import type { DeviceKind, DeviceStatusLevel } from './types';

/**
 * Registre des TYPES d'objets connectés. Source unique pour l'icône, le libellé,
 * la couleur d'accent (palette Baitly validée) et la disponibilité. Ajouter un
 * type = ajouter une entrée ici (les caméras/thermostats sont déjà « réservés »
 * mais marqués non disponibles → tuiles « Bientôt »).
 */
export interface DeviceKindMeta {
  kind: DeviceKind;
  /** Pluriel pour les sections / filtres (« Serrures »). */
  label: string;
  /** Singulier (« Serrure connectée »). */
  singular: string;
  /** Couleur d'accent — uniquement dans la palette Baitly validée. */
  color: string;
  /** Disponible aujourd'hui (false = tuile « Bientôt »). */
  available: boolean;
  /** Fabrique l'icône lucide à la taille demandée. */
  icon: (size?: number) => React.ReactNode;
}

export const DEVICE_KINDS: Record<DeviceKind, DeviceKindMeta> = {
  lock: {
    kind: 'lock',
    label: 'Serrures',
    singular: 'Serrure connectée',
    color: '#7BA3C2', // bleu Baitly
    available: true,
    icon: (s = 16) => <Lock size={s} strokeWidth={1.75} />,
  },
  noise: {
    kind: 'noise',
    label: 'Capteurs sonores',
    singular: 'Capteur de bruit',
    color: '#4A9B8E', // vert Baitly
    available: true,
    icon: (s = 16) => <VolumeUp size={s} strokeWidth={1.75} />,
  },
  keybox: {
    kind: 'keybox',
    label: 'Remise des clés',
    singular: 'Point de remise',
    color: '#D4A574', // doré Baitly
    available: true,
    icon: (s = 16) => <VpnKey size={s} strokeWidth={1.75} />,
  },
  camera: {
    kind: 'camera',
    label: 'Caméras',
    singular: 'Caméra',
    color: '#C97A7A', // argile Baitly
    available: false, // Phase 2 (streaming greenfield)
    icon: (s = 16) => <PhotoCamera size={s} strokeWidth={1.75} />,
  },
  thermostat: {
    kind: 'thermostat',
    label: 'Thermostats',
    singular: 'Thermostat',
    color: '#6B8A9A', // primary Baitly
    available: false, // Phase 2
    icon: (s = 16) => <Thermostat size={s} strokeWidth={1.75} />,
  },
};

export const DEVICE_KIND_ORDER: DeviceKind[] = ['lock', 'noise', 'keybox', 'camera', 'thermostat'];

/** Couleurs des niveaux d'état (le seul endroit où la couleur porte un sens). */
export const STATUS_COLORS: Record<DeviceStatusLevel, string> = {
  ok: '#4A9B8E',       // vert — en ligne / OK
  warning: '#D4A574',  // ambre — batterie faible / attention
  critical: '#C97A7A', // rouge argile — alerte / critique
  offline: '#9CA3AF',  // gris — hors ligne
  unknown: '#9CA3AF',  // gris — inconnu
};

export const STATUS_LABELS: Record<DeviceStatusLevel, string> = {
  ok: 'En ligne',
  warning: 'Attention',
  critical: 'Alerte',
  offline: 'Hors ligne',
  unknown: 'Inconnu',
};
