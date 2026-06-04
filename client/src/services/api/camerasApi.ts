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
  /** URL RTSP source (avec credentials) — chiffree cote backend, jamais re-exposee. */
  rtspUrl: string;
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
};
