import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { notificationsApi, type Notification } from '@/api/endpoints/notificationsApi';
import { useNotificationStore } from '@/store/notificationStore';

const KEYS = {
  all: ['notifications'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
};

/** Fetch all notifications */
export function useNotifications() {
  return useQuery<Notification[]>({
    queryKey: KEYS.all,
    queryFn: () => notificationsApi.getAll(),
  });
}

/** Poll unread count every 30s and sync with Zustand store */
export function useUnreadCount() {
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  const query = useQuery({
    queryKey: KEYS.unreadCount,
    queryFn: () => notificationsApi.getUnreadCount(),
    refetchInterval: 30_000, // Poll every 30s
    staleTime: 10_000,
  });

  // Keep Zustand store in sync
  useEffect(() => {
    if (query.data?.count != null) {
      setUnreadCount(query.data.count);
    }
  }, [query.data?.count, setUnreadCount]);

  return query;
}

/** Mark a single notification as read (with optimistic update) */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  return useMutation({
    mutationFn: (id: number) => notificationsApi.markAsRead(id),

    // Optimistic update: instantly mark as read in the cache
    onMutate: async (id: number) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: KEYS.all });
      await queryClient.cancelQueries({ queryKey: KEYS.unreadCount });

      // Snapshot previous values for rollback
      const previousNotifications = queryClient.getQueryData<Notification[]>(KEYS.all);
      const previousUnread = queryClient.getQueryData<{ count: number }>(KEYS.unreadCount);

      // Optimistically update the notifications list
      if (previousNotifications) {
        queryClient.setQueryData<Notification[]>(KEYS.all, (old) =>
          (old ?? []).map((n) => (n.id === id ? { ...n, read: true } : n)),
        );
      }

      // Optimistically decrement unread count
      if (previousUnread && previousUnread.count > 0) {
        const newCount = previousUnread.count - 1;
        queryClient.setQueryData(KEYS.unreadCount, { count: newCount });
        setUnreadCount(newCount);
      }

      return { previousNotifications, previousUnread };
    },

    // Rollback on error
    onError: (_err, _id, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(KEYS.all, context.previousNotifications);
      }
      if (context?.previousUnread) {
        queryClient.setQueryData(KEYS.unreadCount, context.previousUnread);
        setUnreadCount(context.previousUnread.count);
      }
    },

    // Refetch after settle to ensure server state is in sync
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
      queryClient.invalidateQueries({ queryKey: KEYS.unreadCount });
    },
  });
}

/** Mark all notifications as read (with optimistic update) */
export function useMarkAllRead() {
  const queryClient = useQueryClient();
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  return useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),

    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: KEYS.all });
      await queryClient.cancelQueries({ queryKey: KEYS.unreadCount });

      const previousNotifications = queryClient.getQueryData<Notification[]>(KEYS.all);
      const previousUnread = queryClient.getQueryData<{ count: number }>(KEYS.unreadCount);

      // Optimistically mark all as read
      if (previousNotifications) {
        queryClient.setQueryData<Notification[]>(KEYS.all, (old) =>
          (old ?? []).map((n) => ({ ...n, read: true })),
        );
      }

      queryClient.setQueryData(KEYS.unreadCount, { count: 0 });
      setUnreadCount(0);

      return { previousNotifications, previousUnread };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(KEYS.all, context.previousNotifications);
      }
      if (context?.previousUnread) {
        queryClient.setQueryData(KEYS.unreadCount, context.previousUnread);
        setUnreadCount(context.previousUnread.count);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
      queryClient.invalidateQueries({ queryKey: KEYS.unreadCount });
    },
  });
}

/** Delete / dismiss a notification (with optimistic update) */
export function useDismissNotification() {
  const queryClient = useQueryClient();
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  return useMutation({
    mutationFn: (id: number) => notificationsApi.dismiss(id),

    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: KEYS.all });
      await queryClient.cancelQueries({ queryKey: KEYS.unreadCount });

      const previousNotifications = queryClient.getQueryData<Notification[]>(KEYS.all);
      const previousUnread = queryClient.getQueryData<{ count: number }>(KEYS.unreadCount);

      // Optimistically remove the notification
      const removed = previousNotifications?.find((n) => n.id === id);
      if (previousNotifications) {
        queryClient.setQueryData<Notification[]>(KEYS.all, (old) =>
          (old ?? []).filter((n) => n.id !== id),
        );
      }

      // Decrement unread count if the removed notification was unread
      if (removed && !removed.read && previousUnread && previousUnread.count > 0) {
        const newCount = previousUnread.count - 1;
        queryClient.setQueryData(KEYS.unreadCount, { count: newCount });
        setUnreadCount(newCount);
      }

      return { previousNotifications, previousUnread };
    },

    onError: (_err, _id, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(KEYS.all, context.previousNotifications);
      }
      if (context?.previousUnread) {
        queryClient.setQueryData(KEYS.unreadCount, context.previousUnread);
        setUnreadCount(context.previousUnread.count);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
      queryClient.invalidateQueries({ queryKey: KEYS.unreadCount });
    },
  });
}
