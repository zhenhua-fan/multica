"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceId } from "@multica/core/hooks";
import { channelListOptions } from "@multica/core/channels";
import { WikiSearch } from "@multica/views/wiki";
import type { Channel } from "@multica/core/types";

export default function WikiSearchPage() {
  const params = useParams<{ workspaceSlug: string; channelSlug: string }>();
  const wsId = useWorkspaceId();
  const { data: channels = [] } = useQuery(channelListOptions(wsId));

  const channel = useMemo(
    () => channels.find((c: Channel) => c.slug === params.channelSlug) ?? null,
    [channels, params.channelSlug],
  );

  if (!channel) return null;
  return <WikiSearch channelId={channel.id} />;
}
