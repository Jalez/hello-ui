/** @format */
'use client';

import { useAppSelector } from "@/store/hooks/hooks";
import { HelpModal } from "@/components/Help/HelpModal";
import Info, { LevelFooterMenu, TimeFooterMenu, footerMenuButtonClass } from "../InfoBoard/Info";
import { useEffect, useState } from "react";
import { Loader2, Users, KeyRound, HelpCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useGameStore } from "@/components/default/games";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchGroupDetailsCached } from "@/lib/group-details-client";

function useRelativeTime(timestamp: number | null): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!timestamp) {
      return undefined;
    }

    const update = () => {
      const seconds = Math.floor((Date.now() - timestamp) / 1000);
      if (seconds < 10) setLabel("just now");
      else if (seconds < 60) setLabel(`${seconds}s ago`);
      else setLabel(`${Math.floor(seconds / 60)}m ago`);
    };

    update();
    const id = setInterval(update, 5000);
    return () => clearInterval(id);
  }, [timestamp]);

  return timestamp ? label : null;
}

export const Footer = () => {
  const options = useAppSelector((state) => state.options);
  const lastSavedLabel = useRelativeTime(options.lastSaved);
  const searchParams = useSearchParams();
  const currentGame = useGameStore((state) => state.getCurrentGame());
  const groupId = searchParams.get("groupId");
  const [groupName, setGroupName] = useState<string | null>(null);
  const [groupJoinKey, setGroupJoinKey] = useState<string | null>(null);
  const [isLoadingGroup, setIsLoadingGroup] = useState(false);
  const isGroupGameplay = currentGame?.collaborationMode === "group" && Boolean(groupId);

  useEffect(() => {
    if (!isGroupGameplay || !groupId) {
      setGroupName(null);
      setGroupJoinKey(null);
      setIsLoadingGroup(false);
      return;
    }

    let cancelled = false;

    const loadGroupDetails = async () => {
      try {
        setIsLoadingGroup(true);
        const data = await fetchGroupDetailsCached(groupId);
        if (cancelled) {
          return;
        }
        setGroupName(data.group?.name ?? null);
        setGroupJoinKey(data.group?.joinKey ?? null);
      } catch {
        if (!cancelled) {
          setGroupName(null);
          setGroupJoinKey(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingGroup(false);
        }
      }
    };

    loadGroupDetails();
    return () => {
      cancelled = true;
    };
  }, [groupId, isGroupGameplay]);

  return (
    <footer className="w-full h-fit shrink-0 border-t p-2 text-sm">
      <div className="flex items-center gap-2 xl:hidden">
        <div className="flex flex-1 min-w-0">
          <HelpModal
            mode={options.creator ? "creator" : "game"}
            trigger={(
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={footerMenuButtonClass}
              >
                <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground min-[520px]:hidden">
                  Help
                </span>
                <HelpCircle className="h-4 w-4" />
                <span className="hidden min-[520px]:inline text-xs font-medium">Help</span>
              </Button>
            )}
          />
        </div>
        <div className="flex flex-1 min-w-0">
          <LevelFooterMenu />
        </div>
        <div className="flex flex-1 min-w-0">
          <TimeFooterMenu />
        </div>
        {isGroupGameplay && groupId ? (
          <div className="flex flex-1 min-w-0">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={footerMenuButtonClass}
                >
                  <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground min-[520px]:hidden">
                    Group
                  </span>
                  {isLoadingGroup ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                  <span className="hidden min-[520px]:inline truncate text-xs font-medium">
                    {groupName || "Group"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="end" className="w-72 space-y-3">
                <div className="rounded-md border bg-muted/40 p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>Group Game</span>
                  </div>
                  <p className="mt-2 break-words text-sm font-semibold text-foreground">
                    {groupName || "Unnamed group"}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>Join Key</span>
                  </div>
                  <p className="mt-2 rounded-sm bg-background/80 px-2 py-1 font-mono text-lg tracking-[0.2em]">
                    {groupJoinKey || "Unavailable"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Share this key with teammates if they need to join the same group.
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        ) : (
          <div className="flex-1" />
        )}
      </div>

      <div className="hidden xl:flex items-center gap-2">
        <div className="flex flex-1 min-w-0 items-center pointer-events-auto">
          <HelpModal
            mode={options.creator ? "creator" : "game"}
            trigger={(
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={footerMenuButtonClass}
              >
                <HelpCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Help</span>
              </Button>
            )}
          />
        </div>
        <div className="flex flex-[2] min-w-0 justify-center">
          <Info />
        </div>
        <div className="flex flex-1 min-w-0 items-center justify-end gap-0">
          {isGroupGameplay && groupId && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={footerMenuButtonClass}
                >
                  {isLoadingGroup ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                  <span className="truncate text-xs font-medium">
                    {groupName || "Group"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="end" className="w-72 space-y-3">
                <div className="rounded-md border bg-muted/40 p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>Group Game</span>
                  </div>
                  <p className="mt-2 break-words text-sm font-semibold text-foreground">
                    {groupName || "Unnamed group"}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>Join Key</span>
                  </div>
                  <p className="mt-2 rounded-sm bg-background/80 px-2 py-1 font-mono text-lg tracking-[0.2em]">
                    {groupJoinKey || "Unavailable"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Share this key with teammates if they need to join the same group.
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          )}
          {options.creator && (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              {options.isSavingLevel ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving changes...</span>
                </>
              ) : (
                <span>{lastSavedLabel ? `Saved ${lastSavedLabel}` : "Unsaved"}</span>
              )}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
};
