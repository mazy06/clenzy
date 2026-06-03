/**
 * Modèle de données UNIFIÉ pour le Hub des objets connectés.
 *
 * Les 3 domaines existants (serrures, capteurs sonores, points de remise de clés)
 * exposent des DTO différents. On les projette ici sur un seul type `ConnectedDevice`
 * pour pouvoir les afficher avec une seule carte et les grouper par logement —
 * sans toucher au backend (Phase 0). Les caméras / thermostats sont déclarés comme
 * types « à venir » pour réserver leur place dans l'UI.
 */

export type DeviceKind = 'lock' | 'noise' | 'keybox' | 'camera' | 'thermostat';

/** Niveau d'état normalisé : pilote la pastille de couleur (vert/ambre/rouge/gris). */
export type DeviceStatusLevel = 'ok' | 'warning' | 'critical' | 'offline' | 'unknown';

/** Fournisseur d'origine de l'objet (sert au filtrage + au bandeau de connexion). */
export type DeviceProvider =
  | 'NUKI' | 'TUYA' | 'TTLOCK' | 'YALE'
  | 'MINUT'
  | 'KEYNEST' | 'CLENZY_KEYVAULT'
  | 'UNKNOWN';

/** Action rapide proposée sur une carte d'objet. */
export type DeviceAction = 'lock' | 'unlock' | 'view' | 'acknowledge';

export interface ConnectedDevice {
  /** Identifiant unique tous types confondus : `${kind}:${id}`. */
  uid: string;
  kind: DeviceKind;
  id: number;
  name: string;
  propertyId: number | null;
  propertyName: string;
  roomName: string | null;
  provider: DeviceProvider;
  /** Niveau d'état normalisé (couleur de la pastille). */
  statusLevel: DeviceStatusLevel;
  /** Libellé d'état lisible (« Verrouillée », « 42 dB », « En ligne »…). */
  statusLabel: string;
  /** Métrique principale optionnelle affichée sur la carte (batterie, codes actifs…). */
  primaryMetric?: { label: string; value: string } | null;
  battery?: number | null;
  online: boolean;
  /** Nombre d'alertes actives liées à l'objet. */
  alertCount?: number;
  /** Actions rapides disponibles (résolues par le registre de type). */
  actions: DeviceAction[];
  /** DTO d'origine, pour les actions (lock/unlock par id, navigation…). */
  raw: unknown;
}

/** Un logement et ses objets connectés (axe principal de l'UI : par logement). */
export interface PropertyDeviceGroup {
  propertyId: number | null;
  propertyName: string;
  devices: ConnectedDevice[];
}

/** État d'un service tiers (bandeau de connexion en haut du Hub). */
export interface ProviderConnection {
  provider: DeviceProvider;
  label: string;
  connected: boolean;
  deviceCount: number | null;
}

/** KPIs agrégés affichés en haut du Hub. */
export interface ConnectedObjectsKpis {
  total: number;
  online: number;
  offline: number;
  alerts: number;
  lowBattery: number;
}
