"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Edit3,
  Eye,
  Save,
  Archive,
  AlertCircle,
  Loader2,
  FileText,
} from "lucide-react";
import { Button } from "@multica/ui/components/ui/button";
import { Badge } from "@multica/ui/components/ui/badge";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { Textarea } from "@multica/ui/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@multica/ui/components/ui/alert-dialog";
import {
  wikiDocumentDetailOptions,
  useUpdateWikiDocument,
  useArchiveWikiDocument,
} from "@multica/core/wiki";
import { WikiUploadDialog } from "./WikiUploadDialog";

const statusColors: Record<string, string> = {
  indexed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  processing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  archived: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export function WikiEditor({ channelId, docId }: { channelId: string; docId: string }) {
  const params = useParams<{ workspaceSlug: string; channelSlug: string }>();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: doc, isLoading, isError } = useQuery(
    wikiDocumentDetailOptions(channelId, docId),
  );

  const updateMutation = useUpdateWikiDocument(channelId, docId);
  const archiveMutation = useArchiveWikiDocument(channelId);

  const handleEdit = () => {
    setEditContent(doc?.content || "");
    setIsEditing(true);
  };

  const handleSave = async () => {
    await updateMutation.mutateAsync({ content: editContent });
    setIsEditing(false);
  };

  const handleArchive = async () => {
    await archiveMutation.mutateAsync(docId);
    setArchiveOpen(false);
    router.push(
      `/${params.workspaceSlug}/channels/${params.channelSlug}/wiki`,
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-7 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-40 w-full mt-4" />
        </div>
      </div>
    );
  }

  if (isError || !doc) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <AlertCircle className="h-8 w-8 text-destructive/50" />
        <p className="text-sm text-muted-foreground">Document not found</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            router.push(
              `/${params.workspaceSlug}/channels/${params.channelSlug}/wiki`,
            )
          }
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Documents
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() =>
            router.push(
              `/${params.workspaceSlug}/channels/${params.channelSlug}/wiki`,
            )
          }
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium truncate flex-1">{doc.title}</span>
        <Badge
          variant="outline"
          className={`text-xs ${statusColors[doc.status] || ""}`}
        >
          {doc.status}
        </Badge>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 px-4 py-2 border-b text-xs text-muted-foreground bg-muted/30">
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {doc.content_type}
        </span>
        <span>{doc.chunk_count} chunks</span>
        <span>{doc.token_count} tokens</span>
        <span className="ml-auto">
          Updated{" "}
          {new Date(doc.updated_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b">
        {isEditing ? (
          <>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Edit3 className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUploadOpen(true)}
            >
              <FileText className="h-4 w-4 mr-1" />
              Edit Metadata
            </Button>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setArchiveOpen(true)}
            >
              <Archive className="h-4 w-4 mr-1" />
              Archive
            </Button>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isEditing ? (
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-full font-mono text-sm resize-none"
          />
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap font-mono text-sm bg-muted/30 rounded-lg p-4">
              {doc.content}
            </pre>
          </div>
        )}
      </div>

      {/* Archive confirm */}
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Document</AlertDialogTitle>
            <AlertDialogDescription>
              This document will be archived and its chunks will no longer appear
              in search results. You can restore it later from the archived
              documents list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={archiveMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {archiveMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit metadata dialog */}
      <WikiUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        channelId={channelId}
        docId={docId}
        initialTitle={doc.title}
        initialContent={doc.content}
        initialContentType={doc.content_type}
      />
    </div>
  );
}
