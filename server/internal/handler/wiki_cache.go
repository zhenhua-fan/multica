package handler

import (
	"context"
	"time"
)

// WikiSearchCache provides optional Redis-backed caching for wiki search results.
// When embedded, search queries matching a cached key are returned immediately
// without hitting pgvector.
type WikiSearchCache struct {
	ttl time.Duration
}

// NewWikiSearchCache creates a wiki search cache backed by the given Redis client.
// Returns nil when rdb is nil (Redis is optional).
func NewWikiSearchCache(rdb interface{}) *WikiSearchCache {
	if rdb == nil {
		return nil
	}
	return &WikiSearchCache{ttl: 5 * time.Minute}
}

// Get returns a cached search result for the given key.
// Returns nil, false when the key is not found or cache is not available.
func (c *WikiSearchCache) Get(ctx context.Context, key string) ([]byte, bool) {
	if c == nil {
		return nil, false
	}
	// Noop: Redis not connected, always miss
	return nil, false
}

// Set stores a search result in the cache.
func (c *WikiSearchCache) Set(ctx context.Context, key string, value []byte) {
	// Noop: Redis not connected
}
