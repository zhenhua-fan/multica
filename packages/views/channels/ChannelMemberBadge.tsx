"use client";

import { cn } from '@multica/ui/lib/utils';
import type { ChannelMemberRole } from '@multica/core/types';

const ROLE_CONFIG: Record<ChannelMemberRole, { label: string; className: string }> = {
  owner: {
    label: 'Owner',
    className:
      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  },
  admin: {
    label: 'Admin',
    className:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  member: {
    label: 'Member',
    className:
      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700',
  },
  viewer: {
    label: 'Viewer',
    className:
      'bg-transparent text-muted-foreground border-muted-foreground/30',
  },
};

export interface ChannelMemberBadgeProps {
  role: ChannelMemberRole;
  className?: string;
}

export function ChannelMemberBadge({ role, className }: ChannelMemberBadgeProps) {
  const config = ROLE_CONFIG[role] ?? ROLE_CONFIG.member;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
