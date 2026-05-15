"use client";

import { useQuery } from '@tanstack/react-query';
import { channelListOptions } from '@multica/core/channels';
import { useWorkspaceId } from '@multica/core/hooks';
import { cn } from '@multica/ui/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@multica/ui/components/ui/dropdown-menu';
import { Skeleton } from '@multica/ui/components/ui/skeleton';
import { Hash, ChevronDown, Plus } from 'lucide-react';
import type { Channel } from '@multica/core/types';

export interface ChannelSelectProps {
  /** The currently active channel ID. */
  activeChannelId: string | null;
  /** Called when a channel is selected from the dropdown. */
  onSelectChannel: (channel: Channel) => void;
  /** Called when the user clicks the create channel option. */
  onCreateChannel: () => void;
  className?: string;
}

export function ChannelSelect({
  activeChannelId,
  onSelectChannel,
  onCreateChannel,
  className,
}: ChannelSelectProps) {
  const wsId = useWorkspaceId();
  const { data: channels = [], isLoading } = useQuery(channelListOptions(wsId));

  const activeChannel = activeChannelId
    ? channels.find((c) => c.id === activeChannelId)
    : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium hover:bg-accent/60 transition-colors',
              className,
            )}
          >
            {isLoading ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              <>
                <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate max-w-[160px]">
                  {activeChannel?.name ?? 'Select channel'}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
              </>
            )}
          </button>
        }
      />
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Channels
        </DropdownMenuLabel>
        {isLoading ? (
          <div className="p-2 space-y-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        ) : channels.length === 0 ? (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">
            No channels yet
          </div>
        ) : (
          channels.map((channel) => (
            <DropdownMenuItem
              key={channel.id}
              onClick={() => onSelectChannel(channel)}
              className={cn(
                'flex items-center gap-2',
                channel.id === activeChannelId && 'bg-accent',
              )}
            >
              <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate flex-1">{channel.name}</span>
              {channel.id === activeChannelId && (
                <span className="h-1.5 w-1.5 rounded-full bg-brand shrink-0" />
              )}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onCreateChannel}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          <span>Create Channel</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
