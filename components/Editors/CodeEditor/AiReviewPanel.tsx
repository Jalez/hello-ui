import { Button } from "@/components/ui/button";

import type { AiReviewState } from "./types";
import type { DiffHunk } from "./lineDiff";

interface AiReviewPanelProps {
  review: AiReviewState;
  onClose: () => void;
  onApplyAccepted: () => void;
  onUpdateHunkStatus: (hunkId: string, status: DiffHunk["status"]) => void;
}

export function AiReviewPanel({
  review,
  onClose,
  onApplyAccepted,
  onUpdateHunkStatus,
}: AiReviewPanelProps) {
  const pendingHunks = review.hunks.filter((hunk) => hunk.status === "pending");
  const acceptedHunks = review.hunks.filter((hunk) => hunk.status === "accepted");

  return (
    <div className="absolute top-1 right-1 z-[120] max-h-60 w-[380px] overflow-auto rounded-md border bg-card p-2 shadow-lg">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">
          AI suggestion review: {pendingHunks.length} pending / {acceptedHunks.length} accepted
        </p>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={onApplyAccepted} disabled={acceptedHunks.length === 0}>
            Apply Accepted
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        {review.hunks.map((hunk, index) => (
          <div key={hunk.id} className="rounded border bg-muted/40 p-2">
            <div className="mb-1 text-[11px] text-muted-foreground">
              Change {index + 1} · lines {hunk.startOld + 1}-{Math.max(hunk.endOld, hunk.startOld + 1)}
            </div>
            <pre className="max-h-24 overflow-auto whitespace-pre-wrap rounded bg-background p-1 text-[11px]">
              {hunk.newLines.join("\n") || "(deletion)"}
            </pre>
            <div className="mt-2 flex gap-1">
              <Button
                size="sm"
                variant={hunk.status === "accepted" ? "default" : "outline"}
                onClick={() => onUpdateHunkStatus(hunk.id, "accepted")}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant={hunk.status === "declined" ? "default" : "outline"}
                onClick={() => onUpdateHunkStatus(hunk.id, "declined")}
              >
                Decline
              </Button>
              <Button
                size="sm"
                variant={hunk.status === "pending" ? "default" : "outline"}
                onClick={() => onUpdateHunkStatus(hunk.id, "pending")}
              >
                Pending
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
