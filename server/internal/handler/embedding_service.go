package handler

import (
	"context"

	"github.com/pgvector/pgvector-go"
)

// EmbeddingService abstracts the embedding provider (OpenAI, local model, etc.).
// The concrete implementation is injected at startup so the handler stays
// testable and swappable.
type EmbeddingService interface {
	// EmbedText returns the embedding vector for a single text.
	EmbedText(ctx context.Context, text string) (pgvector.Vector, error)
}

// NoopEmbeddingService is a stub used in tests and when no embedding provider
// is configured. Returns a zero vector of dimension 1536.
type NoopEmbeddingService struct{}

func (n NoopEmbeddingService) EmbedText(_ context.Context, _ string) (pgvector.Vector, error) {
	return pgvector.NewVector(make([]float32, 1536)), nil
}

// Ensure interface compliance.
var _ EmbeddingService = NoopEmbeddingService{}

// Ensure the OpenAI service also satisfies the interface.
var _ EmbeddingService = (*OpenAIEmbeddingService)(nil)
