"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Group {
  id: string;
  name: string;
  ltiContextId?: string;
  ltiContextTitle?: string;
  resourceLinkId?: string;
  createdBy?: string | null;
  isMember?: boolean;
}

interface GroupSelectorProps {
  selectedGroupId?: string | null;
  onGroupSelect: (groupId: string, options?: { joinKey?: string }) => void | Promise<void>;
  className?: string;
  showRefreshButton?: boolean;
  allowCreate?: boolean;
  createContext?: {
    ltiContextId?: string | null;
    ltiContextTitle?: string | null;
    resourceLinkId?: string | null;
  };
  createPlaceholder?: string;
  currentUserId?: string | null;
}

function buildGroupMeta(group: Group): string | null {
  const parts: string[] = [];

  if (group.ltiContextTitle && group.ltiContextTitle.trim() !== group.name.trim()) {
    parts.push(group.ltiContextTitle.trim());
  }

  parts.push(`ID ${group.id.slice(0, 8)}`);
  return parts.join(" • ");
}

function buildGroupLabel(group: Group): string {
  const meta = buildGroupMeta(group);
  return meta ? `${group.name} (${meta})` : group.name;
}

export function GroupSelector({
  selectedGroupId,
  onGroupSelect,
  className,
  showRefreshButton = false,
  allowCreate = false,
  createContext,
  createPlaceholder = "Create a new group",
  currentUserId,
}: GroupSelectorProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [pendingGroupId, setPendingGroupId] = useState<string>(selectedGroupId || "");
  const [joinKey, setJoinKey] = useState("");

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.name.localeCompare(b.name)),
    [groups]
  );
  const selectedGroup = sortedGroups.find((group) => group.id === pendingGroupId) ?? null;
  const requiresJoinKey = Boolean(
    selectedGroup &&
    !selectedGroup.isMember &&
    selectedGroup.createdBy !== currentUserId
  );

  const fetchGroups = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (createContext?.ltiContextId) {
        params.set("ltiContextId", createContext.ltiContextId);
      }
      if (createContext?.resourceLinkId) {
        params.set("resourceLinkId", createContext.resourceLinkId);
      }

      const response = await fetch(
        params.size > 0 ? `${apiUrl("/api/groups")}?${params.toString()}` : apiUrl("/api/groups")
      );

      if (!response.ok) {
        throw new Error("Failed to fetch groups");
      }

      const { groups: fetchedGroups } = await response.json();
      setGroups(fetchedGroups);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch groups");
    } finally {
      setIsLoading(false);
    }
  }, [createContext?.ltiContextId, createContext?.resourceLinkId]);

  const handleCreateGroup = async () => {
    const trimmedName = createName.trim();
    if (!trimmedName) {
      setError("Group name is required");
      return;
    }

    try {
      setIsCreating(true);
      setError(null);
      const response = await fetch(apiUrl("/api/groups"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          ...(createContext?.ltiContextId ? { ltiContextId: createContext.ltiContextId } : {}),
          ...(createContext?.ltiContextTitle ? { ltiContextTitle: createContext.ltiContextTitle } : {}),
          ...(createContext?.resourceLinkId ? { resourceLinkId: createContext.resourceLinkId } : {}),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.group?.id) {
        throw new Error(data.error || "Failed to create group");
      }

      setCreateName("");
      await fetchGroups();
      setPendingGroupId(data.group.id);
      await onGroupSelect(data.group.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenSelectedGroup = async () => {
    if (!selectedGroup) {
      return;
    }

    try {
      setError(null);
      await onGroupSelect(selectedGroup.id, requiresJoinKey ? { joinKey } : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open group");
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    setPendingGroupId(selectedGroupId || "");
  }, [selectedGroupId]);

  if (isLoading) {
    return (
      <div className={className}>
        <Select disabled>
          <SelectTrigger>
            <SelectValue placeholder="Loading groups..." />
          </SelectTrigger>
        </Select>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchGroups} className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className || ""}`}>
      <Select value={pendingGroupId} onValueChange={setPendingGroupId}>
        <SelectTrigger className="w-[240px]">
          <SelectValue placeholder="Select a group">
            {selectedGroup ? buildGroupLabel(selectedGroup) : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {sortedGroups.length === 0 ? (
            <SelectItem value="_none" disabled>
              No groups available
            </SelectItem>
          ) : (
            sortedGroups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {buildGroupLabel(group)}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {sortedGroups.length === 0 && (
        <p className="text-sm text-muted-foreground">
          You are not a member of any group yet.
        </p>
      )}
      {selectedGroup && (
        <div className="rounded-md border bg-muted/20 p-3 space-y-2">
          {requiresJoinKey ? (
            <>
              <p className="text-sm font-medium">Enter group key to join</p>
              <Input
                value={joinKey}
                onChange={(event) => setJoinKey(event.target.value.toUpperCase())}
                placeholder="Group key"
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              You are already part of this group, so no key is needed to enter it.
            </p>
          )}
          <Button
            onClick={handleOpenSelectedGroup}
            disabled={requiresJoinKey && !joinKey.trim()}
          >
            Open Group
          </Button>
        </div>
      )}
      {allowCreate && (
        <div className="rounded-md border bg-muted/20 p-3 space-y-2">
          <p className="text-sm font-medium">Create your own group</p>
          <div className="flex gap-2">
            <Input
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder={createPlaceholder}
            />
            <Button onClick={handleCreateGroup} disabled={isCreating || !createName.trim()}>
              {isCreating ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      )}
      {showRefreshButton && (
        <Button variant="outline" size="sm" onClick={fetchGroups}>
          Refresh Groups
        </Button>
      )}
    </div>
  );
}
