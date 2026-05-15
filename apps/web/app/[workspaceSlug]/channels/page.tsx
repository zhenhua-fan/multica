import { Hash } from "lucide-react";

export default function ChannelsIndexPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center max-w-xs">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Hash className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-medium">Select a channel</h2>
          <p className="text-xs text-muted-foreground">
            Choose a channel from the sidebar to view its conversations, or
            create a new channel to get started.
          </p>
        </div>
      </div>
    </div>
  );
}
