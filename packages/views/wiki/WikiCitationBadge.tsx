"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";

interface WikiCitationBadgeProps {
  documentId: string;
  documentTitle: string;
  workspaceSlug: string;
  channelSlug: string;
}

export function WikiCitationBadge({
  documentId,
  documentTitle,
  workspaceSlug,
  channelSlug,
}: WikiCitationBadgeProps) {
  return (
    <Link
      href={`/${workspaceSlug}/channels/${channelSlug}/wiki/${documentId}`}
      className="inline-flex items-center gap-1 rounded-md border bg-accent/50 px-2 py-0.5 text-xs font-medium text-accent-foreground hover:bg-accent transition-colors"
    >
      <BookOpen className="h-3 w-3" />
      <span className="truncate max-w-[200px]">{documentTitle}</span>
    </Link>
  );
}
