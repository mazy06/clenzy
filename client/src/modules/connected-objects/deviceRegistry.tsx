import React from 'react';
import { Lock, VolumeUp, VpnKey, PhotoCamera, Thermostat, SensorDoor, DirectionsWalk, SmokeFree, WeatherDroplets } from '../../icons';
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
    available: true, // CRUD dispo ; flux live via go2rtc (a venir)
    icon: (s = 16) => <PhotoCamera size={s} strokeWidth={1.75} />,
  },
  thermostat: {
    kind: 'thermostat',
    label: 'Thermostats',
    singular: 'Thermostat',
    color: '#6B8A9A', // primary Baitly
    available: true, // CRUD + pilotage Tuya
    icon: (s = 16) => <Thermostat size={s} strokeWidth={1.75} />,
  },
  climate: {
    kind: 'climate',
    label: 'Temp./Humidité',
    singular: 'Capteur temp./humidité',
    color: '#7BA3C2', // bleu Baitly
    available: true, // CRUD + lecture Tuya
    icon: (s = 16) => <WeatherDroplets size={s} strokeWidth={1.75} />,
  },
  contact: {
    kind: 'contact',
    label: 'Porte/Fenêtre',
    singular: 'Capteur porte/fenêtre',
    color: '#6B8A9A', // primary Baitly
    available: true, // CRUD + lecture Tuya
    icon: (s = 16) => <SensorDoor size={s} strokeWidth={1.75} />,
  },
  motion: {
    kind: 'motion',
    label: 'Mouvement',
    singular: 'Capteur de mouvement',
    color: '#4A9B8E', // vert Baitly
    available: true, // CRUD + lecture Tuya + alertes
    icon: (s = 16) => <DirectionsWalk size={s} strokeWidth={1.75} />,
  },
  smoke: {
    kind: 'smoke',
    label: 'Fumée/Vape',
    singular: 'Détecteur fumée/vape',
    color: '#C97A7A', // argile Baitly (danger)
    available: true, // CRUD + lecture Tuya + alertes
    icon: (s = 16) => <SmokeFree size={s} strokeWidth={1.75} />,
  },
};

export const DEVICE_KIND_ORDER: DeviceKind[] = [
  'lock', 'noise', 'keybox', 'camera', 'thermostat', 'climate', 'contact', 'motion', 'smoke',
];

/**
 * Tokens des niveaux d'état (le seul endroit où la couleur porte un sens).
 *
 * <p>Sémantique Baitly UI : le niveau se résout à l'EXÉCUTION, une classe
 * Tailwind ne peut donc pas en naître — on garde des valeurs CSS pointant les
 * variables `--bui-*`. Le triplet respecte la règle du couple accessible :
 * `color` est le jeton `-ink` (≥ 4,5:1, réservé au TEXTE), `soft` le fond
 * pastel, `dot` la teinte vive réservée aux aplats décoratifs (pastille, jauge)
 * qui ne sont pas soumis au contraste de texte.</p>
 *
 * <p>Niveaux : en ligne = succès, attention = avertissement, alerte =
 * destructif, hors ligne / inconnu = neutre.</p>
 */
export const STATUS_TOKENS: Record<DeviceStatusLevel, { color: string; soft: string; dot: string }> = {
  ok: { color: 'var(--bui-success-ink)', soft: 'var(--bui-success-soft)', dot: 'var(--bui-success)' },
  warning: { color: 'var(--bui-warning-ink)', soft: 'var(--bui-warning-soft)', dot: 'var(--bui-warning)' },
  critical: { color: 'var(--bui-destructive-ink)', soft: 'var(--bui-destructive-soft)', dot: 'var(--bui-destructive)' },
  offline: { color: 'var(--bui-muted-foreground)', soft: 'var(--bui-muted)', dot: 'var(--bui-muted-foreground)' },
  unknown: { color: 'var(--bui-muted-foreground)', soft: 'var(--bui-muted)', dot: 'var(--bui-muted-foreground)' },
};
