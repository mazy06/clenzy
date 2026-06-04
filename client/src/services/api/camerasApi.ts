import apiClient from '../apiClient';

// ─── Types (backend /api/cameras) ────────────────────────────────────────────

export interface CameraDto {
  id: number;
  name: string;
  propertyId: number;
  propertyName: string | null;
  roomName: string | null;
  brand: string | null;
  status: string;
  online: boolean;
  recording: boolean;
  streamName: string;
  /** URL de lecture WebRTC (passerelle go2rtc). Null tant que non configuree. */
  webrtcUrl: string | null;
  /** URL d'une image fixe du flux (poster affiché avant lecture). Null tant que non configuree. */
  snapshotUrl: string | null;
  createdAt: string;
}

export interface CreateCameraDto {
  name: string;
  propertyId: number;
  roomName?: string;
  brand?: string;
  /** URL RTSP/HTTP source (avec credentials) — chiffree cote backend. Requis sauf Tuya. */
  rtspUrl?: string;
  /** device_id Tuya (brand=TUYA) — le flux est alloue a la demande via le cloud Tuya. */
  externalDeviceId?: string;
}

// ─── Cameras API ─────────────────────────────────────────────────────────────

export const camerasApi = {
  getAll() {
    return apiClient.get<CameraDto[]>('/cameras');
  },
  create(data: CreateCameraDto) {
    return apiClient.post<CameraDto>('/cameras', data);
  },
  delete(id: number) {
    return apiClient.delete(`/cameras/${id}`);
  },
  /** Re-alloue/re-enregistre le flux (sources Tuya à URL temporaire). */
  refreshStream(id: number) {
    return apiClient.post(`/cameras/${id}/refresh-stream`, {});
  },
};
