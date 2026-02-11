import apiClient from '../apiClient';
import { PaginatedResponse } from '../apiClient';

export interface ContactMessage {
  id: number;
  senderId: string;
  senderName?: string;
  recipientId: string;
  recipientName?: string;
  subject: string;
  message: string;
  priority: string;
  category: string;
  status: string;
  createdAt: string;
  attachments?: string[];
}

export interface ContactFormData {
  recipientId: string;
  subject: string;
  message: string;
  priority: string;
  category: string;
  attachments?: string[];
}

export interface Recipient {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  role: string;
}

export const contactApi = {
  /** Track whether the backend contact endpoints are available */
  _endpointAvailable: true,

  getRecipients() {
    if (!this._endpointAvailable) return Promise.resolve([] as Recipient[]);
    return apiClient.get<Recipient[]>('/contact/recipients').catch(() => {
      this._endpointAvailable = false;
      return [] as Recipient[];
    });
  },
  getMessages(type: 'inbox' | 'sent' | 'archived', params?: { page?: number; size?: number }) {
    if (!this._endpointAvailable) {
      return Promise.resolve({
        content: [], totalPages: 0, totalElements: 0, number: 0, size: params?.size ?? 10, first: true, last: true,
      } as PaginatedResponse<ContactMessage>);
    }
    return apiClient.get<PaginatedResponse<ContactMessage>>(`/contact/messages/${type}`, { params }).catch(() => {
      this._endpointAvailable = false;
      return {
        content: [], totalPages: 0, totalElements: 0, number: 0, size: params?.size ?? 10, first: true, last: true,
      } as PaginatedResponse<ContactMessage>;
    });
  },
  send(data: ContactFormData) {
    return apiClient.post<ContactMessage>('/contact/messages', data);
  },
  updateStatus(id: number, status: string) {
    return apiClient.put(`/contact/messages/${id}/status`, undefined, { params: { status } });
  },
  delete(id: number) {
    return apiClient.delete(`/contact/messages/${id}`);
  },
  bulkUpdateStatus(ids: number[], status: string) {
    return apiClient.put('/contact/messages/bulk/status', { ids, status });
  },
  bulkDelete(ids: number[]) {
    return apiClient.post('/contact/messages/bulk/delete', { ids });
  },
  archive(id: number) {
    return apiClient.put(`/contact/messages/${id}/archive`);
  },
  unarchive(id: number) {
    return apiClient.put(`/contact/messages/${id}/unarchive`);
  },
  reply(id: number, data: { message: string; attachments?: File[] }) {
    const formData = new FormData();
    formData.append('message', data.message);
    if (data.attachments) {
      data.attachments.forEach((file) => {
        formData.append('attachments', file);
      });
    }
    return apiClient.upload<ContactMessage>(`/contact/messages/${id}/reply`, formData);
  },
  /** Reset availability flag */
  resetAvailability() {
    this._endpointAvailable = true;
  },
};
