import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { channelConnectionApi, CHANNEL_BACKEND_MAP } from '../services/api/channelConnectionApi';
import type { ChannelId, ChannelConnectRequest, ChannelConnectionStatus } from '../services/api/channelConnectionApi';
import { useCallback } from 'react';

// ─── Query keys ──────────────────────────────────────────────────────────────

export const channelConnectionKeys = {
  all: ['channel-connections'] as const,
  byChannel: (channel: string) => [...channelConnectionKeys.all, channel] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Fetch all active channel connections for the organization.
 */
export function useChannelConnections() {
  const query = useQuery({
    queryKey: channelConnectionKeys.all,
    queryFn: () => channelConnectionApi.getAll(),
    staleTime: 30_000,
  });

  /** Check if a frontend channel ID is connected */
  const isConnected = useCallback(
    (channelId: ChannelId): boolean => {
      if (!query.data) return false;
      const backendChannel = CHANNEL_BACKEND_MAP[channelId];
      return query.data.some((c) => c.channel === backendChannel && c.connected);
    },
    [query.data],
  );

  /** Get connection status for a frontend channel ID */
  const getStatus = useCallback(
    (channelId: ChannelId): ChannelConnectionStatus | undefined => {
      if (!query.data) return undefined;
      const backendChannel = CHANNEL_BACKEND_MAP[channelId];
      return query.data.find((c) => c.channel === backendChannel);
    },
    [query.data],
  );

  return {
    ...query,
    isConnected,
    getStatus,
  };
}

/**
 * Connect a channel with credentials.
 */
export function useConnectChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ channelId, request }: { channelId: ChannelId; request: ChannelConnectRequest }) => {
      const backendChannel = CHANNEL_BACKEND_MAP[channelId];
      return channelConnectionApi.connect(backendChannel, request);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelConnectionKeys.all });
    },
  });
}

/**
 * Disconnect a channel.
 */
export function useDisconnectChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (channelId: ChannelId) => {
      const backendChannel = CHANNEL_BACKEND_MAP[channelId];
      return channelConnectionApi.disconnect(backendChannel);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelConnectionKeys.all });
    },
  });
}

/**
 * Test channel credentials without saving.
 */
export function useTestChannelConnection() {
  return useMutation({
    mutationFn: ({ channelId, request }: { channelId: ChannelId; request: ChannelConnectRequest }) => {
      const backendChannel = CHANNEL_BACKEND_MAP[channelId];
      return channelConnectionApi.test(backendChannel, request);
    },
  });
}
