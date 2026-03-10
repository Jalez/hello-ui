/** @format */
'use client';

import HelpModal from "@/components/Help/Help";
import { useAppSelector } from "@/store/hooks/hooks";
import PoppingTitle from "@/components/General/PoppingTitle";
import Info from "../InfoBoard/Info";
import { useEffect, useState } from "react";
import { Loader2, Users, KeyRound } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useGameStore } from "@/components/default/games";
import { apiUrl } from "@/lib/apiUrl";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
        const response = await fetch(apiUrl(`/api/groups/${groupId}`));
        if (!response.ok || cancelled) {
          return;
        }
        const data = await response.json();
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
    <footer
      className="flex flex-wrap md:flex-nowrap justify-between items-center gap-2 p-2 w-full h-fit shrink-0 text-sm border-t"
    >
      <div className="flex flex-row gap-2 pointer-events-auto">
        <PoppingTitle topTitle="Help">
          <HelpModal />
        </PoppingTitle>
      </div>
      <div className="flex justify-center flex-1 min-w-0">
        <Info />
      </div>
      <div className="flex items-center gap-4">
        {isGroupGameplay && groupId && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="max-w-[220px] gap-2 px-2"
                title="Show group details"
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
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Group Game
                </p>
                <p className="text-sm font-semibold break-words">
                  {groupName || "Unnamed group"}
                </p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Group Join Key</span>
                </div>
                <p className="mt-2 font-mono text-lg tracking-[0.2em]">
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
        <p className="text-sm">
          Inspired by
          <a
            href="https://cssbattle.dev/"
            target="_blank"
            rel="noreferrer"
            className="text-primary m-2 pointer-events-auto"
          >
            <strong>CSS Battle</strong>
          </a>
        </p>
      </div>
    </footer>
  );
};
