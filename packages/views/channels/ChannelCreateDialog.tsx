"use client";

import { useState } from 'react';
import { useCreateChannel } from '@multica/core/channels';
import { useWorkspaceId } from '@multica/core/hooks';
import { useWorkspacePaths } from '@multica/core/paths';
import { useNavigation } from '../navigation';
import { cn } from '@multica/ui/lib/utils';
import { toast } from 'sonner';
import { Hash } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@multica/ui/components/ui/dialog';
import { Button } from '@multica/ui/components/ui/button';
import { Input } from '@multica/ui/components/ui/input';
import { Label } from '@multica/ui/components/ui/label';

/**
 * Auto-generate a URL-friendly slug from a name.
 * Lowercase, replace non-alphanumerics with hyphens, collapse multiple hyphens.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export interface ChannelCreateDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ChannelCreateDialog({
  open,
  onClose,
}: ChannelCreateDialogProps) {
  const wsId = useWorkspaceId();
  const wsPaths = useWorkspacePaths();
  const router = useNavigation();
  const createChannel = useCreateChannel(wsId);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugManuallyEdited) {
      setSlug(slugify(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true);
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
  };

  const isValid = name.trim().length > 0 && slug.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid || createChannel.isPending) return;
    try {
      const channel = await createChannel.mutateAsync({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
      });
      toast.success(`Channel "${channel.name}" created`);
      reset();
      onClose();
      router.push(wsPaths.root());
    } catch {
      toast.error('Failed to create channel');
    }
  };

  const reset = () => {
    setName('');
    setSlug('');
    setDescription('');
    setSlugManuallyEdited(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Channel</DialogTitle>
          <DialogDescription>
            Channels keep conversations organized by topic. Choose a name and
            slug for your new channel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. general, engineering, design"
              className="mt-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Slug</Label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <Input
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="auto-generated-from-name"
                className={cn(
                  'pl-7',
                  slug.length > 0 &&
                    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) &&
                    'border-destructive focus-visible:ring-destructive',
                )}
              />
            </div>
            {slug.length > 0 && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && (
              <p className="mt-1 text-[11px] text-destructive">
                Slug must contain only lowercase letters, numbers, and hyphens.
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">
              Description <span className="text-muted-foreground/50">(optional)</span>
            </Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this channel about?"
              rows={3}
              className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>
        </div>

        <DialogFooter showCloseButton>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || createChannel.isPending}
          >
            {createChannel.isPending ? 'Creating…' : 'Create Channel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
