-- name: ListChannelMembers :many
SELECT cm.*, u.name AS display_name, u.avatar_url, u.email
FROM channel_member cm
JOIN "user" u ON cm.user_id = u.id
WHERE cm.channel_id = $1
ORDER BY cm.joined_at ASC;

-- name: GetChannelMember :one
SELECT * FROM channel_member
WHERE channel_id = $1 AND user_id = $2;

-- name: AddChannelMember :one
INSERT INTO channel_member (channel_id, user_id, role, added_by)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: UpdateChannelMember :one
UPDATE channel_member SET
    role = COALESCE(sqlc.narg('role'), role)
WHERE channel_id = $1 AND user_id = $2
RETURNING *;

-- name: RemoveChannelMember :exec
DELETE FROM channel_member
WHERE channel_id = $1 AND user_id = $2;

-- name: CountChannelMembers :one
SELECT COUNT(*) FROM channel_member
WHERE channel_id = $1;
