"use client";

import { useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { MessageSquareText, Loader2, AlertCircle } from "lucide-react";
import { useWorkspaceId } from "@multica/core/hooks";
import { useChatStore } from "@multica/core/chat";
import { chatSessionOptions } from "@multica/core/chat/queries";
import { Skeleton } from "@multica/ui/components/ui/skeleton";

export default function ChannelConversationPage() {
  const params = useParams<{
    workspaceSlug: string;
    channelSlug: string;
    convId: string;
  }>();
  const wsId = useWorkspaceId();
  const convId = params.convId as string;

  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const setOpen = useChatStore((s) => s.setOpen);

  // Set the active session when the page mounts so ChatWindow picks it up.
  useEffect(() => {
    if (!convId) return;
    setActiveSession(convId);
    setOpen(true);
    // Clean up: clear active session when leaving this page so the chat
    // window doesn't stay bound to a potentially non-existent session.
    return () => {
      setActiveSession(null);
    };
  }, [convId, setActiveSession, setOpen]);

  const { data: session, isLoading, isError } = useQuery(
    chatSessionOptions(wsId, convId),
  );

  const title = useMemo(() => {
    if (isLoading) return null;
    if (session?.title) return session.title;
    return `Conversation`;
  }, [session?.title, isLoading]);

  return (
    <div className="flex h-full flex-col">
      {/* Conversation header */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
        <MessageSquareText className="h-4 w-4 text-muted-foreground" />
        {isLoading ? (
          <Skeleton className="h-4 w-48" />
        ) : (
          <span className="text-sm font-medium truncate">
            {title ?? `Conversation ${convId.slice(0, 8)}`}
          </span>
        )}
      </div>

      {/* Context area — ChatWindow handles the actual messages and input */}
      <div className="flex flex-1 items-center justify-center">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 text-center max-w-xs">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              Loading conversation…
            </p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 text-center max-w-xs">
            <AlertCircle className="h-7 w-7 text-destructive/50" />
            <p className="text-xs text-muted-foreground">
              Failed to load conversation. It may have been deleted or you may
              not have access.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center max-w-xs px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <MessageSquareText className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-medium">
                {session?.title || `Conversation`}
              </h2>
              <p className="text-xs text-muted-foreground">
                This conversation is open in the chat panel. Use the chat input
                to continue the discussion with your agent.
              </p>
              {session?.status === "archived" && (
                <p className="text-xs text-muted-foreground italic mt-1">
                  This conversation is archived and read-only.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
