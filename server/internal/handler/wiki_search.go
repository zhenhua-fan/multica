package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/redis/go-redis/v9"

	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

// ---------------------------------------------------------------------------
// Wiki Search types
// ---------------------------------------------------------------------------

// WikiSearchRequest is the request body for semantic search.
type WikiSearchRequest struct {
	Query     string  `json:"query"`
	TopK      int     `json:"top_k,omitempty"`
	Threshold float64 `json:"threshold,omitempty"`
}

// WikiSearchResponse is the API response for semantic search results.
type WikiSearchResponse struct {
	Results []WikiSearchResult `json:"results"`
	Total   int                `json:"total"`
}

// WikiSearchResult is a single matching wiki chunk.
type WikiSearchResult struct {
	ChunkID        string  `json:"chunk_id"`
	DocumentID     string  `json:"document_id"`
	DocumentTitle  string  `json:"document_title"`
	Content        string  `json:"content"`
	Similarity     float64 `json:"similarity"`
	ChunkIndex     int32   `json:"chunk_index"`
}

// ---------------------------------------------------------------------------
// EmbeddingService (interface)
// ---------------------------------------------------------------------------

// EmbeddingService abstracts the embedding provider (OpenAI, local model, etc.).
// The concrete implementation is injected at startup so the handler stays
// testable and swappable.
type EmbeddingService interface {
	// EmbedText returns the embedding vector for a single text.
	EmbedText(ctx context.Context, text string) ([]float32, error)
}

// NoopEmbeddingService is a stub used in tests and when no embedding provider
// is configured.
type NoopEmbeddingService struct{}

func (n NoopEmbeddingService) EmbedText(_ context.Context, _ string) ([]float32, error) {
	return nil, fmt.Errorf("no embedding service configured")
}

// ---------------------------------------------------------------------------
// WikiSearchCache (Redis-backed)
// ---------------------------------------------------------------------------

// WikiSearchCache caches semantic search results keyed by (channel_id, query_hash).
// TTL is short (5 min) because wiki documents can be updated.
type WikiSearchCache struct {
	rdb *redis.Client
	ttl time.Duration
}

// NewWikiSearchCache returns nil when rdb is nil (cache disabled).
func NewWikiSearchCache(rdb *redis.Client) *WikiSearchCache {
	if rdb == nil {
		return nil
	}
	return &WikiSearchCache{rdb: rdb, ttl: 5 * time.Minute}
}

func (c *WikiSearchCache) key(channelID, queryHash string) string {
	return "wiki:search:" + channelID + ":" + queryHash
}

func (c *WikiSearchCache) Get(ctx context.Context, channelID, queryHash string) ([]WikiSearchResult, bool) {
	if c == nil {
		return nil, false
	}
	data, err := c.rdb.Get(ctx, c.key(channelID, queryHash)).Bytes()
	if err != nil {
		return nil, false
	}
	var results []WikiSearchResult
	if err := json.Unmarshal(data, &results); err != nil {
		return nil, false
	}
	return results, true
}

func (c *WikiSearchCache) Set(ctx context.Context, channelID, queryHash string, results []WikiSearchResult) {
	if c == nil || len(results) == 0 {
		return
	}
	data, err := json.Marshal(results)
	if err != nil {
		return
	}
	if err := c.rdb.Set(ctx, c.key(channelID, queryHash), data, c.ttl).Err(); err != nil {
		slog.Warn("wiki search cache set failed", "error", err)
	}
}

// ---------------------------------------------------------------------------
// WikiSearch handler
// ---------------------------------------------------------------------------

