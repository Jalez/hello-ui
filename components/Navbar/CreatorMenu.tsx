"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Code2, Eye, Info, Loader2, Mail, Trash2, UserPlus, Users, Wifi, WifiOff } from "lucide-react";
import { apiUrl, stripBasePath } from "@/lib/apiUrl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

interface GroupDetailMember {
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  userImage?: string | null;
  role?: "instructor" | "member";
  isConnected?: boolean;
}

interface GroupDetailsPayload {
  group: ActiveGroupInstance & { joinKey?: string | null };
  members: GroupDetailMember[];
  extraLiveUsers?: Array<{
    userId: string;
    userEmail?: string | null;
    userName?: string | null;
    isConnected: boolean;
  }>;
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

function getUniqueMemberNames(memberNames?: string[] | null): string[] {
  if (!Array.isArray(memberNames)) {
    return [];
  }
  return Array.from(new Set(memberNames.map((value) => value.trim()).filter(Boolean)));
}

function formatGroupLabel(group: Pick<ActiveGroupInstance, "name" | "memberNames">): string {
  const memberNames = getUniqueMemberNames(group.memberNames);

  if (memberNames.length === 0) {
    return group.name;
  }

  if (memberNames.length === 1) {
    return memberNames[0];
  }

  if (memberNames.length === 2) {
    return `${memberNames[0]}, ${memberNames[1]}`;
  }

  return `${memberNames[0]}, ${memberNames[1]} +${memberNames.length - 2}`;
}

function formatGroupSecondaryLine(group: Pick<ActiveGroupInstance, "name" | "memberNames" | "updatedAt">): string {
  const primaryLabel = formatGroupLabel(group).trim();
  const groupName = group.name.trim();
  const activityLabel = `Last activity ${formatActivityLabel(group.updatedAt)}`;

  if (!groupName || groupName === primaryLabel) {
    return activityLabel;
  }

  return `${groupName} • ${activityLabel}`;
}

export function CreatorMenu({ gameId, collaborationMode }: CreatorMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const normalizedPathname = stripBasePath(pathname);
  const searchParams = useSearchParams();
  const currentGroupId = searchParams.get("groupId");
  const isCreatorRoute = normalizedPathname.startsWith("/creator/");

  const [groups, setGroups] = useState<ActiveGroupInstance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsGroup, setDetailsGroup] = useState<ActiveGroupInstance | null>(null);
  const [detailsPayload, setDetailsPayload] = useState<GroupDetailsPayload | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [memberIdentifier, setMemberIdentifier] = useState("");
  const [memberSuggestions, setMemberSuggestions] = useState<Array<{ userId: string; email: string; name: string | null; label: string }>>([]);
  const [memberActionLoading, setMemberActionLoading] = useState(false);

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

