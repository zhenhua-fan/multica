"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  channelDetailOptions,
  channelMemberListOptions,
  useUpdateChannel,
  useArchiveChannel,
} from '@multica/core/channels';
import { useWorkspaceId } from '@multica/core/hooks';
import { useWorkspacePaths } from '@multica/core/paths';
import { useNavigation } from '../navigation';
import type { Channel } from '@multica/core/types';
import { cn } from '@multica/ui/lib/utils';
import { toast } from 'sonner';
import {
  Settings,
  Hash,
  Users,
  Calendar,
  Archive,
  Loader2,
} from 'lucide-react';
import { Button } from '@multica/ui/components/ui/button';
import { Input } from '@multica/ui/components/ui/input';
import { Label } from '@multica/ui/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@multica/ui/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@multica/ui/components/ui/alert-dialog';
import { Skeleton } from '@multica/ui/components/ui/skeleton';

export interface ChannelSettingsProps {
  channelId: string;
  open: boolean;
  onClose: () => void;
}

export function ChannelSettings({
  channelId,
  open,
  onClose,
}: ChannelSettingsProps) {
  const wsId = useWorkspaceId();
  const wsPaths = useWorkspacePaths();
  const router = useNavigation();

  const { data: channel, isLoading } = useQuery({
    ...channelDetailOptions(wsId, channelId),
    enabled: open && !!channelId,
  });

  const { data: members = [] } = useQuery({
    ...channelMemberListOptions(wsId, channelId),
    enabled: open && !!channelId,
  });

  const updateChannel = useUpdateChannel(wsId);
  const archiveChannel = useArchiveChannel(wsId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);

  // Sync form state from fetched channel
  if (channel && !initialized) {
    setName(channel.name);
    setDescription(channel.description ?? '');
    setInitialized(true);
  }

  const handleSave = () => {
    if (!name.trim()) return;
    updateChannel.mutate(
      {
        channelId,
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
        },
      },
      {
        onSuccess: () => toast.success('Channel updated'),
        onError: () => toast.error('Failed to update channel'),
      },
    );
  };

  const handleArchive = () => {
    archiveChannel.mutate(channelId, {
      onSuccess: () => {
        toast.success('Channel archived');
        setArchiveConfirmOpen(false);
        onClose();
        router.push(wsPaths.root());
      },
      onError: () => toast.error('Failed to archive channel'),
    });
  };

  const createdDate = channel?.created_at
    ? new Date(channel.created_at).toLocaleDateString()
    : null;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) {
            setInitialized(false);
            onClose();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              Channel Settings
            </DialogTitle>
            <DialogDescription>
              Manage channel name, description, and danger zone.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-8 w-32" />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">
                  Channel Name
                </Label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">
                  Description
                </Label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
              </div>

              {/* Channel info */}
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Hash className="h-3.5 w-3.5" />
                  <span className="font-mono">{channel?.slug}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span>{members.length} member{members.length !== 1 ? 's' : ''}</span>
                </div>
                {createdDate && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Created {createdDate}</span>
                  </div>
                )}
              </div>

              {/* Danger zone */}
              <div className="rounded-md border border-destructive/30 p-3 space-y-2">
                <p className="text-xs font-medium text-destructive">
                  Danger Zone
                </p>
                <p className="text-xs text-muted-foreground">
                  Archiving a channel will hide it from the sidebar and prevent
                  new messages. This action can be reversed by an admin.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setArchiveConfirmOpen(true)}
                  disabled={archiveChannel.isPending}
                >
                  {archiveChannel.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Archive className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Archive Channel
                </Button>
              </div>
            </div>
          )}

          <DialogFooter showCloseButton>
            <Button
              onClick={handleSave}
              disabled={!name.trim() || updateChannel.isPending}
            >
              {updateChannel.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={archiveConfirmOpen}
        onOpenChange={setArchiveConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Channel</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive{' '}
              <strong>{channel?.name ?? 'this channel'}</strong>? It will be
              hidden from the sidebar but can be restored later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={archiveChannel.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {archiveChannel.isPending ? 'Archiving…' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
