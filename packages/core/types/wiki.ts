export type WikiDocumentStatus = 'processing' | 'indexed' | 'archived' | 'failed';

export interface WikiDocument {
  id: string;
  channel_id: string;
  title: string;
  content: string;
  content_type: string;
  status: WikiDocumentStatus;
  source_url: string;
  token_count: number;
  chunk_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WikiSearchResult {
  chunk_id: string;
  document_id: string;
  document_title: string;
  content: string;
  chunk_index: number;
  similarity: number;
  token_count: number;
}

export interface CreateWikiDocumentRequest {
  title: string;
  content: string;
  content_type?: string;
  source_url?: string;
}

export interface UpdateWikiDocumentRequest {
  title?: string;
  content?: string;
  status?: WikiDocumentStatus;
}

export interface WikiSearchRequest {
  query: string;
  top_k?: number;
  threshold?: number;
}

export interface WikiDocumentListResponse { success: boolean; data: WikiDocument[]; }
export interface WikiDocumentResponse { success: boolean; data: WikiDocument; }
export interface WikiSearchResponse { success: boolean; data: { results: WikiSearchResult[]; total: number; }; }
