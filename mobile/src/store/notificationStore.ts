import { create } from 'zustand';

interface NotificationState {
  unreadCount: number;
  fcmToken: string | null;
  setFcmToken: (token: string | null) => void;
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  resetUnread: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  fcmToken: null,

  setFcmToken: (token) => set({ fcmToken: token }),
  setUnreadCount: (count) => set({ unreadCount: count }),
  incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
  resetUnread: () => set({ unreadCount: 0 }),
}));
