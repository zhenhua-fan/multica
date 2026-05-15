"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@multica/ui/components/ui/dialog";
import { Button } from "@multica/ui/components/ui/button";
import { Input } from "@multica/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@multica/ui/components/ui/select";
import { Textarea } from "@multica/ui/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useCreateWikiDocument, useUpdateWikiDocument } from "@multica/core/wiki";

interface WikiUploadDialogProps {
  open: boolean;
  onClose: () => void;
  channelId: string;
  docId?: string;
  initialTitle?: string;
  initialContent?: string;
  initialContentType?: string;
}

export function WikiUploadDialog({
  open,
  onClose,
  channelId,
  docId,
  initialTitle = "",
  initialContent = "",
  initialContentType = "markdown",
}: WikiUploadDialogProps) {
  const isEdit = !!docId;
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [contentType, setContentType] = useState(initialContentType);

  const createMutation = useCreateWikiDocument(channelId);
  const updateMutation = useUpdateWikiDocument(channelId, docId || "");

  const isPending = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setContent(initialContent);
      setContentType(initialContentType);
    }
  }, [open, initialTitle, initialContent, initialContentType]);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    try {
      if (isEdit && docId) {
        await updateMutation.mutateAsync({ title: title.trim(), content: content.trim() });
      } else {
        await createMutation.mutateAsync({
          title: title.trim(),
          content: content.trim(),
          content_type: contentType,
        });
      }
      onClose();
    } catch {
      // error handled by mutation state
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Document" : "New Wiki Document"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the document content. Changes will be re-indexed automatically."
              : "Create a new knowledge base document for your channel."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              placeholder="Document title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Content Type</label>
            <Select value={contentType} onValueChange={setContentType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="markdown">Markdown</SelectItem>
                <SelectItem value="text">Plain Text</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Content</label>
            <Textarea
              placeholder="Write your document content here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || !content.trim() || isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Document"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
