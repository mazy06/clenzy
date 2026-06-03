/**
 * Données SIMULÉES pour l'aperçu caméras (Phase 2, UI-first).
 *
 * Aucune caméra réelle n'existe encore côté backend (streaming greenfield). Ces
 * données servent uniquement à concevoir et valider l'UX du Hub caméras avant de
 * brancher la passerelle média (go2rtc / MediaMTX) et l'entité Camera backend.
 */
export interface MockCamera {
  id: number;
  name: string;
  roomName: string;
  propertyId: number;
  propertyName: string;
  /** Marque du fabricant (affichage seul). */
  brand: string;
  online: boolean;
  /** Enregistrement en cours (pastille REC). */
  recording: boolean;
  /** Libellé du dernier instantané (« il y a 2 min »). */
  lastSnapshotLabel: string;
}

export const MOCK_CAMERAS: MockCamera[] = [
  { id: 1, name: 'Entrée principale', roomName: 'Hall', propertyId: 101, propertyName: 'Appartement Bellecour', brand: 'Reolink', online: true, recording: true, lastSnapshotLabel: 'il y a 1 min' },
  { id: 2, name: 'Séjour', roomName: 'Salon', propertyId: 101, propertyName: 'Appartement Bellecour', brand: 'Tapo', online: true, recording: false, lastSnapshotLabel: 'il y a 3 min' },
  { id: 3, name: 'Parking', roomName: 'Extérieur', propertyId: 101, propertyName: 'Appartement Bellecour', brand: 'Ubiquiti', online: false, recording: false, lastSnapshotLabel: 'il y a 2 h' },
  { id: 4, name: 'Porte d\'entrée', roomName: 'Porche', propertyId: 102, propertyName: 'Studio Croix-Rousse', brand: 'Reolink', online: true, recording: true, lastSnapshotLabel: "à l'instant" },
  { id: 5, name: 'Cour intérieure', roomName: 'Extérieur', propertyId: 102, propertyName: 'Studio Croix-Rousse', brand: 'Tapo', online: true, recording: false, lastSnapshotLabel: 'il y a 5 min' },
];