// WikiSearch handles POST /api/channels/{channelId}/wiki/search
//
// Flow:
//  1. Validate channel_id from URL path
//  2. Parse request (query, top_k=5, threshold=0.7 defaults)
//  3. Check Redis cache
//  4. Call EmbeddingService to vectorize the query
//  5. Execute pgvector similarity search via SearchWikiChunks
//  6. Cache results, return response
func (h *Handler) WikiSearch(w http.ResponseWriter, r *http.Request) {
	channelID := chi.URLParam(r, "channelId")
	if channelID == "" {
		writeError(w, http.StatusBadRequest, "channel_id is required")
		return
	}
	channelUUID, ok := parseUUIDOrBadRequest(w, channelID, "channel id")
	if !ok {
		return
	}

	var req WikiSearchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Query == "" {
		writeError(w, http.StatusBadRequest, "query is required")
		return
	}

	// Apply defaults.
	if req.TopK <= 0 {
		req.TopK = 5
	}
	if req.TopK > 50 {
		req.TopK = 50 // cap at 50
	}
	if req.Threshold <= 0 {
		req.Threshold = 0.7
	}

	// Check cache (keyed by channel + query).
	queryHash := hashQuery(req.Query)
	if cache := h.WikiSearchCache; cache != nil {
		if cached, ok := cache.Get(r.Context(), channelID, queryHash); ok {
			writeJSON(w, http.StatusOK, map[string]any{
				"success": true,
				"data": WikiSearchResponse{
					Results: cached,
					Total:   len(cached),
				},
			})
			return
		}
	}

	// Vectorize the query through the embedding service.
	embedding, err := h.Embedding.EmbedText(r.Context(), req.Query)
	if err != nil {
		slog.Error("wiki search: embedding failed", "error", err)
		writeError(w, http.StatusInternalServerError, "embedding service unavailable")
		return
	}

	// Build a pgvector-compatible string representation: '[1.2,3.4,...]'
	vecStr := pgvectorString(embedding)

	// Execute the semantic search.
	rows, err := h.Queries.SearchWikiChunks(r.Context(), db.SearchWikiChunksParams{
		ChannelID:   channelUUID,
		TopK:        int32(req.TopK),
		QueryVector: vecStr,
		Threshold:   &req.Threshold,
	})
	if err != nil {
		slog.Error("wiki search: query failed", "error", err, "channel_id", channelID)
		writeError(w, http.StatusInternalServerError, "search query failed")
		return
	}

	// Map rows to response.
	results := make([]WikiSearchResult, 0, len(rows))
	for _, row := range rows {
		results = append(results, WikiSearchResult{
			ChunkID:       uuidToString(row.ID),
			DocumentID:    uuidToString(row.DocumentID),
			DocumentTitle: row.DocumentTitle,
			Content:       row.Content,
			Similarity:    row.Similarity,
			ChunkIndex:    row.ChunkIndex,
		})
	}

	// Cache the results.
	if cache := h.WikiSearchCache; cache != nil {
		cache.Set(r.Context(), channelID, queryHash, results)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data": WikiSearchResponse{
			Results: results,
			Total:   len(results),
		},
	})
}

// ---------------------------------------------------------------------------
// Wiki-enabled agent search integration
// ---------------------------------------------------------------------------

