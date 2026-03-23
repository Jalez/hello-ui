"use client";

import { ReactNode, useEffect, useState } from "react";
import { useCollaboration } from "@/lib/collaboration";

export function CollaborationNotice({ children }: { children: ReactNode }) {
  const collaboration = useCollaboration();
  const [latchedDuplicateError, setLatchedDuplicateError] = useState<string | null>(null);
  const [isSessionStatusOpen, setIsSessionStatusOpen] = useState(false);
  const isDuplicateBlocked =
    collaboration.error?.toLowerCase().includes("already connected in this game") ||
    collaboration.error?.toLowerCase().includes("duplicate users are blocked") ||
    collaboration.error?.toLowerCase().includes("is already connected.");

  useEffect(() => {
    if (isDuplicateBlocked && collaboration.error) {
      setLatchedDuplicateError(collaboration.error);
    }
  }, [collaboration.error, isDuplicateBlocked]);

  useEffect(() => {
    if (!collaboration.isSessionEvicted) {
      return;
    }
    setIsSessionStatusOpen(false);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      collaboration.reclaimSession();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [collaboration]);

  const shouldShowSessionStatus = collaboration.sessionRole === "readonly";

  useEffect(() => {
    const onOpenReadOnlyStatus = () => {
      if (collaboration.isSessionEvicted) {
        return;
      }
      if (!shouldShowSessionStatus) {
        return;
      }
      setIsSessionStatusOpen(true);
    };
    window.addEventListener("collab:open-readonly-status", onOpenReadOnlyStatus);
    return () => window.removeEventListener("collab:open-readonly-status", onOpenReadOnlyStatus);
  }, [collaboration.isSessionEvicted, shouldShowSessionStatus]);

  if (!collaboration.isSessionEvicted && !collaboration.error && !latchedDuplicateError && !shouldShowSessionStatus) {
    return <>{children}</>;
  }

  if (collaboration.isSessionEvicted) {
    return (
      <>
        {children}
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-amber-400/40 bg-background p-6 shadow-2xl">
            <div className="space-y-5">
              <div className="space-y-1">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">Session conflict</p>
                <h2 className="text-2xl font-semibold text-foreground">Duplicate session detected</h2>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Press <span className="font-semibold text-foreground">Enter</span> to continue in this session and take control. This
                will disconnect the other session (possibly on another device).
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button
                  className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-400 sm:w-auto"
                  onClick={() => collaboration.reclaimSession()}
                >
                  Continue in this session
                </button>
                <button
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted sm:w-auto"
                  onClick={() => collaboration.connectReadOnly()}
                >
                  View read-only
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (isSessionStatusOpen && shouldShowSessionStatus) {
    return (
      <>
        {children}
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-border/60 bg-background p-6 shadow-2xl">
            <div className="space-y-5">
              <div className="space-y-1">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Session status</p>
                <h2 className="text-2xl font-semibold text-foreground">Read-only session</h2>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">You can see live updates, but editing is disabled in this session.</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button
                  className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-400 sm:w-auto"
                  onClick={() => collaboration.reclaimSession()}
                >
                  Take control
                </button>
                <button
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted sm:w-auto"
                  onClick={() => setIsSessionStatusOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (latchedDuplicateError || isDuplicateBlocked) {
    return (
      <>
        {children}
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-amber-400/40 bg-background p-6 shadow-2xl">
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">Connection blocked</p>
                <h2 className="text-2xl font-semibold text-foreground">Duplicate login detected</h2>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{latchedDuplicateError || collaboration.error}</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {children}
    </>
  );
}

