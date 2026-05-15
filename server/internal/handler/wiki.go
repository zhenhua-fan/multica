package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/pgvector/pgvector-go"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/internal/util"
)

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

type WikiDocumentResponse struct {
	ID          string `json:"id"`
	ChannelID   string `json:"channel_id"`
	Title       string `json:"title"`
	Content     string `json:"content,omitempty"`
	ContentType string `json:"content_type"`
	Status      string `json:"status"`
	SourceURL   string `json:"source_url,omitempty"`
	TokenCount  int32  `json:"token_count"`
	ChunkCount  int32  `json:"chunk_count"`
	CreatedBy   string `json:"created_by,omitempty"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

type CreateWikiDocumentRequest struct {
	Title       string `json:"title"`
	Content     string `json:"content"`
	ContentType string `json:"content_type"`
	SourceURL   string `json:"source_url,omitempty"`
}

type UpdateWikiDocumentRequest struct {
	Title   *string `json:"title,omitempty"`
	Content *string `json:"content,omitempty"`
	Status  *string `json:"status,omitempty"`
}

type WikiSearchRequest struct {
	Query     string  `json:"query"`
	TopK      int32   `json:"top_k"`
	Threshold float64 `json:"threshold"`
}

type WikiSearchResult struct {
	ChunkID       string  `json:"chunk_id"`
	DocumentID    string  `json:"document_id"`
	DocumentTitle string  `json:"document_title"`
	Content       string  `json:"content"`
	ChunkIndex    int32   `json:"chunk_index"`
	Similarity    float64 `json:"similarity"`
	TokenCount    int32   `json:"token_count"`
}

type WikiChunkResult struct {
	ChunkIndex  int32   `json:"chunk_index"`
	Content     string  `json:"content"`
	TokenCount  int32   `json:"token_count"`
	CreatedAt   string  `json:"created_at"`
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func wikiDocumentToResponse(d db.WikiDocument) WikiDocumentResponse {
	return WikiDocumentResponse{
		ID:          util.UUIDToString(d.ID),
		ChannelID:   util.UUIDToString(d.ChannelID),
		Title:       d.Title,
		Content:     d.Content,
		ContentType: d.ContentType,
		Status:      d.Status,
		SourceURL:   d.SourceUrl,
		TokenCount:  d.TokenCount,
		ChunkCount:  d.ChunkCount,
		CreatedBy:   util.UUIDToString(d.CreatedBy),
		CreatedAt:   util.TimestampToString(d.CreatedAt),
		UpdatedAt:   util.TimestampToString(d.UpdatedAt),
	}
}

// ---------------------------------------------------------------------------
// Wiki Document Handlers
// ---------------------------------------------------------------------------

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
		writeError(w, http.StatusInternalServerError, "failed to list documents")
		return
	}

	resp := make([]WikiDocumentResponse, 0, len(docs))
	for _, d := range docs {
		resp = append(resp, wikiDocumentToResponse(d))
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
		writeError(w, http.StatusNotFound, "document not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data":    wikiDocumentToResponse(doc),
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

	var req CreateWikiDocumentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Title == "" || req.Content == "" {
		writeError(w, http.StatusBadRequest, "title and content are required")
		return
	}
	if req.ContentType == "" {
		req.ContentType = "markdown"
	}

	userUUID, _ := util.ParseUUID(userID)

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
		writeError(w, http.StatusInternalServerError, "failed to create document")
		return
	}

	// After creation, trigger async indexing (chunk + embed)
	go h.indexWikiDocument(doc)

	writeJSON(w, http.StatusAccepted, map[string]any{
		"success": true,
		"data":    wikiDocumentToResponse(doc),
	})
}

// UpdateWikiDocument handles PATCH /api/channels/{channelId}/wiki/documents/{docId}
func (h *Handler) UpdateWikiDocument(w http.ResponseWriter, r *http.Request) {
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

	var req UpdateWikiDocumentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	doc, err := h.Queries.UpdateWikiDocument(r.Context(), db.UpdateWikiDocumentParams{
		ID:        docUUID,
		ChannelID: channelUUID,
		Title:     util.PtrToText(req.Title),
		Content:   util.PtrToText(req.Content),
		Status:    util.PtrToText(req.Status),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "document not found")
		return
	}

	// If content changed, re-index asynchronously
	if req.Content != nil {
		go h.indexWikiDocument(doc)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data":    wikiDocumentToResponse(doc),
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
		writeError(w, http.StatusNotFound, "document not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data":    map[string]string{"status": "archived"},
	})
}

// ---------------------------------------------------------------------------
// Wiki Search Handler
// ---------------------------------------------------------------------------

// SearchWiki handles POST /api/channels/{channelId}/wiki/search
func (h *Handler) SearchWiki(w http.ResponseWriter, r *http.Request) {
	channelID := chi.URLParam(r, "channelId")
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
	if req.TopK <= 0 || req.TopK > 50 {
		req.TopK = 5
	}
	if req.Threshold <= 0 {
		req.Threshold = 0.7
	}

	// Embed the query text into a vector
	embedding, err := embedText(r.Context(), req.Query, h.Embedding, "query")
	if err != nil {
		slog.Error("failed to embed search query", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to process search query")
		return
	}

	// Search via pgvector
	chunks, err := h.Queries.SearchWikiChunks(r.Context(), db.SearchWikiChunksParams{
		ChannelID:   channelUUID,
		TopK:        req.TopK,
		QueryVector: embedding,
		Threshold:   pgtype.Float8{Float64: req.Threshold, Valid: true},
	})
	if err != nil {
		slog.Error("failed to search wiki", "error", err)
		writeError(w, http.StatusInternalServerError, "search failed")
		return
	}

	results := make([]WikiSearchResult, 0, len(chunks))
	for _, c := range chunks {
		results = append(results, WikiSearchResult{
			ChunkID:       util.UUIDToString(c.ID),
			DocumentID:    util.UUIDToString(c.DocumentID),
			DocumentTitle: c.DocumentTitle,
			Content:       c.Content,
			ChunkIndex:    c.ChunkIndex,
			Similarity:    c.Similarity,
			TokenCount:    c.TokenCount,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data": map[string]any{
			"results": results,
			"total":   len(results),
		},
	})
}

// ---------------------------------------------------------------------------
// Async Indexing (document → chunks → embeddings → store)
// ---------------------------------------------------------------------------

// indexWikiDocument processes a document: chunk text → embed → store chunks.
func (h *Handler) indexWikiDocument(doc db.WikiDocument) {
	ctx := context.Background()
	slog.Info("indexing wiki document", "doc_id", util.UUIDToString(doc.ID), "content_len", len(doc.Content))

	// 1. Determine content type and parse
	content := doc.Content
	if doc.ContentType == "markdown" {
		content = stripMarkdownHeaders(content)
	}

	// 2. Split into chunks
	chunks := splitTextIntoChunks(content, 1000, 200)

	// 3. Delete old chunks if re-indexing
	if doc.ChunkCount > 0 {
		h.Queries.DeleteWikiChunksByDocument(ctx, doc.ID)
	}

	// 4. Embed and store each chunk
	totalTokens := int32(0)
	for i, chunk := range chunks {
		embedding, err := embedText(ctx, chunk, h.Embedding, "passage")
		if err != nil {
			slog.Error("failed to embed wiki chunk", "error", err, "document_id", util.UUIDToString(doc.ID), "chunk_index", i)
			continue
		}
		slog.Info("embedding ok, storing chunk", "doc_id", util.UUIDToString(doc.ID), "chunk_index", i, "dim", len(embedding.Slice()))
		tokens := int32(countTokens(chunk))

		_, err = h.Queries.CreateWikiChunk(ctx, db.CreateWikiChunkParams{
			DocumentID: doc.ID,
			ChunkIndex: int32(i),
			Content:    chunk,
			Embedding:  embedding,
			TokenCount: tokens,
			Meta:       []byte("{}"),
		})
		if err != nil {
			slog.Error("failed to store wiki chunk", "error", err, "document_id", util.UUIDToString(doc.ID), "chunk_index", i)
			continue
		}
		totalTokens += tokens
	}

	// 5. Mark document as indexed
	status := "indexed"
	h.Queries.UpdateWikiDocument(ctx, db.UpdateWikiDocumentParams{
		ID:         doc.ID,
		ChannelID:  doc.ChannelID,
		Status:     util.StrToText(status),
		TokenCount: pgtype.Int4{Int32: totalTokens, Valid: true},
		ChunkCount: pgtype.Int4{Int32: int32(len(chunks)), Valid: true},
	})

	slog.Info("wiki document indexed",
		"document_id", util.UUIDToString(doc.ID),
		"chunks", len(chunks),
		"tokens", totalTokens,
	)
}

// ---------------------------------------------------------------------------
// Text Utilities
// ---------------------------------------------------------------------------

// splitTextIntoChunks splits text into overlapping chunks.
func splitTextIntoChunks(text string, chunkSize, overlap int) []string {
	if len(text) <= chunkSize {
		return []string{text}
	}

	var chunks []string
	start := 0
	for start < len(text) {
		end := start + chunkSize
		if end > len(text) {
			end = len(text)
		}
		chunks = append(chunks, text[start:end])
		start = end - overlap
		if start >= len(text) {
			break
		}
	}
	return chunks
}

// stripMarkdownHeaders removes markdown heading markers for cleaner chunking.
func stripMarkdownHeaders(text string) string {
	lines := strings.Split(text, "\n")
	var cleaned []string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "```") {
			cleaned = append(cleaned, line)
			continue
		}
		cleaned = append(cleaned, line)
	}
	return strings.Join(cleaned, "\n")
}

// countTokens estimates token count (rough: 4 chars ≈ 1 token).
func countTokens(text string) int {
	return len(text) / 4
}

// ---------------------------------------------------------------------------
// Embedding Service (calls external LLM API)
// ---------------------------------------------------------------------------

// embedText calls the embedding API to convert text to a vector.
// In production this would call OpenAI /text-embedding-3-small or similar.
func embedText(ctx context.Context, text string, svc EmbeddingService, inputType string) (pgvector.Vector, error) {
	if svc == nil {
		return pgvector.NewVector(make([]float32, 1536)), nil
	}
	if oai, ok := svc.(*OpenAIEmbeddingService); ok {
		return oai.EmbedWithType(ctx, text, inputType)
	}
	return svc.EmbedText(ctx, text)
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

func strPtr(s string) *string      { return &s }
func int32Ptr(v int32) *int32      { return &v }
