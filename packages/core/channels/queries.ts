import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { CreateChannelRequest, UpdateChannelRequest, AddMemberRequest, UpdateMemberRoleRequest } from '../types';

export const channelKeys = {
  all: (wsId: string) => ['workspaces', wsId, 'channels'] as const,
  list: (wsId: string) => [...channelKeys.all(wsId), 'list'] as const,
  detail: (wsId: string, channelId: string) => [...channelKeys.all(wsId), 'detail', channelId] as const,
  members: (wsId: string, channelId: string) => [...channelKeys.all(wsId), 'members', channelId] as const,
};

export function channelListOptions(wsId: string) {
  return queryOptions({
    queryKey: channelKeys.list(wsId),
    queryFn: () => api.listChannels().then((r) => r.data),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export function channelDetailOptions(wsId: string, channelId: string) {
  return queryOptions({
    queryKey: channelKeys.detail(wsId, channelId),
    queryFn: () => api.getChannel(channelId).then((r) => r.data),
    enabled: !!channelId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export function channelMemberListOptions(wsId: string, channelId: string) {
  return queryOptions({
    queryKey: channelKeys.members(wsId, channelId),
    queryFn: () => api.listChannelMembers(channelId).then((r) => r.data),
    enabled: !!channelId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export function useCreateChannel(wsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateChannelRequest) => api.createChannel(data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: channelKeys.list(wsId) });
    },
  });
}

export function useUpdateChannel(wsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ channelId, data }: { channelId: string; data: UpdateChannelRequest }) =>
      api.updateChannel(channelId, data).then((r) => r.data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: channelKeys.list(wsId) });
      qc.invalidateQueries({ queryKey: channelKeys.detail(wsId, variables.channelId) });
    },
  });
}

export function useArchiveChannel(wsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channelId: string) => api.archiveChannel(channelId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: channelKeys.list(wsId) });
    },
  });
}

export function useAddChannelMember(wsId: string, channelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AddMemberRequest) => api.addChannelMember(channelId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: channelKeys.members(wsId, channelId) });
    },
  });
}

export function useUpdateChannelMember(wsId: string, channelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, data }: { memberId: string; data: UpdateMemberRoleRequest }) =>
      api.updateChannelMember(channelId, memberId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: channelKeys.members(wsId, channelId) });
    },
  });
}

export function useRemoveChannelMember(wsId: string, channelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => api.removeChannelMember(channelId, memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: channelKeys.members(wsId, channelId) });
    },
  });
}
