-- Agent wiki configuration: enables automatic knowledge-base retrieval during chat.
ALTER TABLE agent
  ADD COLUMN wiki_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN wiki_top_k    INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN wiki_threshold REAL NOT NULL DEFAULT 0.7;

COMMENT ON COLUMN agent.wiki_enabled IS 'Whether the agent automatically searches the wiki for relevant knowledge before responding';
COMMENT ON COLUMN agent.wiki_top_k IS 'Maximum number of wiki chunks to retrieve per query';
COMMENT ON COLUMN agent.wiki_threshold IS 'Minimum cosine similarity threshold (0.0-1.0) for wiki results';
