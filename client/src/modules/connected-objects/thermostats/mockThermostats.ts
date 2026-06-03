/**
 * Données SIMULÉES pour l'aperçu thermostats (Phase 2, UI-first).
 *
 * Aucun thermostat réel n'existe encore côté backend. Ces données servent à
 * concevoir l'UX du Hub thermostats avant de brancher un provider (Netatmo /
 * Tado / Ecobee / Tuya climate) et l'entité backend correspondante.
 */
export type ThermostatMode = 'heat' | 'cool' | 'eco' | 'off';

export interface MockThermostat {
  id: number;
  name: string;
  roomName: string;
  propertyId: number;
  propertyName: string;
  brand: string;
  online: boolean;
  /** Température mesurée (°C). */
  currentTemp: number;
  /** Consigne (°C). */
  targetTemp: number;
  /** Humidité relative (%). */
  humidity: number;
  mode: ThermostatMode;
  /** Préréglage actif (« Confort », « Éco », « Hors-gel »…). */
  preset: string;
}

export const MOCK_THERMOSTATS: MockThermostat[] = [
  { id: 1, name: 'Séjour', roomName: 'Salon', propertyId: 101, propertyName: 'Appartement Bellecour', brand: 'Netatmo', online: true, currentTemp: 21.5, targetTemp: 22, humidity: 46, mode: 'heat', preset: 'Confort' },
  { id: 2, name: 'Chambre', roomName: 'Chambre principale', propertyId: 101, propertyName: 'Appartement Bellecour', brand: 'Tado', online: true, currentTemp: 19.2, targetTemp: 19, humidity: 52, mode: 'eco', preset: 'Éco' },
  { id: 3, name: 'Bureau', roomName: 'Bureau', propertyId: 102, propertyName: 'Studio Croix-Rousse', brand: 'Ecobee', online: true, currentTemp: 24.1, targetTemp: 21.5, humidity: 41, mode: 'cool', preset: 'Confort' },
  { id: 4, name: 'Entrée', roomName: 'Couloir', propertyId: 102, propertyName: 'Studio Croix-Rousse', brand: 'Netatmo', online: false, currentTemp: 17.8, targetTemp: 16, humidity: 58, mode: 'off', preset: 'Hors-gel' },
];