  const fetchGroupDetails = useCallback(async (group: ActiveGroupInstance) => {
    try {
      setDetailsLoading(true);
      setDetailsError(null);
      const response = await fetch(apiUrl(`/api/games/${gameId}/groups/${group.groupId}`));
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load group details");
      }
      setDetailsPayload(payload);
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : "Failed to load group details");
      setDetailsPayload(null);
    } finally {
      setDetailsLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    if (!detailsGroup) {
      setDetailsPayload(null);
      setDetailsError(null);
      setMemberIdentifier("");
      setMemberSuggestions([]);
      return;
    }
    void fetchGroupDetails(detailsGroup);
  }, [detailsGroup, fetchGroupDetails]);

  useEffect(() => {
    if (!detailsGroup || memberIdentifier.trim().length < 2) {
      setMemberSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          apiUrl(`/api/games/${gameId}/groups/${detailsGroup.groupId}/members?q=${encodeURIComponent(memberIdentifier.trim())}`),
        );
        if (!response.ok) {
          setMemberSuggestions([]);
          return;
        }
        const payload = await response.json();
        setMemberSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : []);
      } catch {
        setMemberSuggestions([]);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [detailsGroup, gameId, memberIdentifier]);

  const currentGroup = useMemo(
    () => groups.find((group) => group.groupId === currentGroupId) ?? null,
    [groups, currentGroupId],
  );

  const openCreatorMode = useCallback(() => {
    router.push(apiUrl(`/creator/${gameId}`));
  }, [gameId, router]);

  const openCreatorPreview = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", "game");
    params.delete("groupId");
    router.push(apiUrl(`/game/${gameId}?${params.toString()}`));
  }, [gameId, router, searchParams]);

  const openGroupInstance = useCallback((groupId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", "game");
    params.set("groupId", groupId);
    router.push(apiUrl(`/game/${gameId}?${params.toString()}`));
  }, [gameId, router, searchParams]);

  const openGroupDetails = useCallback((group: ActiveGroupInstance) => {
    setDetailsGroup(group);
  }, []);

  const handleAddOrMoveMember = useCallback(async () => {
    if (!detailsGroup || !memberIdentifier.trim()) {
      return;
    }
    try {
      setMemberActionLoading(true);
      setDetailsError(null);
      const response = await fetch(apiUrl(`/api/games/${gameId}/groups/${detailsGroup.groupId}/members`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: memberIdentifier.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to add user to group");
      }
      setMemberIdentifier("");
      setMemberSuggestions([]);
      await fetchGroupDetails(detailsGroup);
      await fetchGroups();
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : "Failed to add user to group");
    } finally {
      setMemberActionLoading(false);
    }
  }, [detailsGroup, fetchGroupDetails, fetchGroups, gameId, memberIdentifier]);

  const handleRemoveMember = useCallback(async (userId: string) => {
    if (!detailsGroup) {
      return;
    }
    try {
      setMemberActionLoading(true);
      setDetailsError(null);
      const response = await fetch(
        apiUrl(`/api/games/${gameId}/groups/${detailsGroup.groupId}/members?userId=${encodeURIComponent(userId)}`),
        { method: "DELETE" },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to remove user from group");
      }
      await fetchGroupDetails(detailsGroup);
      await fetchGroups();
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : "Failed to remove user from group");
    } finally {
      setMemberActionLoading(false);
    }
  }, [detailsGroup, fetchGroupDetails, fetchGroups, gameId]);

  const triggerLabel = isCreatorRoute
    ? "Creator"
    : currentGroup
      ? formatGroupLabel(currentGroup)
      : "Creator";

  return (
    <>
      <TooltipProvider delayDuration={200}>
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
                    <DropdownMenuItem
                      key={group.groupId}
                      onSelect={() => openGroupInstance(group.groupId)}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">
                          {formatGroupLabel(group)}
                          {group.groupId === currentGroupId ? " (Current)" : ""}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatGroupSecondaryLine(group)}
                        </span>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              openGroupDetails(group);
                            }}
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">Show group details</TooltipContent>
                      </Tooltip>
                    </DropdownMenuItem>
                  ))
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>

      <Dialog open={Boolean(detailsGroup)} onOpenChange={(open) => !open && setDetailsGroup(null)}>
        <DialogContent className="z-[1200] max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailsPayload?.group.name || detailsGroup?.name || "Group Details"}</DialogTitle>
            <DialogDescription>
              Inspect this group, move an existing user into it, or remove current members.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border p-3 text-sm">
              <div className="font-medium">{detailsPayload?.group ? formatGroupLabel(detailsPayload.group) : detailsGroup ? formatGroupLabel(detailsGroup) : "Group"}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {detailsPayload?.group?.joinKey ? `Join key: ${detailsPayload.group.joinKey}` : "Join key unavailable"}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={memberIdentifier}
                  onChange={(event) => setMemberIdentifier(event.target.value)}
                  list="creator-group-member-suggestions"
                  autoComplete="off"
                  placeholder="Enter email or exact name"
                  disabled={memberActionLoading}
                />
                <datalist id="creator-group-member-suggestions">
                  {memberSuggestions.map((suggestion) => (
                    <option key={suggestion.userId} value={suggestion.email}>
                      {suggestion.label}
                    </option>
                  ))}
                </datalist>
                <Button variant="outline" onClick={handleAddOrMoveMember} disabled={memberActionLoading || !memberIdentifier.trim()}>
                  <UserPlus className="mr-1 h-4 w-4" />
                  Add / Move
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter an existing user by email or exact name. If they already belong to another active group instance in this game, they will be moved here.
              </p>
            </div>

            {detailsError && <p className="text-sm text-destructive">{detailsError}</p>}

            <div className="space-y-2">
              {detailsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading group details...
                </div>
              ) : !detailsPayload ? (
                <p className="text-sm text-muted-foreground">No group details available.</p>
              ) : detailsPayload.members.length === 0 ? (
                <p className="text-sm text-muted-foreground">This group has no persisted members yet.</p>
              ) : (
                detailsPayload.members.map((member) => {
                  const label = member.userName || member.userEmail || member.userId;
                  return (
                    <div key={member.userId} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{label}</span>
                          {member.isConnected ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                              <Wifi className="h-3 w-3" />
                              Connected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <WifiOff className="h-3 w-3" />
                              Offline
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{member.userEmail || "No email"}</span>
                        </div>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            disabled={memberActionLoading}
                            onClick={() => handleRemoveMember(member.userId)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">Remove this user from the group</TooltipContent>
                      </Tooltip>
                    </div>
                  );
                })
              )}
            </div>

            {detailsPayload?.extraLiveUsers?.length ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                Extra connected users not found in persisted group membership:{" "}
                {detailsPayload.extraLiveUsers
                  .map((user) => user.userName || user.userEmail || user.userId)
                  .join(", ")}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
