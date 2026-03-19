"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Loader2, Trash2, UserPlus, Wifi, WifiOff } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { apiUrl } from "@/lib/apiUrl";

export interface ActiveGroupInstance {
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

export function CreatorGroupDetailsDialog({
  gameId,
  group,
  open,
  onOpenChange,
  onGroupMembershipChanged,
}: {
  gameId: string;
  group: ActiveGroupInstance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupMembershipChanged?: () => void | Promise<void>;
}) {
  const [detailsPayload, setDetailsPayload] = useState<GroupDetailsPayload | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [memberIdentifier, setMemberIdentifier] = useState("");
  const [memberSuggestions, setMemberSuggestions] = useState<Array<{ userId: string; email: string; name: string | null; label: string }>>([]);
  const [loadingMemberSuggestions, setLoadingMemberSuggestions] = useState(false);
  const [memberActionLoading, setMemberActionLoading] = useState(false);

  const memberOptions: ComboboxOption[] = memberSuggestions.map((suggestion) => ({
    value: suggestion.email,
    label: suggestion.label,
    keywords: [suggestion.email, suggestion.name || "", suggestion.label],
  }));
  const selectedMemberOption = memberOptions.find((option) => option.value === memberIdentifier);

  const fetchGroupDetails = useCallback(async (targetGroup: ActiveGroupInstance) => {
    try {
      setDetailsLoading(true);
      setDetailsError(null);
      const response = await fetch(apiUrl(`/api/games/${gameId}/groups/${targetGroup.groupId}`));
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
    if (!group || !open) {
      setDetailsPayload(null);
      setDetailsError(null);
      setMemberIdentifier("");
      setMemberSuggestions([]);
      return;
    }
    void fetchGroupDetails(group);
  }, [fetchGroupDetails, group, open]);

  useEffect(() => {
    if (!group || memberIdentifier.trim().length < 2) {
      setMemberSuggestions([]);
      setLoadingMemberSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoadingMemberSuggestions(true);
        const response = await fetch(
          apiUrl(`/api/games/${gameId}/groups/${group.groupId}/members?q=${encodeURIComponent(memberIdentifier.trim())}`),
        );
        if (!response.ok) {
          setMemberSuggestions([]);
          return;
        }
        const payload = await response.json();
        setMemberSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : []);
      } catch {
        setMemberSuggestions([]);
      } finally {
        setLoadingMemberSuggestions(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [gameId, group, memberIdentifier]);

  const handleAddOrMoveMember = useCallback(async () => {
    if (!group || !memberIdentifier.trim()) {
      return;
    }
    try {
      setMemberActionLoading(true);
      setDetailsError(null);
      const response = await fetch(apiUrl(`/api/games/${gameId}/groups/${group.groupId}/members`), {
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
      await fetchGroupDetails(group);
      await onGroupMembershipChanged?.();
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : "Failed to add user to group");
    } finally {
      setMemberActionLoading(false);
    }
  }, [fetchGroupDetails, gameId, group, memberIdentifier, onGroupMembershipChanged]);

  const handleRemoveMember = useCallback(async (userId: string) => {
    if (!group) {
      return;
    }
    try {
      setMemberActionLoading(true);
      setDetailsError(null);
      const response = await fetch(
        apiUrl(`/api/games/${gameId}/groups/${group.groupId}/members?userId=${encodeURIComponent(userId)}`),
        { method: "DELETE" },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to remove user from group");
      }
      await fetchGroupDetails(group);
      await onGroupMembershipChanged?.();
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : "Failed to remove user from group");
    } finally {
      setMemberActionLoading(false);
    }
  }, [fetchGroupDetails, gameId, group, onGroupMembershipChanged]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[1200] max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{detailsPayload?.group.name || group?.name || "Group Details"}</DialogTitle>
          <DialogDescription>
            Inspect this group, move an existing user into it, or remove current members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">{detailsPayload?.group ? formatGroupLabel(detailsPayload.group) : group ? formatGroupLabel(group) : "Group"}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {detailsPayload?.group?.joinKey ? `Join key: ${detailsPayload.group.joinKey}` : "Join key unavailable"}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <Combobox
                  value={selectedMemberOption?.value}
                  inputValue={memberIdentifier}
                  onInputChange={setMemberIdentifier}
                  onValueChange={setMemberIdentifier}
                  options={memberOptions}
                  isLoading={loadingMemberSuggestions}
                  loadingText="Loading users..."
                  placeholder="Enter email or exact name"
                  searchPlaceholder="Search users..."
                  emptyText="No users found"
                  disabled={memberActionLoading}
                />
              </div>
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
  );
}
