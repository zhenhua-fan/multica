"use client";

import { Hash, Plus } from 'lucide-react';
import { Button } from '@multica/ui/components/ui/button';
import { cn } from '@multica/ui/lib/utils';

export interface ChannelEmptyStateProps {
  /** Called when the user clicks the create button. */
  onCreateChannel: () => void;
  className?: string;
}

export function ChannelEmptyState({
  onCreateChannel,
  className,
}: ChannelEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-16 text-center',
        className,
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Hash className="h-8 w-8 text-muted-foreground/60" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          No channels yet
        </p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Create your first channel to start collaborating with your team.
          Channels keep conversations organized by topic.
        </p>
      </div>
      <Button size="sm" onClick={onCreateChannel}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Create your first channel
      </Button>
    </div>
  );
}
