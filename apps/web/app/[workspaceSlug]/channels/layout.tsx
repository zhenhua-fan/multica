"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChannelSidebar } from "@multica/views/channels";
import type { Channel } from "@multica/core/types";

export default function ChannelsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ workspaceSlug: string }>();
  const router = useRouter();

  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  const handleSelectChannel = useCallback(
    (channel: Channel) => {
      setActiveChannelId(channel.id);
      router.push(
        `/${params.workspaceSlug}/channels/${channel.slug}`,
      );
    },
    [params.workspaceSlug, router],
  );

  return (
    <div className="flex h-full">
      <ChannelSidebar
        activeChannelId={activeChannelId}
        onSelectChannel={handleSelectChannel}
      />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
