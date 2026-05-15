package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/pgvector/pgvector-go"
)

// ---------------------------------------------------------------------------
// OpenAI Embedding Service
// ---------------------------------------------------------------------------

// OpenAIEmbeddingService implements EmbeddingService using the OpenAI
// /v1/embeddings endpoint. Configured via environment variables:
//   - OPENAI_API_KEY (required)
//   - OPENAI_EMBEDDING_MODEL (default: "text-embedding-3-small")
//   - OPENAI_BASE_URL (default: "https://api.openai.com")
type OpenAIEmbeddingService struct {
	apiKey     string
	baseURL    string
	model      string
	httpClient *http.Client
}

// NewOpenAIEmbeddingService creates a new OpenAI embedding service from
// environment variables. Returns nil when OPENAI_API_KEY is not set.
func NewOpenAIEmbeddingService() *OpenAIEmbeddingService {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return nil
	}

	baseURL := os.Getenv("OPENAI_BASE_URL")
	if baseURL == "" {
		baseURL = "https://api.openai.com"
	}

	model := os.Getenv("OPENAI_EMBEDDING_MODEL")
	if model == "" {
		model = "text-embedding-3-small"
	}

	return &OpenAIEmbeddingService{
		apiKey:  apiKey,
		baseURL: baseURL,
		model:   model,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

type openAIEmbeddingRequest struct {
	Input     string `json:"input"`
	Model     string `json:"model"`
	InputType string `json:"input_type,omitempty"`
}

type openAIEmbeddingResponse struct {
	Data []struct {
		Embedding []float32 `json:"embedding"`
	} `json:"data"`
	Error *openAIError `json:"error,omitempty"`
}

type openAIError struct {
	Message string `json:"message"`
	Type    string `json:"type"`
}

// EmbedText calls the OpenAI embeddings API and returns a pgvector.Vector.
func (s *OpenAIEmbeddingService) EmbedText(ctx context.Context, text string) (pgvector.Vector, error) {
	reqBody := openAIEmbeddingRequest{
		Input:     text,
		Model:     s.model,
		InputType: "passage",
	}
	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return pgvector.Vector{}, fmt.Errorf("marshal request: %w", err)
	}

	url := s.baseURL + "/v1/embeddings"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(bodyBytes))
	if err != nil {
		return pgvector.Vector{}, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return pgvector.Vector{}, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return pgvector.Vector{}, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		slog.Error("openai embedding API error",
			"status", resp.StatusCode,
			"body", string(respBytes),
		)
		return pgvector.Vector{}, fmt.Errorf("openai API returned status %d", resp.StatusCode)
	}

	var embedResp openAIEmbeddingResponse
	if err := json.Unmarshal(respBytes, &embedResp); err != nil {
		return pgvector.Vector{}, fmt.Errorf("unmarshal response: %w", err)
	}

	if embedResp.Error != nil {
		return pgvector.Vector{}, fmt.Errorf("openai API error: %s", embedResp.Error.Message)
	}

	if len(embedResp.Data) == 0 {
		return pgvector.Vector{}, fmt.Errorf("openai returned empty embedding")
	}

	return pgvector.NewVector(embedResp.Data[0].Embedding), nil
}

// EmbedWithType is like EmbedText but lets the caller specify input_type
// (e.g. "passage" or "query" for NVIDIA asymmetric models).
func (s *OpenAIEmbeddingService) EmbedWithType(ctx context.Context, text string, inputType string) (pgvector.Vector, error) {
	reqBody := openAIEmbeddingRequest{
		Input:     text,
		Model:     s.model,
		InputType: inputType,
	}
	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return pgvector.Vector{}, fmt.Errorf("marshal request: %w", err)
	}

	url := s.baseURL + "/v1/embeddings"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(bodyBytes))
	if err != nil {
		return pgvector.Vector{}, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return pgvector.Vector{}, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		slog.Error("openai embedding API error", "status", resp.StatusCode, "body", string(body))
		return pgvector.Vector{}, fmt.Errorf("openai API returned status %d", resp.StatusCode)
	}

	var embedResp openAIEmbeddingResponse
	if err := json.NewDecoder(resp.Body).Decode(&embedResp); err != nil {
		return pgvector.Vector{}, fmt.Errorf("decode response: %w", err)
	}
	if embedResp.Error != nil {
		return pgvector.Vector{}, fmt.Errorf("openai API error: %s", embedResp.Error.Message)
	}
	if len(embedResp.Data) == 0 {
		return pgvector.Vector{}, fmt.Errorf("openai returned empty embedding")
	}
	return pgvector.NewVector(embedResp.Data[0].Embedding), nil
}

// EmbedBatch calls the OpenAI API for multiple texts in a single request.
// The API supports up to 2048 inputs per batch for text-embedding-3-small.
func (s *OpenAIEmbeddingService) EmbedBatch(ctx context.Context, texts []string) ([]pgvector.Vector, error) {
	if len(texts) == 0 {
		return nil, nil
	}

	// OpenAI API accepts an array of strings for batch embedding.
	inputs := make([]string, len(texts))
	copy(inputs, texts)

	reqBody := struct {
		Input []string `json:"input"`
		Model string   `json:"model"`
	}{
		Input: inputs,
		Model: s.model,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := s.baseURL + "/v1/embeddings"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var embedResp openAIEmbeddingResponse
	if err := json.Unmarshal(respBytes, &embedResp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	vectors := make([]pgvector.Vector, len(embedResp.Data))
	for i, d := range embedResp.Data {
		vectors[i] = pgvector.NewVector(d.Embedding)
	}

	return vectors, nil
}

// Ensure interface compliance.
var _ EmbeddingService = (*OpenAIEmbeddingService)(nil)
