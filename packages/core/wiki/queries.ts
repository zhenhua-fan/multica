import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { CreateWikiDocumentRequest, UpdateWikiDocumentRequest, WikiSearchRequest } from '../types/wiki';

export const wikiKeys = {
  all: (channelId: string) => ['channels', channelId, 'wiki'] as const,
  list: (channelId: string, status?: string) => [...wikiKeys.all(channelId), 'documents', { status }] as const,
  detail: (channelId: string, docId: string) => [...wikiKeys.all(channelId), 'document', docId] as const,
  search: (channelId: string, query: string) => [...wikiKeys.all(channelId), 'search', query] as const,
};

export function wikiDocumentListOptions(channelId: string, status?: string) {
  return queryOptions({
    queryKey: wikiKeys.list(channelId, status),
    queryFn: () => api.listWikiDocuments(channelId, { status }).then((r) => r.data),
    enabled: !!channelId,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  });
}

export function wikiDocumentDetailOptions(channelId: string, docId: string) {
  return queryOptions({
    queryKey: wikiKeys.detail(channelId, docId),
    queryFn: () => api.getWikiDocument(channelId, docId).then((r) => r.data),
    enabled: !!channelId && !!docId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export function useCreateWikiDocument(channelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWikiDocumentRequest) => api.createWikiDocument(channelId, data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: wikiKeys.list(channelId) }); },
  });
}

export function useUpdateWikiDocument(channelId: string, docId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateWikiDocumentRequest) => api.updateWikiDocument(channelId, docId, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wikiKeys.list(channelId) });
      qc.invalidateQueries({ queryKey: wikiKeys.detail(channelId, docId) });
    },
  });
}

export function useArchiveWikiDocument(channelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) => api.archiveWikiDocument(channelId, docId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: wikiKeys.list(channelId) }); },
  });
}

export function useSearchWiki(channelId: string) {
  return useMutation({
    mutationFn: (data: WikiSearchRequest) => api.searchWiki(channelId, data).then((r) => r.data),
  });
}
