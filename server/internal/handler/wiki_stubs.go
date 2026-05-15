package handler

import (
	"context"
	"github.com/redis/go-redis/v9"
)

// WikiSearchCache is a placeholder for the wiki search cache (MUL-4).
type WikiSearchCache struct {
	client *redis.Client
}

// NewWikiSearchCache creates a new WikiSearchCache.
func NewWikiSearchCache(client *redis.Client) *WikiSearchCache {
	return &WikiSearchCache{client: client}
}

// EmbeddingService is the interface for generating text embeddings.
type EmbeddingService interface {
	Embed(ctx context.Context, text string) ([]float64, error)
}

// NoopEmbeddingService is a no-op implementation of EmbeddingService.
type NoopEmbeddingService struct{}

func (n NoopEmbeddingService) Embed(ctx context.Context, text string) ([]float64, error) {
	return nil, nil
}
