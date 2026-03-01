export interface Notification {
  id: number;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: 'intervention' | 'service_request' | 'payment' | 'system' | 'team' | 'contact' | 'document';
  notificationKey?: string;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

export interface UnreadCountResponse {
  count: number;
}
