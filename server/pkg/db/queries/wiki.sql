-- name: ListWikiDocuments :many
SELECT * FROM wiki_documents
WHERE channel_id = sqlc.arg('channel_id')
ORDER BY created_at DESC;

-- name: GetWikiDocument :one
SELECT * FROM wiki_documents
WHERE id = sqlc.arg('id') AND channel_id = sqlc.arg('channel_id');

-- name: CreateWikiDocument :one
INSERT INTO wiki_documents (
    channel_id, title, content, content_type, source_url, file_path, created_by
) VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: UpdateWikiDocument :one
UPDATE wiki_documents SET
    title = COALESCE(sqlc.narg('title'), title),
    content = COALESCE(sqlc.narg('content'), content),
    status = COALESCE(sqlc.narg('status'), status),
    token_count = COALESCE(sqlc.narg('token_count'), token_count),
    chunk_count = COALESCE(sqlc.narg('chunk_count'), chunk_count),
    meta = COALESCE(sqlc.narg('meta'), meta),
    updated_at = NOW()
WHERE id = sqlc.arg('id') AND channel_id = sqlc.arg('channel_id')
RETURNING *;

-- name: ArchiveWikiDocument :one
UPDATE wiki_documents SET
    status = 'archived',
    updated_at = NOW()
WHERE id = sqlc.arg('id') AND channel_id = sqlc.arg('channel_id')
RETURNING *;

-- name: CreateWikiChunk :one
INSERT INTO wiki_chunks (document_id, chunk_index, content, embedding, token_count, meta)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: DeleteWikiChunksByDocument :exec
DELETE FROM wiki_chunks WHERE document_id = sqlc.arg('document_id');

-- name: SearchWikiChunks :many
SELECT
    wc.id,
    wc.document_id,
    wc.chunk_index,
    wc.content,
    wc.token_count,
    (1 - (wc.embedding <=> sqlc.arg('query_vector')::vector))::float8 AS similarity,
    wd.title AS document_title,
    wd.status AS document_status
FROM wiki_chunks wc
JOIN wiki_documents wd ON wc.document_id = wd.id
WHERE wd.channel_id = sqlc.arg('channel_id')
  AND wd.status = 'indexed'
  AND (1 - (wc.embedding <=> sqlc.arg('query_vector')::vector))::float8 > COALESCE(sqlc.narg('threshold')::float8, 0.0)
ORDER BY similarity DESC
LIMIT sqlc.arg('top_k');
