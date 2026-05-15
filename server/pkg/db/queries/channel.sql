-- name: ListChannels :many
SELECT * FROM channel
WHERE workspace_id = $1 AND archived_at IS NULL
ORDER BY created_at ASC;

-- name: ListAllChannels :many
SELECT * FROM channel
WHERE workspace_id = $1
ORDER BY created_at ASC;

-- name: GetChannel :one
SELECT * FROM channel
WHERE id = $1 AND archived_at IS NULL;

-- name: GetChannelInWorkspace :one
SELECT * FROM channel
WHERE id = $1 AND workspace_id = $2 AND archived_at IS NULL;

-- name: CreateChannel :one
INSERT INTO channel (
    workspace_id, name, slug, description, avatar_url, owner_id, settings
) VALUES ($1, $2, $3, $4, sqlc.narg('avatar_url'), $5, sqlc.narg('settings'))
RETURNING *;

-- name: UpdateChannel :one
UPDATE channel SET
    name = COALESCE(sqlc.narg('name'), name),
    description = COALESCE(sqlc.narg('description'), description),
    avatar_url = COALESCE(sqlc.narg('avatar_url'), avatar_url),
    settings = COALESCE(sqlc.narg('settings'), settings),
    updated_at = NOW()
WHERE id = $1 AND workspace_id = $2 AND archived_at IS NULL
RETURNING *;

-- name: ArchiveChannel :one
UPDATE channel SET
    archived_at = NOW(),
    updated_at = NOW()
WHERE id = $1 AND workspace_id = $2 AND archived_at IS NULL
RETURNING *;

-- name: GetChannelBySlug :one
SELECT * FROM channel
WHERE workspace_id = $1 AND slug = $2 AND archived_at IS NULL;
