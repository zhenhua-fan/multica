"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, BookOpen, AlertCircle } from "lucide-react";
import { Button } from "@multica/ui/components/ui/button";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { wikiDocumentListOptions } from "@multica/core/wiki";
import { WikiDocumentCard } from "./WikiDocumentCard";
import { WikiUploadDialog } from "./WikiUploadDialog";

export function WikiDocumentList({ channelId }: { channelId: string }) {
  const [createOpen, setCreateOpen] = useState(false);

  const { data: documents = [], isLoading, isError } = useQuery(
    wikiDocumentListOptions(channelId),
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Wiki Documents</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          New Document
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3 p-4 rounded-lg border">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-destructive/50" />
            <p className="text-sm text-muted-foreground">
              Failed to load documents. Please try again.
            </p>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <BookOpen className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-medium">No documents yet</h2>
              <p className="text-xs text-muted-foreground max-w-xs">
                Upload documents to build your channel&apos;s knowledge base.
                Agents will be able to reference these documents in conversations.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create your first document
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => (
              <WikiDocumentCard key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </div>

      <WikiUploadDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        channelId={channelId}
      />
    </div>
  );
}
