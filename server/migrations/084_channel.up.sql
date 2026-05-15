CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE channel (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    avatar_url      TEXT NOT NULL DEFAULT '',
    owner_id        UUID NOT NULL REFERENCES "user"(id),
    settings        JSONB NOT NULL DEFAULT '{}',
    archived_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_channel_slug_workspace ON channel(workspace_id, slug) WHERE archived_at IS NULL;
CREATE INDEX idx_channel_workspace ON channel(workspace_id);

CREATE TABLE channel_member (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id      UUID NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    role            TEXT NOT NULL DEFAULT 'member'
                    CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    added_by        UUID NOT NULL REFERENCES "user"(id),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(channel_id, user_id)
);

CREATE INDEX idx_channel_member_channel ON channel_member(channel_id);
CREATE INDEX idx_channel_member_user ON channel_member(user_id);
