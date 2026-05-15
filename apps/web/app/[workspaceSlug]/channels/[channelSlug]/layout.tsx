"use client";

import { useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { channelListOptions } from "@multica/core/channels";
import { useWorkspaceId } from "@multica/core/hooks";
import {
  ChannelHeader,
  ChannelCreateDialog,
  ChannelSettings,
} from "@multica/views/channels";
import type { Channel } from "@multica/core/types";

export default function ChannelInnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ workspaceSlug: string; channelSlug: string }>();
  const router = useRouter();
  const wsId = useWorkspaceId();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Resolve channelSlug -> channel ID from the list
  const { data: channels = [] } = useQuery(channelListOptions(wsId));

  const channel = useMemo(
    () => channels.find((c: Channel) => c.slug === params.channelSlug) ?? null,
    [channels, params.channelSlug],
  );

  const handleSelectChannel = useCallback(
    (ch: Channel) => {
      router.push(
        `/${params.workspaceSlug}/channels/${ch.slug}`,
      );
    },
    [params.workspaceSlug, router],
  );

  return (
    <div className="flex flex-col h-full">
      <ChannelHeader
        channelId={channel?.id ?? null}
        onSelectChannel={handleSelectChannel}
        onCreateChannel={() => setCreateDialogOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="flex-1 overflow-auto">{children}</div>

      <ChannelCreateDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />

      {channel && (
        <ChannelSettings
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          channelId={channel.id}
        />
      )}
    </div>
  );
}
