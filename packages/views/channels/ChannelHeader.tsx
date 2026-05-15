"use client";

import { useQuery } from '@tanstack/react-query';
import {
  channelDetailOptions,
  channelMemberListOptions,
} from '@multica/core/channels';
import { useWorkspaceId } from '@multica/core/hooks';
import { cn } from '@multica/ui/lib/utils';
import { Button } from '@multica/ui/components/ui/button';
import { Skeleton } from '@multica/ui/components/ui/skeleton';
import { Hash, Users, Settings } from 'lucide-react';
import { ChannelSelect } from './ChannelSelect';
import type { Channel } from '@multica/core/types';

export interface ChannelHeaderProps {
  /** The active channel ID. */
  channelId: string | null;
  /** Called when a channel is selected from the dropdown. */
  onSelectChannel: (channel: Channel) => void;
  /** Called when the user clicks create channel. */
  onCreateChannel: () => void;
  /** Called when the user clicks the settings button. */
  onOpenSettings: () => void;
  className?: string;
}

export function ChannelHeader({
  channelId,
  onSelectChannel,
  onCreateChannel,
  onOpenSettings,
  className,
}: ChannelHeaderProps) {
  const wsId = useWorkspaceId();

  const { data: channel, isLoading: channelLoading } = useQuery({
    ...channelDetailOptions(wsId, channelId ?? ''),
    enabled: !!channelId,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    ...channelMemberListOptions(wsId, channelId ?? ''),
    enabled: !!channelId,
  });

  const isLoading = channelLoading || membersLoading;

  return (
    <div
      className={cn(
        'flex h-12 shrink-0 items-center gap-3 border-b px-4',
        className,
      )}
    >
      {isLoading && channelId ? (
        <>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-16" />
        </>
      ) : channelId && channel ? (
        <>
          <ChannelSelect
            activeChannelId={channelId}
            onSelectChannel={onSelectChannel}
            onCreateChannel={onCreateChannel}
          />

          {channel.description && (
            <span className="hidden sm:block text-xs text-muted-foreground truncate max-w-[200px]">
              {channel.description}
            </span>
          )}

          <div className="flex items-center gap-1.5 ml-auto">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span className="tabular-nums">{members.length}</span>
            </div>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onOpenSettings}
              title="Channel settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </div>
        </>
      ) : channelId && !channel ? (
        <span className="text-sm text-muted-foreground">
          Channel not found
        </span>
      ) : (
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-muted-foreground/50" />
          <span className="text-sm text-muted-foreground">
            Select a channel to get started
          </span>
        </div>
      )}
    </div>
  );
}
