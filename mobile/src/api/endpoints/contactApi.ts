import { apiClient, PaginatedResponse } from '../apiClient';

/* ─── Types ─── */

export interface ContactAttachment {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  contentType: string;
}

export interface ContactMessage {
  id: number;
  senderId?: string;
  senderName?: string;
  recipientId?: string;
  recipientName?: string;
  subject: string;
  message: string;
  priority: string;
  category: string;
  status: string;
  createdAt: string;
  attachments?: ContactAttachment[];
  // Legacy fields (simple contact form fallback)
  name?: string;
  email?: string;
  response?: string;
}

export interface ContactFormData {
  recipientId: string;
  subject: string;
  message: string;
  priority: string;
  category: string;
}

export interface Recipient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

/* ─── API ─── */

export const contactApi = {
  /** List allowed recipients for the current user */
  getRecipients() {
    return apiClient.get<Recipient[]>('/contact/recipients');
  },

  /** Paginated inbox messages */
  getInbox(params?: { page?: number; size?: number }) {
    return apiClient.get<PaginatedResponse<ContactMessage>>('/contact/messages/inbox', {
      params: params as Record<string, string | number>,
    });
  },

  /** Paginated sent messages */
  getSent(params?: { page?: number; size?: number }) {
    return apiClient.get<PaginatedResponse<ContactMessage>>('/contact/messages/sent', {
      params: params as Record<string, string | number>,
    });
  },

  /** Send a new message */
  send(data: ContactFormData) {
    return apiClient.post<ContactMessage>('/contact/messages/json', data);
  },

  /** Reply to a message (with optional attachments) */
  reply(id: number, message: string, attachments?: { uri: string; name: string; type: string }[]) {
    const formData = new FormData();
    formData.append('message', message);
    if (attachments?.length) {
      attachments.forEach((file) => {
        formData.append('attachments', file as unknown as Blob);
      });
    }
    return apiClient.upload<ContactMessage>(`/contact/messages/${id}/reply`, formData);
  },

  /** Update message status */
  updateStatus(id: number, status: string) {
    return apiClient.put(`/contact/messages/${id}/status`, undefined, { params: { status } });
  },

  /** Archive a message */
  archive(id: number) {
    return apiClient.put(`/contact/messages/${id}/archive`);
  },

  /** Delete a message */
  delete(id: number) {
    return apiClient.delete(`/contact/messages/${id}`);
  },

  /** Get attachment as base64 data URI (for mobile image display) */
  getAttachmentBase64(messageId: number, attachmentId: string) {
    return apiClient.get<{
      data: string;       // data URI: "data:image/png;base64,..."
      contentType: string;
      originalName: string;
      size: number;
    }>(`/contact/messages/${messageId}/attachments/${attachmentId}/base64`);
  },

  // ── Legacy simple contact endpoints (fallback) ──

  /** Get simple contact messages (legacy) */
  getMessages() {
    return apiClient.get<ContactMessage[]>('/contact');
  },

  /** Send simple contact message (legacy) */
  sendMessage(data: Partial<ContactMessage>) {
    return apiClient.post('/contact', data);
  },
};
