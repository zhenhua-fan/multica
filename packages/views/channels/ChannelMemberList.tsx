"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  channelMemberListOptions,
  useAddChannelMember,
  useUpdateChannelMember,
  useRemoveChannelMember,
} from '@multica/core/channels';
import { useWorkspaceId } from '@multica/core/hooks';
import { memberListOptions } from '@multica/core/workspace/queries';
import type { ChannelMember, ChannelMemberRole, Member } from '@multica/core/types';
import { Button } from '@multica/ui/components/ui/button';
import { Input } from '@multica/ui/components/ui/input';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@multica/ui/components/ui/dropdown-menu';
import { Skeleton } from '@multica/ui/components/ui/skeleton';
import { cn } from '@multica/ui/lib/utils';
import { toast } from 'sonner';
import {
  UserPlus,
  MoreHorizontal,
  Shield,
  Eye,
  User,
  Crown,
  Search,
  Trash2,
} from 'lucide-react';
import { ChannelMemberBadge } from './ChannelMemberBadge';

const ROLE_OPTIONS: { role: ChannelMemberRole; label: string; icon: typeof Shield }[] = [
  { role: 'owner', label: 'Owner', icon: Crown },
  { role: 'admin', label: 'Admin', icon: Shield },
  { role: 'member', label: 'Member', icon: User },
  { role: 'viewer', label: 'Viewer', icon: Eye },
];

export interface ChannelMemberListProps {
  channelId: string;
  /** The role of the current user in this channel (controls which actions are shown). */
  currentUserRole?: ChannelMemberRole;
  className?: string;
}

export function ChannelMemberList({
  channelId,
  currentUserRole,
  className,
}: ChannelMemberListProps) {
  const wsId = useWorkspaceId();
  const { data: members = [], isLoading, isError } = useQuery({
    ...channelMemberListOptions(wsId, channelId),
    enabled: !!channelId,
  });
  const { data: workspaceMembers = [] } = useQuery(memberListOptions(wsId));

  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ChannelMember | null>(null);

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-center justify-between px-1 py-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Members ({members.length})
        </span>
        {currentUserRole && currentUserRole !== 'viewer' && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setAddOpen(true)}
            title="Add member"
          >
            <UserPlus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2 p-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-4 w-12 rounded-full ml-auto" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <p className="px-1 py-4 text-center text-xs text-muted-foreground">
          Failed to load members.
        </p>
      ) : members.length === 0 ? (
        <p className="px-1 py-4 text-center text-xs text-muted-foreground">
          No members in this channel.
        </p>
      ) : (
        <div className="space-y-0.5">
          {members.map((member) => (
            <ChannelMemberRow
              key={member.id}
              member={member}
              currentUserRole={currentUserRole}
              wsId={wsId}
              channelId={channelId}
              onRemove={() => setRemoveTarget(member)}
            />
          ))}
        </div>
      )}

      {addOpen && (
        <AddMemberDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          wsId={wsId}
          channelId={channelId}
          existingMemberIds={new Set(members.map((m) => m.user_id))}
          workspaceMembers={workspaceMembers}
        />
      )}

      {removeTarget && (
        <RemoveMemberConfirm
          member={removeTarget}
          open
          onClose={() => setRemoveTarget(null)}
          wsId={wsId}
          channelId={channelId}
        />
      )}
    </div>
  );
}

function ChannelMemberRow({
  member,
  currentUserRole,
  wsId,
  channelId,
  onRemove,
}: {
  member: ChannelMember;
  currentUserRole?: ChannelMemberRole;
  wsId: string;
  channelId: string;
  onRemove: () => void;
}) {
  const updateMember = useUpdateChannelMember(wsId, channelId);
  const canManage =
    currentUserRole === 'owner' ||
    (currentUserRole === 'admin' && member.role !== 'owner');

  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors group/member">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
        {(member.display_name ?? member.user_id).charAt(0).toUpperCase()}
      </div>
      <span className="flex-1 truncate text-sm">
        {member.display_name ?? member.user_id}
      </span>
      <ChannelMemberBadge role={member.role} />

      {canManage && member.role !== 'owner' && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="ml-1 hidden group-hover/member:flex h-6 w-6 items-center justify-center rounded hover:bg-accent transition-colors"
              >
                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-40">
            {ROLE_OPTIONS.filter((r) => r.role !== 'owner' && r.role !== member.role).map(
              (opt) => (
                <DropdownMenuItem
                  key={opt.role}
                  onClick={() => {
                    updateMember.mutate(
                      {
                        memberId: member.id,
                        data: { role: opt.role },
                      },
                      {
                        onSuccess: () =>
                          toast.success(`Role changed to ${opt.label}`),
                        onError: () =>
                          toast.error('Failed to change role'),
                      },
                    );
                  }}
                >
                  <opt.icon className="h-3.5 w-3.5 mr-1.5" />
                  <span>Make {opt.label}</span>
                </DropdownMenuItem>
              ),
            )}
            <DropdownMenuItem
              onClick={onRemove}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              <span>Remove</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function AddMemberDialog({
  open,
  onClose,
  wsId,
  channelId,
  existingMemberIds,
  workspaceMembers,
}: {
  open: boolean;
  onClose: () => void;
  wsId: string;
  channelId: string;
  existingMemberIds: Set<string>;
  workspaceMembers: Member[];
}) {
  const addMember = useAddChannelMember(wsId, channelId);
  const [search, setSearch] = useState('');

  const filtered = workspaceMembers.filter(
    (m) =>
      !existingMemberIds.has(m.user_id) &&
      m.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Member</DialogTitle>
          <DialogDescription>
            Search for workspace members to add to this channel.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members..."
            className="pl-8 h-8 text-sm"
          />
        </div>

        <div className="max-h-60 overflow-y-auto space-y-0.5">
          {filtered.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-6">
              {search ? 'No matching members found.' : 'All workspace members are already in this channel.'}
            </p>
          ) : (
            filtered.map((m) => (
              <button
                key={m.user_id}
                type="button"
                onClick={() => {
                  addMember.mutate(
                    { user_id: m.user_id },
                    {
                      onSuccess: () => {
                        toast.success(`${m.name} added to channel`);
                        onClose();
                      },
                      onError: () => toast.error('Failed to add member'),
                    },
                  );
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <span className="truncate">{m.name}</span>
              </button>
            ))
          )}
        </div>

        <DialogFooter showCloseButton>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={addMember.isPending}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemoveMemberConfirm({
  member,
  open,
  onClose,
  wsId,
  channelId,
}: {
  member: ChannelMember;
  open: boolean;
  onClose: () => void;
  wsId: string;
  channelId: string;
}) {
  const removeMember = useRemoveChannelMember(wsId, channelId);

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Member</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove{' '}
            <strong>{member.display_name ?? member.user_id}</strong> from this
            channel? They can be re-added later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              removeMember.mutate(member.id, {
                onSuccess: () => {
                  toast.success('Member removed');
                  onClose();
                },
                onError: () => toast.error('Failed to remove member'),
              });
            }}
            disabled={removeMember.isPending}
          >
            {removeMember.isPending ? 'Removing…' : 'Remove'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
