"use client";

import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { FileText, BookOpen, Globe, FileCode } from "lucide-react";
import { Badge } from "@multica/ui/components/ui/badge";
import type { WikiDocument } from "@multica/core/types";

const contentTypeIcons: Record<string, React.ReactNode> = {
  markdown: <FileCode className="h-3 w-3" />,
  text: <FileText className="h-3 w-3" />,
  html: <Globe className="h-3 w-3" />,
};

const statusColors: Record<string, string> = {
  indexed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  processing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  archived: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export function WikiDocumentCard({ doc }: { doc: WikiDocument }) {
  const params = useParams<{ workspaceSlug: string; channelSlug: string }>();
  const router = useRouter();

  return (
    <div
      onClick={() =>
        router.push(
          `/${params.workspaceSlug}/channels/${params.channelSlug}/wiki/${doc.id}`,
        )
      }
      className="group flex flex-col gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          <h3 className="text-sm font-medium truncate">{doc.title}</h3>
        </div>
        <Badge
          variant="outline"
          className={`shrink-0 text-xs ${statusColors[doc.status] || ""}`}
        >
          {doc.status}
        </Badge>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          {contentTypeIcons[doc.content_type] || <FileText className="h-3 w-3" />}
          {doc.content_type}
        </span>
        <span>{doc.chunk_count} chunk{doc.chunk_count !== 1 ? "s" : ""}</span>
        <span className="ml-auto">
          {new Date(doc.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}