// SearchWikiForAgent performs a wiki search using an agent's configured
// wiki parameters. Called by the daemon claim path when the agent has
// wiki_enabled = true. The channelID parameter provides the scope for
// the search (derived from the chat session or request context).
// Returns formatted context for injection into the agent's system prompt,
// and the list of referenced documents for WebSocket events.
func (h *Handler) SearchWikiForAgent(ctx context.Context, agent db.Agent, channelID pgtype.UUID, userQuery string) (string, []protocol.WikiRefDoc, error) {
	if !agent.WikiEnabled {
		return "", nil, nil
	}

	topK := int(agent.WikiTopK)
	if topK <= 0 {
		topK = 5
	}
	threshold := float64(agent.WikiThreshold)
	if threshold <= 0 {
		threshold = 0.7
	}

	if !channelID.Valid {
		return "", nil, nil
	}

	embedding, err := h.Embedding.EmbedText(ctx, userQuery)
	if err != nil {
		return "", nil, fmt.Errorf("embedding failed: %w", err)
	}
	vecStr := pgvectorString(embedding)

	rows, err := h.Queries.SearchWikiChunks(ctx, db.SearchWikiChunksParams{
		ChannelID:   channelID,
		TopK:        int32(topK),
		QueryVector: vecStr,
		Threshold:   &threshold,
	})
	if err != nil {
		return "", nil, fmt.Errorf("wiki search failed: %w", err)
	}

	if len(rows) == 0 {
		return "", nil, nil
	}

	// Build formatted context and refs.
	var contextBuilder string
	contextBuilder = "以下是当前频道的知识库内容，请根据这些内容回答：\n\n"
	refs := make([]protocol.WikiRefDoc, 0)

	for i, row := range rows {
		contextBuilder += fmt.Sprintf("[来源 %d: %s (相似度: %.2f)]\n%s\n\n",
			i+1, row.DocumentTitle, row.Similarity, row.Content)
		refs = append(refs, protocol.WikiRefDoc{
			DocumentID:    uuidToString(row.DocumentID),
			DocumentTitle: row.DocumentTitle,
			Chunks:        []int{int(row.ChunkIndex)},
			Similarity:    row.Similarity,
		})
	}

	return contextBuilder, refs, nil
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// pgvectorString converts a float32 slice to a pgvector-compatible string
// format: '[1.2, 3.4, 5.6]'
func pgvectorString(vec []float32) string {
	if len(vec) == 0 {
		return "[]"
	}
	b := make([]byte, 0, len(vec)*8)
	b = append(b, '[')
	for i, v := range vec {
		if i > 0 {
			b = append(b, ',')
		}
		b = fmt.Appendf(b, "%g", v)
	}
	b = append(b, ']')
	return string(b)
}

// hashQuery produces a short cache key from the query text.
// A simple djb2 hash is sufficient for cache dedup; not security-sensitive.
func hashQuery(query string) string {
	var h uint64 = 5381
	for i := 0; i < len(query); i++ {
		h = ((h << 5) + h) + uint64(query[i])
	}
	return fmt.Sprintf("%x", h)
}

// ---------------------------------------------------------------------------
// Channel-scoped Wiki document handlers (stubs — implemented in wiki_document.go)
// ---------------------------------------------------------------------------

// WikiDocumentRequest is the request body for creating/updating wiki documents.
type WikiDocumentRequest struct {
	Title       string `json:"title"`
	Content     string `json:"content"`
	ContentType string `json:"content_type,omitempty"`
	SourceURL   string `json:"source_url,omitempty"`
}

// WikiDocumentResponse is the API response for a wiki document.
type WikiDocumentResponse struct {
	ID          string `json:"id"`
	ChannelID   string `json:"channel_id"`
	Title       string `json:"title"`
	ContentType string `json:"content_type"`
	Status      string `json:"status"`
	ChunkCount  int    `json:"chunk_count"`
	TokenCount  int    `json:"token_count"`
	CreatedBy   string `json:"created_by,omitempty"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

func wikiDocToResponse(d db.WikiDocument) WikiDocumentResponse {
	return WikiDocumentResponse{
		ID:          uuidToString(d.ID),
		ChannelID:   uuidToString(d.ChannelID),
		Title:       d.Title,
		ContentType: d.ContentType,
		Status:      d.Status,
		ChunkCount:  int(d.ChunkCount),
		TokenCount:  int(d.TokenCount),
		CreatedBy:   uuidToPtr(d.CreatedBy),
		CreatedAt:   timestampToString(d.CreatedAt),
		UpdatedAt:   timestampToString(d.UpdatedAt),
	}
}

// ListWikiDocuments handles GET /api/channels/{channelId}/wiki/documents
func (h *Handler) ListWikiDocuments(w http.ResponseWriter, r *http.Request) {
	channelID := chi.URLParam(r, "channelId")
	channelUUID, ok := parseUUIDOrBadRequest(w, channelID, "channel id")
	if !ok {
		return
	}

	docs, err := h.Queries.ListWikiDocuments(r.Context(), channelUUID)
	if err != nil {
		slog.Error("failed to list wiki documents", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to list wiki documents")
		return
	}

	resp := make([]WikiDocumentResponse, 0, len(docs))
	for _, d := range docs {
		resp = append(resp, wikiDocToResponse(d))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data":    resp,
	})
}

// GetWikiDocument handles GET /api/channels/{channelId}/wiki/documents/{docId}
func (h *Handler) GetWikiDocument(w http.ResponseWriter, r *http.Request) {
	channelID := chi.URLParam(r, "channelId")
	channelUUID, ok := parseUUIDOrBadRequest(w, channelID, "channel id")
	if !ok {
		return
	}

	docID := chi.URLParam(r, "docId")
	docUUID, ok := parseUUIDOrBadRequest(w, docID, "document id")
	if !ok {
		return
	}

	doc, err := h.Queries.GetWikiDocument(r.Context(), db.GetWikiDocumentParams{
		ID:        docUUID,
		ChannelID: channelUUID,
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "wiki document not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data":    wikiDocToResponse(doc),
	})
}

// CreateWikiDocument handles POST /api/channels/{channelId}/wiki/documents
func (h *Handler) CreateWikiDocument(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	channelID := chi.URLParam(r, "channelId")
	channelUUID, ok := parseUUIDOrBadRequest(w, channelID, "channel id")
	if !ok {
		return
	}

	var req WikiDocumentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}
	if req.ContentType == "" {
		req.ContentType = "markdown"
	}

	userUUID, _ := parseUUIDOrBadRequest(w, userID, "user id")
	doc, err := h.Queries.CreateWikiDocument(r.Context(), db.CreateWikiDocumentParams{
		ChannelID:   channelUUID,
		Title:       req.Title,
		Content:     req.Content,
		ContentType: req.ContentType,
		SourceUrl:   req.SourceURL,
		CreatedBy:   userUUID,
	})
	if err != nil {
		slog.Error("failed to create wiki document", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to create wiki document")
		return
	}

	// TODO: Trigger async embedding pipeline for the new document content.

	writeJSON(w, http.StatusCreated, map[string]any{
		"success": true,
		"data":    wikiDocToResponse(doc),
	})
}

// ArchiveWikiDocument handles DELETE /api/channels/{channelId}/wiki/documents/{docId}
func (h *Handler) ArchiveWikiDocument(w http.ResponseWriter, r *http.Request) {
	channelID := chi.URLParam(r, "channelId")
	channelUUID, ok := parseUUIDOrBadRequest(w, channelID, "channel id")
	if !ok {
		return
	}

	docID := chi.URLParam(r, "docId")
	docUUID, ok := parseUUIDOrBadRequest(w, docID, "document id")
	if !ok {
		return
	}

	_, err := h.Queries.ArchiveWikiDocument(r.Context(), db.ArchiveWikiDocumentParams{
		ID:        docUUID,
		ChannelID: channelUUID,
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "wiki document not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data":    map[string]string{"status": "archived"},
	})
}
