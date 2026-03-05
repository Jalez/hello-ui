"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Code2, Eye, Loader2, Users } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ActiveGroupInstance {
  groupId: string;
  instanceId: string;
  name: string;
  memberNames: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

interface CreatorMenuProps {
  gameId: string;
  collaborationMode: "individual" | "group";
}

function formatActivityLabel(value: string | null): string {
  if (!value) {
    return "No activity timestamp";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Activity time unavailable";
  }

  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatGroupLabel(group: Pick<ActiveGroupInstance, "name" | "memberNames">): string {
  if (group.memberNames.length === 0) {
    return group.name;
  }

  if (group.memberNames.length === 1) {
    return group.memberNames[0];
  }

  if (group.memberNames.length === 2) {
    return `${group.memberNames[0]}, ${group.memberNames[1]}`;
  }

  return `${group.memberNames[0]}, ${group.memberNames[1]} +${group.memberNames.length - 2}`;
}

export function CreatorMenu({ gameId, collaborationMode }: CreatorMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentGroupId = searchParams.get("groupId");
  const isCreatorRoute = pathname.startsWith("/creator/");

  const [groups, setGroups] = useState<ActiveGroupInstance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    if (collaborationMode !== "group") {
      setGroups([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(apiUrl(`/api/games/${gameId}/groups`));
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to load active groups");
      }

      const payload = await response.json();
      setGroups(Array.isArray(payload.groups) ? payload.groups : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load active groups");
    } finally {
      setIsLoading(false);
    }
  }, [collaborationMode, gameId]);

  useEffect(() => {
    void fetchGroups();
  }, [fetchGroups]);

  const currentGroup = useMemo(
    () => groups.find((group) => group.groupId === currentGroupId) ?? null,
    [groups, currentGroupId],
  );

  const openCreatorMode = useCallback(() => {
    router.push(`/creator/${gameId}`);
  }, [gameId, router]);

  const openCreatorPreview = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", "game");
    params.delete("groupId");
    router.push(`/game/${gameId}?${params.toString()}`);
  }, [gameId, router, searchParams]);

  const openGroupInstance = useCallback((groupId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", "game");
    params.set("groupId", groupId);
    router.push(`/game/${gameId}?${params.toString()}`);
  }, [gameId, router, searchParams]);

  const triggerLabel = isCreatorRoute
    ? "Creator"
    : currentGroup
      ? formatGroupLabel(currentGroup)
      : "Creator";

  return (
    <DropdownMenu onOpenChange={(open) => {
      if (open) {
        void fetchGroups();
      }
    }}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="gap-2">
          <Users className="h-4 w-4" />
          <span>{triggerLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 border-0 shadow-lg">
        <DropdownMenuLabel>Creator</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!isCreatorRoute && (
          <DropdownMenuItem onSelect={openCreatorMode}>
            <Code2 className="mr-2 h-4 w-4" />
            Switch to Creator Mode
          </DropdownMenuItem>
        )}
        {collaborationMode === "group" && (
          <DropdownMenuItem onSelect={openCreatorPreview}>
            <Eye className="mr-2 h-4 w-4" />
            <div className="flex flex-col">
              <span>Creator Preview</span>
              <span className="text-xs text-muted-foreground">
                Open the isolated preview without a group
              </span>
            </div>
          </DropdownMenuItem>
        )}
        {collaborationMode === "group" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Active Group Instances</DropdownMenuLabel>
            {isLoading ? (
              <DropdownMenuItem disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading active groups...
              </DropdownMenuItem>
            ) : error ? (
              <DropdownMenuItem disabled>{error}</DropdownMenuItem>
            ) : groups.length === 0 ? (
              <DropdownMenuItem disabled>No group instances yet</DropdownMenuItem>
            ) : (
              groups.map((group) => (
                <DropdownMenuItem key={group.groupId} onSelect={() => openGroupInstance(group.groupId)}>
                  <div className="flex flex-col">
                    <span>{formatGroupLabel(group)}{group.groupId === currentGroupId ? " (Current)" : ""}</span>
                    <span className="text-xs text-muted-foreground">
                      {group.name} • Last activity {formatActivityLabel(group.updatedAt)}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
