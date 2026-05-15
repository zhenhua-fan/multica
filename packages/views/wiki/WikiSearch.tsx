"use client";

import { useState } from "react";
import { Search, Loader2, FileText, AlertCircle } from "lucide-react";
import { Button } from "@multica/ui/components/ui/button";
import { Input } from "@multica/ui/components/ui/input";
import { useSearchWiki } from "@multica/core/wiki";
import type { WikiSearchResult } from "@multica/core/types";

function SimilarityBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 90
      ? "bg-green-500"
      : pct >= 75
        ? "bg-yellow-500"
        : "bg-orange-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">
        {pct}%
      </span>
    </div>
  );
}

export function WikiSearch({ channelId }: { channelId: string }) {
  const [query, setQuery] = useState("");
  const mutation = useSearchWiki(channelId);

  const handleSearch = () => {
    if (!query.trim()) return;
    mutation.mutate({ query: query.trim(), top_k: 5, threshold: 0.5 });
  };

  const results = mutation.data?.results || [];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
        <Search className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Search Wiki</span>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 p-4 border-b">
        <Input
          placeholder="Search knowledge base..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="flex-1"
        />
        <Button
          size="sm"
          onClick={handleSearch}
          disabled={!query.trim() || mutation.isPending}
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {mutation.isPending ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Searching documents...
            </p>
          </div>
        ) : mutation.isError ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-destructive/50" />
            <p className="text-sm text-muted-foreground">
              Search failed. Please try again.
            </p>
          </div>
        ) : mutation.data && results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
            <Search className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              No results found for &quot;{query}&quot;
            </p>
          </div>
        ) : !mutation.data ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Search className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-medium">Semantic Search</h2>
              <p className="text-xs text-muted-foreground max-w-xs">
                Search across all indexed documents in this channel using natural language.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {results.map((item: WikiSearchResult, i: number) => (
              <div key={item.chunk_id || i} className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium truncate">
                    {item.document_title}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    chunk {item.chunk_index}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {item.content}
                </p>
                <SimilarityBar value={item.similarity} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
