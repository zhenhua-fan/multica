"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare,
  MessageSquareText,
  AlertCircle,
  Archive,
  ChevronRight,
} from "lucide-react";
import { useWorkspaceId } from "@multica/core/hooks";
import { chatSessionsOptions } from "@multica/core/chat/queries";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import type { ChatSession } from "@multica/core/types";

function ConversationItem({
  session,
  workspaceSlug,
  channelSlug,
}: {
  session: ChatSession;
  workspaceSlug: string;
  channelSlug: string;
}) {
  const isArchived = session.status === "archived";
  return (
    <Link
      href={`/${workspaceSlug}/channels/${channelSlug}/conversations/${session.id}`}
      className="group flex items-center gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-accent/50 transition-colors"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted group-hover:bg-accent transition-colors">
        {isArchived ? (
          <Archive className="h-4 w-4 text-muted-foreground" />
        ) : (
          <MessageSquareText className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm truncate ${isArchived ? "text-muted-foreground italic" : "font-medium"}`}
        >
          {session.title || `Conversation`}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {isArchived ? "Archived" : "Active"} ·{" "}
          {new Date(session.updated_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
    </Link>
  );
}

function ConversationListSkeleton() {
  return (
    <div className="divide-y">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ChannelConversationsPage() {
  const params = useParams<{ workspaceSlug: string; channelSlug: string }>();
  const wsId = useWorkspaceId();

  const { data: sessions = [], isLoading, isError } = useQuery(
    chatSessionsOptions(wsId),
  );

  const { active, archived } = useMemo(() => {
    const activeList: ChatSession[] = [];
    const archivedList: ChatSession[] = [];
    for (const s of sessions) {
      if (s.status === "archived") archivedList.push(s);
      else activeList.push(s);
    }
    // Sort by updated_at descending within each group
    const sortFn = (a: ChatSession, b: ChatSession) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    activeList.sort(sortFn);
    archivedList.sort(sortFn);
    return { active: activeList, archived: archivedList };
  }, [sessions]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          Conversations
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <ConversationListSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center max-w-xs mx-auto">
            <AlertCircle className="h-7 w-7 text-destructive/50" />
            <p className="text-xs text-muted-foreground">
              Failed to load conversations. Please try again.
            </p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center max-w-xs mx-auto px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-medium">No conversations yet</h2>
              <p className="text-xs text-muted-foreground">
                Start a new conversation with your agent using the chat panel.
              </p>
            </div>
          </div>
        ) : (
          <div>
            {/* Active conversations */}
            {active.length > 0 && (
              <div>
                {active.map((session) => (
                  <ConversationItem
                    key={session.id}
                    session={session}
                    workspaceSlug={params.workspaceSlug}
                    channelSlug={params.channelSlug}
                  />
                ))}
              </div>
            )}

            {/* Archived conversations */}
            {archived.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-4 py-2 bg-muted/30">
                  <Archive className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Archived
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({archived.length})
                  </span>
                </div>
                {archived.map((session) => (
                  <ConversationItem
                    key={session.id}
                    session={session}
                    workspaceSlug={params.workspaceSlug}
                    channelSlug={params.channelSlug}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
