"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { channelListOptions } from '@multica/core/channels';
import { useWorkspaceId } from '@multica/core/hooks';
import type { Channel } from '@multica/core/types';
import { cn } from '@multica/ui/lib/utils';
import {
  Hash,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { Button } from '@multica/ui/components/ui/button';
import { Skeleton } from '@multica/ui/components/ui/skeleton';
import { Tooltip, TooltipTrigger, TooltipContent } from '@multica/ui/components/ui/tooltip';
import { ChannelCreateDialog } from './ChannelCreateDialog';
import { ChannelEmptyState } from './ChannelEmptyState';

export interface ChannelSidebarProps {
  /** The currently active channel ID. */
  activeChannelId: string | null;
  /** Called when a channel is clicked. */
  onSelectChannel: (channel: Channel) => void;
  className?: string;
}

export function ChannelSidebar({
  activeChannelId,
  onSelectChannel,
  className,
}: ChannelSidebarProps) {
  const wsId = useWorkspaceId();

  const { data: channels = [], isLoading, isError } = useQuery(channelListOptions(wsId));

  const [collapsed, setCollapsed] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          'flex flex-col border-r bg-muted/30 transition-all duration-200',
          collapsed ? 'w-10' : 'w-56',
          className,
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'flex h-10 shrink-0 items-center border-b px-2',
            collapsed ? 'justify-center' : 'justify-between',
          )}
        >
          {!collapsed && (
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Channels
            </span>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => setCollapsed(!collapsed)}
                  className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent/60 transition-colors"
                >
                  {collapsed ? (
                    <PanelLeftOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <PanelLeftClose className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              }
            />
            <TooltipContent side="right">
              {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto p-1">
          {isLoading ? (
            <div className="space-y-1 p-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md px-2 py-1.5">
                  <Skeleton className="h-3.5 w-3.5 shrink-0 rounded" />
                  {!collapsed && <Skeleton className="h-3.5 flex-1" />}
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="px-2 py-4 text-center">
              <p className="text-xs text-muted-foreground">
                Failed to load channels
              </p>
            </div>
          ) : channels.length === 0 ? (
            collapsed ? (
              <div className="flex justify-center py-4">
                <Hash className="h-4 w-4 text-muted-foreground/40" />
              </div>
            ) : (
              <ChannelEmptyState
                onCreateChannel={() => setCreateDialogOpen(true)}
                className="py-8"
              />
            )
          ) : (
            <div className="space-y-0.5">
              {channels.map((channel) => {
                const isActive = channel.id === activeChannelId;

                if (collapsed) {
                  return (
                    <Tooltip key={channel.id}>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            onClick={() => onSelectChannel(channel)}
                            className={cn(
                              'flex w-full items-center justify-center rounded-md py-2 hover:bg-accent/60 transition-colors',
                              isActive && 'bg-accent text-accent-foreground',
                            )}
                          >
                            <Hash
                              className={cn(
                                'h-4 w-4',
                                isActive
                                  ? 'text-foreground'
                                  : 'text-muted-foreground',
                              )}
                            />
                          </button>
                        }
                      />
                      <TooltipContent side="right">{channel.name}</TooltipContent>
                    </Tooltip>
                  );
                }

                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => onSelectChannel(channel)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/60 transition-colors group/channel',
                      isActive && 'bg-accent text-accent-foreground',
                    )}
                  >
                    <Hash
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        isActive
                          ? 'text-foreground'
                          : 'text-muted-foreground',
                      )}
                    />
                    <span className="truncate flex-1 text-left">
                      {channel.name}
                    </span>
                    {/* Unread indicator placeholder */}
                    <span
                      className={cn(
                        'hidden h-1.5 w-1.5 rounded-full bg-destructive shrink-0',
                        // Show unread dot for demonstration — replace with real unread logic
                        // channel.unreadCount > 0 && '!inline-block',
                      )}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer: Create Channel button */}
        {!collapsed && (
          <div className="shrink-0 border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create Channel
            </Button>
          </div>
        )}
        {collapsed && (
          <div className="shrink-0 border-t p-1 flex justify-center">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => setCreateDialogOpen(true)}
                    className="flex h-7 w-7 items-center justify-center rounded hover:bg-accent/60 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                }
              />
              <TooltipContent side="right">Create Channel</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      <ChannelCreateDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </>
  );
}
