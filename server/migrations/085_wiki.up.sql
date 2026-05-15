CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE wiki_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id      UUID NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    content         TEXT NOT NULL DEFAULT '',
    content_type    TEXT NOT NULL DEFAULT 'markdown'
                    CHECK (content_type IN ('markdown', 'pdf', 'html', 'text', 'docx')),
    source_url      TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'processing'
                    CHECK (status IN ('processing', 'indexed', 'error', 'archived')),
    file_path       TEXT NOT NULL DEFAULT '',
    token_count     INTEGER NOT NULL DEFAULT 0,
    chunk_count     INTEGER NOT NULL DEFAULT 0,
    meta            JSONB NOT NULL DEFAULT '{}',
    created_by      UUID REFERENCES "user"(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wiki_documents_channel ON wiki_documents(channel_id);
CREATE INDEX idx_wiki_documents_status ON wiki_documents(status);
CREATE INDEX idx_wiki_documents_created ON wiki_documents(created_at);

CREATE TABLE wiki_chunks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES wiki_documents(id) ON DELETE CASCADE,
    chunk_index     INTEGER NOT NULL,
    content         TEXT NOT NULL,
    embedding       vector(1536),
    token_count     INTEGER NOT NULL DEFAULT 0,
    meta            JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wiki_chunks_document ON wiki_chunks(document_id);
CREATE INDEX idx_wiki_chunks_doc_index ON wiki_chunks(document_id, chunk_index);
CREATE INDEX idx_wiki_chunks_embedding ON wiki_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 200);
